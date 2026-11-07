import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import { waitUntil } from "@vercel/functions";
import multer from "multer";
import { perguntarJson, provedorAtivo } from "./ia.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { SISTEMA, ETAPAS, ORDEM, ANALISE, contexto, promptSlides } from "./prompts.js";
// Geradores de arquivo e leitores de PDF/Word só carregam quando usados: o servidor liga mais rápido.
const sob = (mod, nome) => async (...a) => (await import(mod))[nome](...a);
const gerarSlides = sob("./slides.js", "gerarSlides"), gerarDocx = sob("./exportar.js", "gerarDocx"), gerarPdf = sob("./exportar.js", "gerarPdf");
const gerarPlanoAula = sob("./planoAula.js", "gerarPlanoAula"), gerarCronograma = sob("./cronograma.js", "gerarCronograma");
const gerarPER = sob("./planilhas.js", "gerarPER"), gerarEP190 = sob("./planilhas.js", "gerarEP190");
import { criarSequencia, salvarEntrega, mapaEntregas, listarSequencias, obterSequencia, excluirSequencia, podeEditarSequencia, bancoAtivo } from "./db.js";
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
    if (nome.toLowerCase().endsWith(".pdf")) texto = (await (await import("unpdf")).extractText(new Uint8Array(f.buffer), { mergePages: true })).text;
    else if (nome.toLowerCase().endsWith(".docx")) texto = (await (await import("mammoth")).default.extractRawText({ buffer: f.buffer })).value;
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
    const r = await perguntarJson(SISTEMA, `${texto}\n\nTAREFA: ${ANALISE}`, 3, { rapido: true });
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

// Slides de um encontro do Plano de Aula: conteúdo preso aos conhecimentos daquele encontro,
// quantidade proporcional às horas e notas do professor em cada slide.
const horasDe = (v) => Number(String(v ?? "").replace(",", ".").match(/[\d.]+/)?.[0] || 0);
async function executarSlides(numero, dados, prontos, referencia) {
  const plano = prontos.plano;
  const enc = (plano?.dias || []).find((d, i) => Number(d.numero || i + 1) === numero);
  if (!enc) throw new Error("Encontro não encontrado no Plano de Aula. Gere o Plano de Aula primeiro.");
  const horas = horasDe(enc.horas) || horasDe(dados.horasAula) || 4;
  const resumo = { uc: plano.uc, curso: plano.curso, objetivoGeral: plano.objetivoGeral, totalEncontros: plano.dias.length };
  const usuario = `${referencia}\n\n${contexto(dados)}\n\nPLANO DE AULA (resumo): ${JSON.stringify(resumo)}\n\nTAREFA: ${promptSlides(enc, horas)}`;
  const r = await perguntarJson(SISTEMA, usuario);
  r.rodape = r.rodape || `${dados.curso || plano.curso || ""} | ${dados.uc || plano.uc || ""}`;
  r.professor = r.professor || dados.instrutor || "";
  r.encontro = numero;
  return r;
}

// ---------- Geração em cadeia, no servidor ----------
// O app pede a primeira etapa e a lista das seguintes ("seguir"). O servidor guarda o pedido e, ao terminar
// cada etapa, dispara sozinho a próxima numa chamada nova (cada uma com o seu limite de 5 min da Vercel).
// Assim a sequência inteira fica pronta mesmo com o app fechado; o app só acompanha o progresso.
const SEGREDO_INTERNO = crypto.createHash("sha256").update(`cadeia:${process.env.SESSION_SECRET || "dev"}`).digest("hex");

