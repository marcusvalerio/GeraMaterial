import "dotenv/config";
import express from "express";
import multer from "multer";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import { perguntar, provedorAtivo } from "./ia.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { SISTEMA, ETAPAS, ORDEM, ANALISE, contexto } from "./prompts.js";
import { gerarDocx, gerarPdf } from "./exportar.js";
import { gerarSlides } from "./slides.js";
import { gerarCronograma } from "./cronograma.js";
import { gerarPER, gerarEP190 } from "./planilhas.js";
import { criarSequencia, salvarEntrega, listarSequencias, obterSequencia, excluirSequencia, bancoAtivo } from "./db.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });
const raiz = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "5mb" }));
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
app.post("/api/analisar", upload.array("referencias"), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ erro: "Envie o plano de curso para identificar as unidades curriculares." });
    const texto = await textoReferencias(req.files);
    if (texto.replace(/DOCUMENTO DE REFERÊNCIA \([^)]*\):/g, "").trim().length < 200) {
      return res.status(422).json({ erro: "Não foi possível ler o texto do arquivo. Se for um PDF escaneado (imagem), envie a versão em Word ou um PDF com texto." });
    }
    const r = extrairJson(await perguntar(SISTEMA, `${texto}\n\nTAREFA: ${ANALISE}`));
    // Remove UCs repetidas (o plano costuma listar as UCs mais de uma vez).
    const vistas = new Set();
    r.ucs = (r.ucs || []).filter((u) => {
      const k = String(u.nome || "").trim().toLowerCase();
      if (!k || vistas.has(k)) return false;
      vistas.add(k);
      return true;
    });
    res.json(r);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e.message });
  }
});

// Gera uma etapa da sequência. Recebe os dados, os documentos de referência e
// o resultado das etapas anteriores (para manter tudo coerente).
app.post("/api/gerar/:etapa", upload.array("referencias"), async (req, res) => {
  try {
    const etapa = ETAPAS[req.params.etapa];
    if (!etapa) return res.status(400).json({ erro: "Etapa inválida" });
    const dados = JSON.parse(req.body.dados || "{}");
    const anteriores = JSON.parse(req.body.anteriores || "{}");

    const ctxAnteriores = ORDEM.filter((k) => anteriores[k])
      .map((k) => `RESULTADO DA ETAPA "${ETAPAS[k].nome}":\n${JSON.stringify(anteriores[k])}`).join("\n\n");

    const usuario = `${await textoReferencias(req.files)}\n\n${contexto(dados)}\n\n${ctxAnteriores}\n\nTAREFA: ${etapa.instrucao}`;
    const texto = await perguntar(SISTEMA, usuario);
    const resultado = extrairJson(texto);
    // O PER usa as datas do calendário calculado (exatas), não as que a IA sugerir.
    if (req.params.etapa === "per" && Array.isArray(dados.aulasCronograma) && dados.aulasCronograma.length) {
      resultado.aulas = dados.aulasCronograma;
      if (dados.dataInicio) resultado.dataInicio = dados.dataInicio;
      if (dados.dataTermino) resultado.dataTermino = dados.dataTermino;
      if (dados.cargaHorariaUC) resultado.cargaHorariaUC = dados.cargaHorariaUC;
    }
    // Cria o registro da sequência na 1ª etapa e salva cada entrega no histórico.
    let sequenciaId = Number(req.body.sequenciaId) || null;
    try {
      if (!sequenciaId) sequenciaId = await criarSequencia(dados, (req.files || []).map((f) => f.originalname));
      await salvarEntrega(sequenciaId, req.params.etapa, resultado);
    } catch (e) {
      console.error("Falha ao salvar no banco:", e.message);
    }
    res.json({ sequenciaId, resultado });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e.message });
  }
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

app.post("/api/exportar/:formato", async (req, res) => {
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

app.get("/api/sequencias", async (req, res) => {
  try { res.json({ banco: bancoAtivo(), itens: await listarSequencias(req.query.busca || "") }); }
  catch (e) { res.status(500).json({ erro: e.message }); }
});
app.get("/api/sequencias/:id", async (req, res) => {
  const s = await obterSequencia(Number(req.params.id)).catch(() => null);
  s ? res.json(s) : res.status(404).json({ erro: "Não encontrada" });
});
app.delete("/api/sequencias/:id", async (req, res) => {
  await excluirSequencia(Number(req.params.id));
  res.json({ ok: true });
});

app.get("/api/ia", (_req, res) => res.json({ provedor: provedorAtivo() }));
app.get("/api/etapas", (_req, res) => res.json(ORDEM.map((k) => ({ id: k, nome: ETAPAS[k].nome }))));

export default app;

if (!process.env.VERCEL) {
  const porta = process.env.PORT || 3000;
  app.listen(porta, () => console.log(`gera.documento rodando em http://localhost:${porta}`));
}
