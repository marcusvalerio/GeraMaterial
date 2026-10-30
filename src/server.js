import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { montarPrompt, TIPOS } from "./prompts.js";
import { gerarDocx, gerarPdf, gerarPptx } from "./exportar.js";

const app = express();
const client = new Anthropic(); // usa ANTHROPIC_API_KEY
const raiz = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(raiz, "..", "public")));

function extrairJson(texto) {
  const ini = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (ini < 0 || fim < 0) throw new Error("A IA não retornou um JSON válido.");
  return JSON.parse(texto.slice(ini, fim + 1));
}

app.post("/api/gerar", async (req, res) => {
  try {
    const { tipo, dados } = req.body;
    const { system, user } = montarPrompt(tipo, dados || {});
    const resposta = await client.beta.messages
      .stream({
        model: "claude-opus-5-5",
        max_tokens: 32000,
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        messages: [{ role: "user", content: user }],
      })
      .finalMessage();

    if (resposta.stop_reason === "refusal") {
      return res.status(422).json({ erro: "A solicitação foi recusada pela IA. Revise os dados informados." });
    }
    const texto = resposta.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    res.json(extrairJson(texto));
  } catch (e) {
    console.error(e);
    const status = e instanceof Anthropic.APIError ? e.status || 502 : 500;
    res.status(status).json({ erro: e.message });
  }
});

const EXPORTADORES = {
  docx: [gerarDocx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  pdf: [gerarPdf, "application/pdf"],
  pptx: [gerarPptx, "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
};

app.post("/api/exportar/:formato", async (req, res) => {
  const exp = EXPORTADORES[req.params.formato];
  if (!exp) return res.status(400).json({ erro: "Formato inválido" });
  try {
    const buf = await exp[0](req.body);
    const nome = (req.body.titulo || "material").replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80).trim() || "material";
    res.setHeader("Content-Type", exp[1]);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(nome)}.${req.params.formato}`);
    res.send(Buffer.from(buf));
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e.message });
  }
});

app.get("/api/tipos", (_req, res) => res.json(TIPOS));

const porta = process.env.PORT || 3000;
app.listen(porta, () => console.log(`GeraMaterial SENAI rodando em http://localhost:${porta}`));