async function rodarTrabalho(id) {
  const [t] = await sql`SELECT * FROM trabalhos WHERE id = ${id}`;
  if (!t || t.estado !== "gerando") return;
  const { dados, referencia, base } = t.entrada || {};
  try {
    const entregas = await sql`SELECT etapa, conteudo FROM entregas WHERE sequencia_id = ${t.sequencia_id}`;
    const anteriores = Object.fromEntries(entregas.filter((e) => ORDEM.indexOf(e.etapa) < ORDEM.indexOf(t.etapa)).map((e) => [e.etapa, e.conteudo]));
    const resultado = t.etapa.startsWith("slides:")
      ? await executarSlides(Number(t.etapa.split(":")[1]), dados || {}, mapaEntregas(entregas), referencia || "")
      : await executarEtapa(t.etapa, dados || {}, anteriores, referencia || "");
    await salvarEntrega(t.sequencia_id, t.etapa, resultado);
  } catch (e) {
    console.error(e);
    await sql`UPDATE trabalhos SET estado = 'erro', erro = ${e.message}, atualizado_em = now() WHERE id = ${id}`.catch(() => {});
    return; // com erro, a cadeia para; o app mostra "Tentar de novo a partir daqui"
  }
  const fila = t.fila || [];
  if (!fila.length) {
    await sql`UPDATE trabalhos SET estado = 'ok', atualizado_em = now() WHERE id = ${id}`;
    return;
  }
  // Avaliações e Atividade só dependem do Plano de Aula: com o plano pronto, as duas rodam em paralelo.
  const paralelas = new Set(["avaliacao", "atividade"]);
  const grupos = paralelas.has(fila[0]) && fila.every((e) => paralelas.has(e))
    ? fila.map((e) => [e, []])
    : [[fila[0], fila.slice(1)]];
  // As próximas entram no banco antes desta virar "ok": o app nunca vê a cadeia parada no meio.
  const novos = [];
  for (const [etapa, resto] of grupos) {
    const [n] = await sql`INSERT INTO trabalhos (usuario_id, sequencia_id, etapa, entrada, fila)
      VALUES (${t.usuario_id}, ${t.sequencia_id}, ${etapa}, ${JSON.stringify(t.entrada)}, ${resto}) RETURNING id`;
    novos.push(n.id);
  }
  await sql`UPDATE trabalhos SET estado = 'ok', atualizado_em = now() WHERE id = ${id}`;
  await Promise.all(novos.map((n) => dispararTrabalho(n, base)));
}

// Roda o trabalho numa chamada nova ao próprio servidor (na Vercel) ou direto (local).
async function dispararTrabalho(id, base) {
  if (!process.env.VERCEL || !base) { waitUntil(rodarTrabalho(id)); return; }
  try {
    await fetch(`${base}/api/interno/trabalho/${id}`, { method: "POST", headers: { "x-interno": SEGREDO_INTERNO }, signal: AbortSignal.timeout(10000) });
  } catch (e) {
    console.error("Falha ao disparar a próxima etapa, rodando aqui:", e.message);
    waitUntil(rodarTrabalho(id));
  }
}

app.post("/api/interno/trabalho/:id", (req, res) => {
  if (req.headers["x-interno"] !== SEGREDO_INTERNO) return res.status(403).json({ erro: "Proibido" });
  waitUntil(rodarTrabalho(Number(req.params.id)));
  res.status(202).json({ ok: true });
});

app.post("/api/gerar/:etapa", exigeLogin, upload.array("referencias"), async (req, res) => {
  try {
    if (!ETAPAS[req.params.etapa]) return res.status(400).json({ erro: "Etapa inválida" });
    const dados = JSON.parse(req.body.dados || "{}");
    const anteriores = JSON.parse(req.body.anteriores || "{}");
    const seguir = JSON.parse(req.body.seguir || "[]").filter((e) => ETAPAS[e] && e !== req.params.etapa);

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
    // Etapas anteriores que o app mandou e ainda não estão no banco (ex.: retomada) ficam guardadas.
    for (const [et, r] of Object.entries(anteriores)) if (ETAPAS[et] && r) await salvarEntrega(sequenciaId, et, r).catch(() => {});
    // Um pedido novo para esta sequência cancela a cadeia antiga que ainda estiver rodando.
    await sql`UPDATE trabalhos SET estado = 'cancelado', fila = '{}' WHERE sequencia_id = ${sequenciaId} AND estado = 'gerando'`;
    const base = `${req.headers["x-forwarded-proto"] || req.protocol}://${req.headers.host}`;
    const entrada = { dados, referencia, base };
    const [t] = await sql`INSERT INTO trabalhos (usuario_id, sequencia_id, etapa, entrada, fila)
      VALUES (${req.usuario.id}, ${sequenciaId}, ${req.params.etapa}, ${JSON.stringify(entrada)}, ${seguir}) RETURNING id`;
    waitUntil(rodarTrabalho(t.id));
    res.status(202).json({ sequenciaId, trabalhoId: t.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e.message });
  }
});

