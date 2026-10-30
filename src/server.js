import "dotenv/config";
import express from "express";
import multer from "multer";
import mammoth from "mammoth";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { SISTEMA, ETAPAS, ORDEM, contexto } from "./prompts.js";
import { gerarDocx, gerarPdf, gerarPptx } from "./exportar.js";
import { gerarPER, gerarEP190 } from "./planilhas.js";
import { criarSequencia, salvarEntrega, listarSequencias, obterSequencia, excluirSequencia, bancoAtivo } from "./db.js";

const app = express();
const client = new Anthropic(); // usa ANTHROPIC_API_KEY
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

// Converte os documentos de referência em blocos de conteúdo para a IA.
async function blocosReferencia(arquivos) {
  const blocos = [];
  for (const f of arquivos || []) {
    const nome = f.originalname;
    if (f.mimetype === "application/pdf" || nome.toLowerCase().endsWith(".pdf")) {
      blocos.push({ type: "document", title: nome,
        source: { type: "base64", media_type: "application/pdf", data: f.buffer.toString("base64") } });
    } else if (nome.toLowerCase().endsWith(".docx")) {
      const { value } = await mammoth.extractRawText({ buffer: f.buffer });
      blocos.push({ type: "text", text: `DOCUMENTO DE REFERÊNCIA (${nome}):\n${value}` });
    } else {
      blocos.push({ type: "text", text: `DOCUMENTO DE REFERÊNCIA (${nome}):\n${f.buffer.toString("utf8")}` });
    }
  }
  return blocos;
}

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

    const content = [
      ...(await blocosReferencia(req.files)),
      { type: "text", text: `${contexto(dados)}\n\n${ctxAnteriores}\n\nTAREFA: ${etapa.instrucao}` },
    ];

    const resposta = await client.beta.messages
      .stream({
        model: "claude-opus-5-5",
        max_tokens: 32000,
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SISTEMA,
        messages: [{ role: "user", content }],
      })
      .finalMessage();

    if (resposta.stop_reason === "refusal") {
      return res.status(422).json({ erro: "A solicitação foi recusada pela IA. Revise os dados informados." });
    }
    const texto = resposta.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const resultado = extrairJson(texto);
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
    const status = e instanceof Anthropic.APIError ? e.status || 502 : 500;
    res.status(status).json({ erro: e.message });
  }
});

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const EXPORTADORES = {
  per: [gerarPER, XLSX, "xlsx"],
  ep190: [gerarEP190, "application/vnd.ms-excel.sheet.macroEnabled.12", "xlsm"],
  docx: [gerarDocx, DOCX, "docx"],
  pdf: [gerarPdf, "application/pdf", "pdf"],
  pptx: [gerarPptx, "application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
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

app.get("/api/etapas", (_req, res) => res.json(ORDEM.map((k) => ({ id: k, nome: ETAPAS[k].nome }))));

export default app;

if (!process.env.VERCEL) {
  const porta = process.env.PORT || 3000;
  app.listen(porta, () => console.log(`GeraMaterial SENAI rodando em http://localhost:${porta}`));
}
