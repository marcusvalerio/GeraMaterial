// Escolhe o provedor de IA pela chave configurada no .env.
// Gratuitos: GEMINI_API_KEY (Google AI Studio), GROQ_API_KEY (Llama), OPENROUTER_API_KEY (modelos ":free").
// Pago: ANTHROPIC_API_KEY (Claude).
// Os gratuitos usam a API compatível com OpenAI, então uma única chamada atende todos.
import Anthropic from "@anthropic-ai/sdk";

const PROVEDORES = {
  gemini: { chave: "GEMINI_API_KEY", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    modelo: "gemini-flash-latest",
    // Cada modelo tem sua própria cota diária no plano gratuito: quando um esgota, passa para o próximo.
    reservas: ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite", "gemini-flash-lite-latest"] },
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
  // IAs gratuitas às vezes respondem "ocupado" (503) ou "limite" (429): tenta de novo com espera crescente.
  // A resposta vem em streaming para a conexão não ficar parada (respostas longas passam de 5 min).
  let r, j = {};
  const modelos = process.env.AI_MODEL ? [process.env.AI_MODEL] : [p.modelo, ...(p.reservas || [])];
  let m = 0;
  for (let tentativa = 0; tentativa < 4 + modelos.length; tentativa++) {
    r = await fetch(p.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env[p.chave]}` },
      body: JSON.stringify({
        model: modelos[m],
        temperature: 0.4,
        stream: true,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: usuario }],
      }),
    });
    if (r.ok) break;
    j = await r.json().catch(() => ({}));
    if (![404, 429, 500, 503].includes(r.status)) break;
    // Cota do modelo esgotada (429) ou modelo indisponível (404): troca de modelo na hora.
    if ([404, 429].includes(r.status) && m < modelos.length - 1) { m++; continue; }
    await new Promise((ok) => setTimeout(ok, 5000 * 2 ** Math.min(tentativa, 3)));
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
  return texto;
}