app.post("/api/sequencias/:id/slides/:n", exigeLogin, async (req, res) => {
  try {
    const id = Number(req.params.id), n = Number(req.params.n);
    if (!(await podeEditarSequencia(id, req.usuario))) return res.status(404).json({ erro: "Não encontrada" });
    const [s] = await sql`SELECT dados FROM sequencias WHERE id = ${id}`;
    const [plano] = await sql`SELECT 1 FROM entregas WHERE sequencia_id = ${id} AND etapa = 'plano'`;
    if (!plano) return res.status(400).json({ erro: "Gere o Plano de Aula antes dos slides." });
    // O plano de curso lido fica guardado no pedido da sequência.
    const [ant] = await sql`SELECT entrada FROM trabalhos WHERE sequencia_id = ${id} AND entrada IS NOT NULL ORDER BY id DESC LIMIT 1`;
    const base = `${req.headers["x-forwarded-proto"] || req.protocol}://${req.headers.host}`;
    const entrada = { dados: ant?.entrada?.dados || s?.dados || {}, referencia: ant?.entrada?.referencia || "", base };
    const etapa = `slides:${n}`;
    await sql`UPDATE trabalhos SET estado = 'cancelado' WHERE sequencia_id = ${id} AND etapa = ${etapa} AND estado = 'gerando'`;
    const [t] = await sql`INSERT INTO trabalhos (usuario_id, sequencia_id, etapa, entrada) VALUES (${req.usuario.id}, ${id}, ${etapa}, ${JSON.stringify(entrada)}) RETURNING id`;
    waitUntil(rodarTrabalho(t.id));
    res.status(202).json({ trabalhoId: t.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e.message });
  }
});

// Progresso da sequência: estado de cada etapa (ok, gerando, fila, erro) e os resultados prontos.
app.get("/api/sequencias/:id/progresso", exigeLogin, async (req, res) => {
  const id = Number(req.params.id);
  if (!(await podeEditarSequencia(id, req.usuario))) return res.status(404).json({ erro: "Não encontrada" });
  const entregas = await sql`SELECT etapa, conteudo FROM entregas WHERE sequencia_id = ${id}`;
  const ultimos = await sql`SELECT DISTINCT ON (etapa) * FROM trabalhos WHERE sequencia_id = ${id} AND estado <> 'cancelado' ORDER BY etapa, id DESC`;
  const resultados = mapaEntregas(entregas);
  const estados = {};
  for (const t of ultimos) {
    let estado = t.estado, erro = t.erro;
    // Parado há mais de 6 min (função encerrada no meio): conta como falha.
    if (estado === "gerando" && Date.now() - new Date(t.atualizado_em || t.criado_em).getTime() > 6 * 60 * 1000) {
      estado = "erro"; erro = "A geração demorou demais nesta etapa. Toque em Tentar de novo.";
    }
    if (estado === "gerando") { estados[t.etapa] = { tipo: "gerando" }; for (const f of t.fila || []) if (!estados[f]) estados[f] = { tipo: "fila" }; }
    if (estado === "erro") estados[t.etapa] = { tipo: "erro", msg: erro || "Falha ao gerar" };
  }
  const ativo = Object.values(estados).some((e) => e.tipo === "gerando" || e.tipo === "fila");
  res.json({ resultados, estados, ativo });
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
  planoaula: [gerarPlanoAula, DOCX, "docx"],
  pptx: [gerarSlides, "application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
  pdf: [gerarPdf, "application/pdf", "pdf"],
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
