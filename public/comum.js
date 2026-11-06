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
  try { sessionStorage.setItem("gd_intro_agora", "1"); setTimeout(() => sessionStorage.removeItem("gd_intro_agora"), 3000); } catch { /* sem storage */ }
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
      <button type="button" class="btn-tema" id="btnTema"></button>
      <details class="conta"><summary aria-label="Sua conta: ${esc(usuario.nome)}">${esc(usuario.nome.trim().charAt(0).toUpperCase())}</summary>
        <div class="conta-menu"><p><strong>${esc(usuario.nome)}</strong><span>${esc(usuario.email)}</span><span class="papel">${{ admin: "Administrador", coordenador: "Coordenação", instrutor: "Instrutor(a)" }[usuario.papel]}</span></p>
        <a class="conta-link" href="inicio.html?tour=1">Rever o tour</a>
        <a class="conta-link" href="#" id="temaAuto" hidden>Tema: seguir o sistema</a>
        <a class="conta-link" href="fontes-gera-documento.zip" download>Baixar fonte Inter</a>
        <button type="button" id="btnSair">Sair</button></div></details>`;
    montarBotaoTema();
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
  // Tour de primeiro acesso (na Home), ou quando pedido pelo menu da conta.
  if (atual === "inicio" && (!usuario.tour || new URLSearchParams(location.search).has("tour"))) {
    setTimeout(() => iniciarTour(gestor), sessionStorage.getItem("gd_intro_agora") ? 2300 : 300);
  }
  return usuario;
}

// ---------- Tema claro / escuro ----------
// Sem escolha salva, segue o sistema (e acompanha quando ele muda). O botão fixa claro ou escuro.
const midiaEscura = matchMedia("(prefers-color-scheme: dark)");
const temaSalvo = () => { try { return localStorage.getItem("gd_tema"); } catch { return null; } };
const ICONE_SOL = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const ICONE_LUA = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';

function aplicarTema() {
  const tema = temaSalvo() || (midiaEscura.matches ? "escuro" : "claro");
  document.documentElement.dataset.tema = tema;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", tema === "escuro" ? "#0d1424" : "#F3F5F8");
  const b = $("#btnTema");
  if (b) {
    b.innerHTML = tema === "escuro" ? ICONE_SOL : ICONE_LUA;
    b.setAttribute("aria-label", tema === "escuro" ? "Usar modo claro" : "Usar modo escuro");
    b.title = b.getAttribute("aria-label");
  }
  const auto = $("#temaAuto");
  if (auto) auto.hidden = !temaSalvo();
}
function montarBotaoTema() {
  $("#btnTema").onclick = () => {
    const novo = document.documentElement.dataset.tema === "escuro" ? "claro" : "escuro";
    try { localStorage.setItem("gd_tema", novo); } catch { /* sem storage */ }
    aplicarTema();
  };
  $("#temaAuto").onclick = (e) => {
    e.preventDefault();
    try { localStorage.removeItem("gd_tema"); } catch { /* sem storage */ }
    aplicarTema();
  };
  aplicarTema();
}
midiaEscura.addEventListener("change", aplicarTema);
aplicarTema();

// ---------- Tour ----------
// Destaca uma parte da tela por vez, com um cartão explicando. Pula a qualquer momento.
function visivel(sel) {
  return [...document.querySelectorAll(sel)].find((el) => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden") || null;
}
function iniciarTour(gestor) {
  const area = (id) => `.abas-app a[data-area="${id}"], .menu-areas a[data-area="${id}"]`;
  const passos = [
    { titulo: "Bem-vindo(a) ao gera.documento", texto: "Em poucos passos você vê onde fica cada coisa. Leva menos de um minuto." },
    { alvo: "[data-tour=gerar]", titulo: "Gerar materiais", texto: "Comece por aqui: envie o plano de curso, escolha a UC e responda algumas perguntas. Saem o PER, o plano de aula, as avaliações com gabarito e a atividade do educador (EP-190)." },
    { alvo: area("materiais"), titulo: "Materiais", texto: "Tudo o que você gerou fica guardado aqui. Dá para baixar de novo e continuar uma geração que parou no meio." },
    { alvo: area("turmas"), titulo: "Turmas", texto: "Diário, frequência e notas de cada turma, com o roteiro de cada aula." },
    ...(gestor ? [{ alvo: area("painel"), titulo: "Painel", texto: "Andamento de todas as turmas, instrutores e o cadastro de acessos." }] : []),
    { alvo: ".conta summary", titulo: "Sua conta", texto: "Aqui você sai do sistema e pode rever este tour quando quiser." },
  ];
  let i = 0, alvo = null;
  const veu = document.createElement("div");
  veu.className = "tour-veu";
  const card = document.createElement("div");
  card.className = "tour-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-live", "polite");
  document.body.append(veu, card);
  const fim = () => {
    alvo?.classList.remove("tour-alvo");
    veu.remove(); card.remove();
    fetch("/api/auth/tour", { method: "POST" }).catch(() => {});
    if (location.search.includes("tour")) history.replaceState(null, "", location.pathname);
  };
  const mostrar = () => {
    alvo?.classList.remove("tour-alvo");
    const p = passos[i];
    alvo = p.alvo ? visivel(p.alvo) : null;
    if (p.alvo && !alvo) { i++; return i < passos.length ? mostrar() : fim(); }
    veu.classList.toggle("com-alvo", Boolean(alvo));
    const ultimo = i === passos.length - 1;
    card.innerHTML = `<h3>${p.titulo}</h3><p>${p.texto}</p><div class="tour-rodape">
      <span class="tour-pontos">${passos.map((_, k) => `<i class="${k === i ? "ativo" : ""}"></i>`).join("")}</span>
      ${ultimo ? "" : '<button type="button" class="tour-pular">Pular</button>'}
      <button type="button" class="btn-gerar">${ultimo ? "Começar" : i === 0 ? "Mostrar" : "Próximo"}</button></div>`;
    card.querySelector(".tour-pular")?.addEventListener("click", fim);
    card.querySelector(".btn-gerar").onclick = () => { i++; i < passos.length ? mostrar() : fim(); };
    card.style.left = card.style.top = "";
    if (alvo) {
      alvo.classList.add("tour-alvo");
      alvo.scrollIntoView({ block: "nearest" });
      const r = alvo.getBoundingClientRect(), ch = card.offsetHeight, cw = card.offsetWidth;
      const top = r.bottom + 14 + ch < innerHeight ? r.bottom + 14 : Math.max(16, r.top - ch - 14);
      card.style.top = `${top}px`;
      card.style.left = `${Math.min(Math.max(16, r.left + r.width / 2 - cw / 2), innerWidth - cw - 16)}px`;
    } else {
      card.style.top = `${(innerHeight - card.offsetHeight) / 2}px`;
      card.style.left = `${(innerWidth - card.offsetWidth) / 2}px`;
    }
    card.querySelector(".btn-gerar").focus();
  };
  mostrar();
}

// Atualização automática: ao voltar para o app, se saiu versão nova e nada está sendo gerado, recarrega.
let versaoAtual = null;
async function conferirVersao() {
  try {
    const { versao } = await (await fetch("/api/versao", { cache: "no-store" })).json();
    if (versaoAtual && versao !== versaoAtual && !document.querySelector(".etapa.gerando")) location.reload();
    versaoAtual = versao;
  } catch {}
}
conferirVersao();
document.addEventListener("visibilitychange", () => { if (!document.hidden) conferirVersao(); });
