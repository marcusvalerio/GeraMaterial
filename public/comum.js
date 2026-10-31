// Partes comuns a todas as telas: sessão, menu do topo e chamadas à API.
export const $ = (s, el = document) => el.querySelector(s);
export const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const dataBrIso = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "-");

// Chamada à API em JSON. Sem sessão, leva para o login.
export async function api(caminho, { metodo = "GET", corpo } = {}) {
  const r = await fetch(caminho, {
    method: metodo,
    headers: corpo instanceof FormData || corpo === undefined ? undefined : { "Content-Type": "application/json" },
    body: corpo instanceof FormData ? corpo : corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && j.login) { location.href = `entrar.html?voltar=${encodeURIComponent(location.pathname + location.search)}`; throw new Error(j.erro); }
  if (!r.ok) throw Object.assign(new Error(j.erro || "Algo deu errado. Tente de novo."), { status: r.status, dados: j });
  return j;
}

// Garante a sessão e monta o menu do topo. Retorna o usuário logado.
export async function iniciarPagina(atual) {
  let usuario;
  try { ({ usuario } = await api("/api/auth/eu")); } catch { return null; }
  if (!usuario.aprovado) { location.href = "entrar.html?pendente=1"; return null; }
  const gestor = usuario.papel === "admin" || usuario.papel === "coordenador";
  const links = [["index.html", "gerar", "Gerar materiais"], ["turmas.html", "turmas", "Turmas"]];
  if (gestor) links.push(["painel.html", "painel", "Painel"]);
  const nav = $("#menu");
  if (nav) {
    nav.innerHTML = links.map(([href, id, rotulo]) => `<a href="${href}"${id === atual ? ' aria-current="page"' : ""}>${rotulo}</a>`).join("")
      + `<details class="conta"><summary aria-label="Sua conta: ${esc(usuario.nome)}">${esc(usuario.nome.trim().charAt(0).toUpperCase())}</summary>
        <div class="conta-menu"><p><strong>${esc(usuario.nome)}</strong><span>${esc(usuario.email)}</span><span class="papel">${{ admin: "Administrador", coordenador: "Coordenação", instrutor: "Instrutor(a)" }[usuario.papel]}</span></p>
        <button type="button" id="btnSair">Sair</button></div></details>`;
    $("#btnSair").onclick = async () => { await api("/api/auth/sair", { metodo: "POST" }); location.href = "entrar.html"; };
  }
  document.body.classList.add("pronto");
  return usuario;
}
