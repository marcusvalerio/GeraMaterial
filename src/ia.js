// Escolhe o provedor de IA pela chave configurada no .env.
// Gratuitos: GEMINI_API_KEY (Google AI Studio), GROQ_API_KEY (Llama), OPENROUTER_API_KEY (modelos ":free").
// Pago: ANTHROPIC_API_KEY (Claude).
// Os gratuitos usam a API compatível com OpenAI, então uma única chamada atende todos.
import Anthropic from "@anthropic-ai/sdk";

const PROVEDORES = {
  gemini: { chave: "GEMINI_API_KEY", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    modelo: "gemini-flash-latest" },
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
export async function perguntar(system, usuario) {
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
  const r = await fetch(p.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env[p.chave]}` },
    body: JSON.stringify({
      model: process.env.AI_MODEL || p.modelo,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: usuario }],
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j.error?.message || JSON.stringify(j).slice(0, 300);
    if (r.status === 429) throw new Error(`Limite gratuito da IA atingido (${nome}). Aguarde um minuto e tente novamente.`);
    throw new Error(`Erro da IA (${nome}): ${msg}`);
  }
  return j.choices?.[0]?.message?.content || "";
}
