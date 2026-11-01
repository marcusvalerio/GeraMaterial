import "dotenv/config";
import express from "express";
import { waitUntil } from "@vercel/functions";
import multer from "multer";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import { perguntarJson, provedorAtivo } from "./ia.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { SISTEMA, ETAPAS, ORDEM, ANALISE, contexto } from "./prompts.js";
import { gerarDocx, gerarPdf } from "./exportar.js";
import { gerarSlides } from "./slides.js";
import { gerarCronograma } from "./cronograma.js";
import { gerarPER, gerarEP190 } from "./planilhas.js";
import { criarSequencia, salvarEntrega, listarSequencias, obterSequencia, excluirSequencia, podeEditarSequencia, bancoAtivo } from "./db.js";
import { carregarUsuario, exigeLogin, rotasAuth, ehGestor } from "./auth.js";
import { sql } from "./db.js";
import { rotasTurmas } from "./turmas.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });
const raiz = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "5mb" }));
app.use(carregarUsuario);
// A raiz abre a Home (Início).
app.get("/", (_req, res) => res.redirect("/inicio.html"));
app.use(express.static(path.join(raiz, "..", "public")));

function extrairJson(texto) {
  const ini = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (ini < 0 || fim < 0) throw new Error("A IA não retornou um JSON válido.");
  return JSON.parse(texto.slice(ini, fim + 1));
}

// Extrai o texto dos documentos de referência (PDF, Word ou TXT).
async function textoReferencias(arquivos) {
  const partes = [];
  for (const f of arquivos || []) {
    const nome = f.originalname;
    let texto;
    if (nome.toLowerCase().endsWith(".pdf")) texto = (await extractText(new Uint8Array(f.buffer), { mergePages: true })).text;
    else if (nome.toLowerCase().endsWith(".docx")) texto = (await mammoth.extractRawText({ buffer: f.buffer })).value;
    else texto = f.buffer.toString("utf8");
    partes.push(`DOCUMENTO DE REFERÊNCIA (${nome}):\n${texto.replace(/\n{3,}/g, "\n\n")}`);
  }
  return partes.join("\n\n");
}

// Lê o plano de curso enviado e devolve o curso e a lista de unidades curriculares.
app.post("/api/analisar", exigeLogin, upload.array("referencias"), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ erro: "Envie o plano de curso para identificar as unidades curriculares." });
    const texto = await textoReferencias(req.files);
    if (texto.replace(/DOCUMENTO DE REFERÊNCIA \([^)]*\):/g, "").trim().length < 200) {
      return res.status(422).json({ erro: "Não foi possível ler o texto do arquivo. Se for um PDF escaneado (imagem), envie a versão em Word ou um PDF com texto." });
    }
    const r = await perguntarJson(SISTEMA, `${texto}\n\nTAREFA: ${ANALISE}`);
    // Remove UCs repetidas (o plano costuma listar as UCs mais de uma vez).
    const vistas = new Set();
    r.ucs = (r.ucs || []).filter((u) => {
      const k = String(u.nome || "").trim().toLowerCase();
      if (!k || vistas.has(k)) return false;
      vistas.add(k);
      return true;
    });
    // O texto lido volta junto para ser guardado na turma (assim não é preciso reenviar o PDF depois).
    res.json({ ...r, referencia: texto.slice(0, 200000) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e.message });
  }
});

// Gera uma etapa da sequência. Recebe os dados, os documentos de referência e
// o resultado das etapas anteriores (para manter tudo coerente).
async function executarEtapa(etapaId, dados, anteriores, referencia) {
  const etapa = ETAPAS[etapaId];
  const ctxAnteriores = ORDEM.filter((k) => anteriores[k])
    .map((k) => `RESULTADO DA ETAPA "${ETAPAS[k].nome}":\n${JSON.stringify(anteriores[k])}`).join("\n\n");
  const usuario = `${referencia}\n\n${contexto(dados)}\n\n${ctxAnteriores}\n\nTAREFA: ${etapa.instrucao}`;
  const resultado = await perguntarJson(SISTEMA, usuario);
  // O PER usa as datas do calendário calculado (exatas), não as que a IA sugerir.
  if (etapaId === "per" && Array.isArray(dados.aulasCronograma) && dados.aulasCronograma.length) {
    resultado.aulas = dados.aulasCronograma;
    if (dados.dataInicio) resultado.dataInicio = dados.dataInicio;
    if (dados.dataTermino) resultado.dataTermino = dados.dataTermino;
    if (dados.cargaHorariaUC) resultado.cargaHorariaUC = dados.cargaHorariaUC;
  }
  return resultado;
}

