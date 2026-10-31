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

// Áreas do sistema. Cada uma tem cor clara e ícone próprios (identidade no estilo "mini").
export const AREAS = [
  { id: "inicio", nome: "Início", href: "inicio.html", icone: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>' },
  { id: "gerar", nome: "Gerar", href: "index.html", icone: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 11v6M9 14h6"/>' },
  { id: "materiais", nome: "Materiais", href: "materiais.html", icone: '<rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/>' },
  { id: "turmas", nome: "Turmas", href: "turmas.html", icone: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 19c0-3.3 2.7-5 6-5s6 1.7 6 5"/><path d="M15 14.2c2.9.1 5 1.6 5 4.8"/>' },
  { id: "painel", nome: "Painel", href: "painel.html", gestor: true, icone: '<rect x="4" y="12" width="3.5" height="8" rx="1"/><rect x="10.25" y="7" width="3.5" height="13" rx="1"/><rect x="16.5" y="4" width="3.5" height="16" rx="1"/>' },
];
export const icone = (area, tam = 22) => `<svg class="ico" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${area.icone}</svg>`;

// Garante a sessão e monta o topo e a barra de abas. Retorna o usuário logado.
// Intro de abertura (estilo "mini"): tiles das áreas entram em cascata, empilham e viram o cartão g.
// Aparece uma vez por sessão; some com um toque; não aparece com "reduzir movimento".
export function introAbertura() {
  let jaViu = false;
  try { jaViu = sessionStorage.getItem("gd_intro") === "1"; sessionStorage.setItem("gd_intro", "1"); } catch { /* sem storage */ }
  if (jaViu || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const el = document.createElement("div");
  el.className = "intro";
  el.setAttribute("aria-hidden", "true");
  const tiles = AREAS.filter((a) => a.id !== "inicio");
  el.innerHTML = `<div class="intro-palco">
      ${tiles.map((a, i) => `<span class="intro-tile" data-area="${a.id}" style="--i:${i}">${icone(a, 30)}<b>g.</b></span>`).join("")}
      <span class="intro-cartao"><b>g<i>.</i></b></span>
    </div>
    <p class="intro-nome">gera<i>.</i>documento</p>`;
  document.body.append(el);
  const fechar = () => { el.classList.add("saindo"); setTimeout(() => el.remove(), 380); };
  el.addEventListener("click", fechar);
  setTimeout(fechar, 2100);
}

export async function iniciarPagina(atual) {
  introAbertura();
  let usuario;
  try { ({ usuario } = await api("/api/auth/eu")); } catch { return null; }
  if (!usuario.aprovado) { location.href = "entrar.html?pendente=1"; return null; }
  const gestor = usuario.papel === "admin" || usuario.papel === "coordenador";
  const areas = AREAS.filter((a) => !a.gestor || gestor);
  const ativa = AREAS.find((a) => a.id === atual) || AREAS[0];
  document.body.dataset.area = ativa.id;

  const topo = $(".topo");
  if (topo) {
    topo.innerHTML = `
      <a class="marca" href="inicio.html" aria-label="gera.documento, início"><span class="selo" aria-hidden="true">g.</span><span class="nome">gera<span class="ponto">.</span>documento</span></a>
      <span class="tag-area" aria-hidden="true"><span class="selo">g.</span>${esc(ativa.nome)}</span>
      <nav class="menu-areas" aria-label="Áreas">${areas.map((a) => `<a href="${a.href}" data-area="${a.id}"${a.id === atual ? ' aria-current="page"' : ""}>${icone(a, 18)}<span>${a.nome}</span></a>`).join("")}</nav>
      <details class="conta"><summary aria-label="Sua conta: ${esc(usuario.nome)}">${esc(usuario.nome.trim().charAt(0).toUpperCase())}</summary>
        <div class="conta-menu"><p><strong>${esc(usuario.nome)}</strong><span>${esc(usuario.email)}</span><span class="papel">${{ admin: "Administrador", coordenador: "Coordenação", instrutor: "Instrutor(a)" }[usuario.papel]}</span></p>
        <a class="conta-link" href="fontes-gera-documento.zip" download>Baixar fonte Inter</a>
        <button type="button" id="btnSair">Sair</button></div></details>`;
    $("#btnSair").onclick = async () => { await api("/api/auth/sair", { metodo: "POST" }); location.href = "entrar.html"; };
  }
  // Barra de abas fixa embaixo (aparece só no celular, via CSS).
  if (!$(".abas-app")) {
    const nav = document.createElement("nav");
    nav.className = "abas-app";
    nav.setAttribute("aria-label", "Áreas");
    nav.innerHTML = areas.map((a) => `<a href="${a.href}" data-area="${a.id}"${a.id === atual ? ' aria-current="page"' : ""}><span class="abas-ico">${icone(a, 22)}</span><span>${a.nome}</span></a>`).join("");
    document.body.append(nav);
  }
  document.body.classList.add("pronto", "com-abas");
  return usuario;
}
