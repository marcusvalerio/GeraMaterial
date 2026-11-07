// Escolhe o provedor de IA pela chave configurada no .env.
// Gratuitos: GEMINI_API_KEY (Google AI Studio), GROQ_API_KEY (Llama), OPENROUTER_API_KEY (modelos ":free").
// Pago: ANTHROPIC_API_KEY (Claude).
// Os gratuitos usam a API compatível com OpenAI, então uma única chamada atende todos.
import Anthropic from "@anthropic-ai/sdk";

const PROVEDORES = {
  gemini: { chave: "GEMINI_API_KEY", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    // Medido em nov/2026 com um plano de 15 encontros: os 3.x flash respondem em ~20 s;
    // o gemini-flash-latest passou de 5 min (limite da Vercel), por isso fica só como última reserva.
    modelo: "gemini-3.6-flash",
    // Cada modelo tem sua própria cota diária no plano gratuito: quando um esgota, passa para o próximo.
    reservas: ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite", "gemini-flash-lite-latest", "gemini-flash-latest"] },
  groq: { chave: "GROQ_API_KEY", url: "https://api.groq.com/openai/v1/chat/completions",
    modelo: "llama-3.3-70b-versatile" },
  openrouter: { chave: "OPENROUTER_API_KEY", url: "https://openrouter.ai/api/v1/chat/completions",
    modelo: "deepseek/deepseek-chat-v3-0324:free" },
};

export function provedorAtivo() {
  if (process.env.AI_PROVIDER) return process.env.AI_PROVIDER;
  for (const [nome, p] of Object.entries(PROVEDORES)) if (process.env[p.chave]) return nome;
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  return null;
}

// system: texto; usuario: texto. Retorna o texto da resposta.
// opcoes.rapido: tarefas simples de leitura (ex.: listar as UCs do plano) usam os modelos "lite",
// que respondem em ~2 s em vez de ~2 min, com a mesma exatidão para copiar dados do documento.
const RAPIDOS = ["gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
export async function perguntar(system, usuario, opcoes = {}) {
  const nome = provedorAtivo();
  if (!nome) throw new Error("Nenhuma IA configurada. Defina GEMINI_API_KEY, GROQ_API_KEY ou OPENROUTER_API_KEY no .env.");

  if (nome === "claude") {
    const resposta = await new Anthropic().beta.messages
      .stream({
        model: "claude-opus-5-5",
        max_tokens: 32000,
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        messages: [{ role: "user", content: usuario }],
      })
      .finalMessage();
    if (resposta.stop_reason === "refusal") throw new Error("A solicitação foi recusada pela IA.");
    return resposta.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  }

  const p = PROVEDORES[nome];
  // IAs gratuitas às vezes respondem "ocupado" (503) ou "limite" (429): tenta de novo com espera crescente.
  // A resposta vem em streaming para a conexão não ficar parada (respostas longas passam de 5 min).
  let r, j = {};
  const modelos = process.env.AI_MODEL ? [process.env.AI_MODEL]
    : opcoes.rapido && nome === "gemini" ? [...RAPIDOS, p.modelo] : [p.modelo, ...(p.reservas || [])];
  let m = 0;
  try {
  for (let tentativa = 0; tentativa < 4 + modelos.length; tentativa++) {
    // Desiste antes do limite de 5 min da Vercel, para mostrar uma mensagem clara em vez de cair a conexão.
    r = await fetch(p.url, {
      signal: AbortSignal.timeout(Number(process.env.AI_TEMPO_LIMITE_MS) || 285000),
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env[p.chave]}` },
      body: JSON.stringify({
        model: modelos[m],
        // Leitura (rápida) copia dados do documento: temperatura baixa para sair sempre igual.
        temperature: opcoes.rapido ? 0.1 : 0.4,
        stream: true,
        // Raciocínio curto: o Gemini "pensa" antes de responder e isso pode passar de 5 min (limite da Vercel).
        ...(nome === "gemini" ? { reasoning_effort: process.env.AI_ESFORCO || "low" } : {}),
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: usuario }],
      }),
    });
    if (r.ok) break;
    j = await r.json().catch(() => ({}));
    if (![404, 429, 500, 503].includes(r.status)) break;
    // Cota esgotada (429), modelo indisponível (404) ou sobrecarregado (503/500): troca de modelo na hora.
    // Só espera e tenta de novo quando não há mais modelos de reserva.
    if (m < modelos.length - 1) { m++; continue; }
    await new Promise((ok) => setTimeout(ok, 5000 * 2 ** Math.min(tentativa, 3)));
  }
  } catch (e) {
    if (e.name === "TimeoutError" || e.name === "AbortError") throw new Error("A IA demorou mais que o limite de 5 minutos nesta etapa. Clique em tentar de novo.");
    throw e;
  }
  if (!r.ok) {
    const erro = Array.isArray(j) ? j[0]?.error : j.error;
    if (r.status === 429) throw new Error(`Limite gratuito da IA atingido (${nome}). Aguarde alguns minutos e tente novamente.`);
    if (r.status === 503) throw new Error(`A IA (${nome}) está sobrecarregada no momento. Tente novamente em alguns minutos.`);
    throw new Error(`Erro da IA (${nome}): ${erro?.message || JSON.stringify(j).slice(0, 300)}`);
  }
  // Lê o stream (Server-Sent Events) e junta os pedaços de texto.
  let texto = "", resto = "";
  const dec = new TextDecoder();
  try {
  for await (const pedaco of r.body) {
    resto += dec.decode(pedaco, { stream: true });
    const linhas = resto.split("\n");
    resto = linhas.pop();
    for (const l of linhas) {
      if (!l.startsWith("data:")) continue;
      const dado = l.slice(5).trim();
      if (!dado || dado === "[DONE]") continue;
      try { texto += JSON.parse(dado).choices?.[0]?.delta?.content || ""; } catch { /* linha parcial */ }
    }
  }
  } catch (e) {
    if (e.name === "TimeoutError" || e.name === "AbortError") throw new Error("A IA demorou mais que o limite de 5 minutos nesta etapa. Clique em tentar de novo.");
    throw e;
  }
  return texto;
}

// Pede uma resposta em JSON. Se a IA devolver um JSON quebrado (acontece com os modelos gratuitos),
// pede de novo até 2 vezes antes de desistir.
export async function perguntarJson(system, usuario, tentativas = 3, opcoes = {}) {
  let ultimo;
  for (let i = 0; i < tentativas; i++) {
    const pedido = i ? `${usuario}\n\nATENÇÃO: a resposta anterior veio com JSON inválido. Responda SOMENTE um JSON válido:
aspas duplas dentro de textos escapadas (\\"), vírgula entre os itens das listas e nada fora do JSON.` : usuario;
    const texto = await perguntar(system, pedido, opcoes);
    const ini = texto.indexOf("{"), fim = texto.lastIndexOf("}");
    try {
      if (ini < 0 || fim < 0) throw new SyntaxError("sem JSON");
      const bruto = texto.slice(ini, fim + 1);
      try { return JSON.parse(bruto); }
      catch (e) {
        // Conserta os defeitos comuns (aspas sem escape, vírgula faltando) antes de pedir de novo.
        const { jsonrepair } = await import("jsonrepair");
        const r = JSON.parse(jsonrepair(bruto));
        console.warn("JSON da IA consertado:", e.message);
        return r;
      }
    } catch (e) {
      ultimo = e;
      console.warn(`JSON inválido da IA (tentativa ${i + 1}):`, e.message);
    }
  }
  throw new Error(`A IA devolveu uma resposta incompleta. Tente de novo. (${ultimo?.message})`);
}