// A geração roda no servidor em segundo plano: o app pode ser fechado ou ir para o fundo
// (o celular corta a conexão) e o trabalho continua. O app acompanha por /api/trabalhos/:id.
app.post("/api/gerar/:etapa", exigeLogin, upload.array("referencias"), async (req, res) => {
  try {
    if (!ETAPAS[req.params.etapa]) return res.status(400).json({ erro: "Etapa inválida" });
    const dados = JSON.parse(req.body.dados || "{}");
    const anteriores = JSON.parse(req.body.anteriores || "{}");

    // Sem arquivo enviado, usa o plano de curso guardado na turma.
    let referencia = await textoReferencias(req.files);
    const turmaId = Number(req.body.turmaId) || null;
    if (!referencia && turmaId && sql) {
      const [t] = await sql`SELECT usuario_id, dados FROM turmas WHERE id = ${turmaId}`;
      if (t && (ehGestor(req.usuario) || Number(t.usuario_id) === req.usuario.id)) referencia = t.dados?.referencia || "";
    }
    let sequenciaId = Number(req.body.sequenciaId) || null;
    if (sequenciaId && !(await podeEditarSequencia(sequenciaId, req.usuario))) sequenciaId = null;

    // Sem banco, gera na hora (modo antigo).
    if (!sql) return res.json({ sequenciaId, resultado: await executarEtapa(req.params.etapa, dados, anteriores, referencia) });

    if (!sequenciaId) sequenciaId = await criarSequencia(dados, (req.files || []).map((f) => f.originalname), req.usuario.id, turmaId);
    const [t] = await sql`INSERT INTO trabalhos (usuario_id, sequencia_id, etapa) VALUES (${req.usuario.id}, ${sequenciaId}, ${req.params.etapa}) RETURNING id`;
    const tarefa = (async () => {
      try {
        const resultado = await executarEtapa(req.params.etapa, dados, anteriores, referencia);
        await salvarEntrega(sequenciaId, req.params.etapa, resultado);
        await sql`UPDATE trabalhos SET estado = 'ok', atualizado_em = now() WHERE id = ${t.id}`;
      } catch (e) {
        console.error(e);
        await sql`UPDATE trabalhos SET estado = 'erro', erro = ${e.message}, atualizado_em = now() WHERE id = ${t.id}`.catch(() => {});
      }
    })();
    waitUntil(tarefa);
    res.status(202).json({ sequenciaId, trabalhoId: t.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e.message });
  }
});

app.get("/api/trabalhos/:id", exigeLogin, async (req, res) => {
  const [t] = await sql`SELECT * FROM trabalhos WHERE id = ${Number(req.params.id)}`;
  if (!t || (t.usuario_id !== req.usuario.id && !ehGestor(req.usuario))) return res.status(404).json({ erro: "Não encontrado" });
  // Trabalho parado há mais de 6 min (função encerrada) conta como falha.
  if (t.estado === "gerando" && Date.now() - new Date(t.criado_em).getTime() > 6 * 60 * 1000)
    return res.json({ estado: "erro", erro: "A geração demorou demais. Tente de novo." });
  if (t.estado !== "ok") return res.json({ estado: t.estado, erro: t.erro });
  const [e] = await sql`SELECT conteudo FROM entregas WHERE sequencia_id = ${t.sequencia_id} AND etapa = ${t.etapa}`;
  res.json({ estado: "ok", sequenciaId: t.sequencia_id, resultado: e?.conteudo });
});

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const EXPORTADORES = {
  per: [gerarPER, XLSX, "xlsx"],
  ep190: [gerarEP190, "application/vnd.ms-excel.sheet.macroEnabled.12", "xlsm"],
  cronograma: [gerarCronograma, XLSX, "xlsx"],
  docx: [gerarDocx, DOCX, "docx"],
  pdf: [gerarPdf, "application/pdf", "pdf"],
  pptx: [gerarSlides, "application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
};

app.post("/api/exportar/:formato", exigeLogin, async (req, res) => {
  const exp = EXPORTADORES[req.params.formato];
  if (!exp) return res.status(400).json({ erro: "Formato inválido" });
  try {
    const buf = await exp[0](req.body);
    const nome = String(req.query.nome || req.body.titulo || "material")
      .replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80).trim() || "material";
    res.setHeader("Content-Type", exp[1]);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(nome)}.${exp[2]}`);
    res.send(Buffer.from(buf));
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e.message });
  }
});

app.get("/api/sequencias", exigeLogin, async (req, res) => {
  try { res.json({ banco: bancoAtivo(), itens: await listarSequencias(req.query.busca || "", req.usuario) }); }
  catch (e) { res.status(500).json({ erro: e.message }); }
});
app.get("/api/sequencias/:id", exigeLogin, async (req, res) => {
  const s = await obterSequencia(Number(req.params.id), req.usuario).catch(() => null);
  s ? res.json(s) : res.status(404).json({ erro: "Não encontrada" });
});
app.delete("/api/sequencias/:id", exigeLogin, async (req, res) => {
  await excluirSequencia(Number(req.params.id), req.usuario);
  res.json({ ok: true });
});

rotasAuth(app);
rotasTurmas(app);

// Versão publicada: o app recarrega sozinho quando muda (evita ficar com código antigo aberto).
const VERSAO = process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now());
app.get("/api/versao", (_req, res) => { res.setHeader("Cache-Control", "no-store"); res.json({ versao: VERSAO }); });
app.get("/api/ia", (_req, res) => res.json({ provedor: provedorAtivo() }));
app.get("/api/etapas", (_req, res) => res.json(ORDEM.map((k) => ({ id: k, nome: ETAPAS[k].nome }))));

export default app;

if (!process.env.VERCEL) {
  const porta = process.env.PORT || 3000;
  app.listen(porta, () => console.log(`gera.documento rodando em http://localhost:${porta}`));
}
