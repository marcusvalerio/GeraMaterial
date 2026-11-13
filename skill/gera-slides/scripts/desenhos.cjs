// Desenhos (ilustrações flat) e ícones em SVG, nas cores do tema. Viram PNG para o .pptx.
// Ilustrações: viewBox 400x300. Ícones: viewBox 24x24, traço.
// c = { cor, cor2, destaque, escuro, ok, alerta, claro, pele }

const chao = (c, y = 262) => `<ellipse cx="200" cy="${y}" rx="180" ry="14" fill="${c.claro}"/>`;
const caixa = (c, x, y, w, h, cor = c.destaque) => `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${cor}"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h * 0.22}" rx="4" fill="#000" opacity=".12"/>
  <rect x="${x + w / 2 - w * 0.09}" y="${y}" width="${w * 0.18}" height="${h}" fill="#fff" opacity=".35"/>`;
const pessoa = (c, x, y, roupa = c.cor, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-16" y="40" width="12" height="52" rx="6" fill="${c.escuro}"/><rect x="4" y="40" width="12" height="52" rx="6" fill="${c.escuro}"/>
    <rect x="-22" y="-6" width="44" height="58" rx="18" fill="${roupa}"/>
    <circle cx="0" cy="-26" r="18" fill="${c.pele}"/>
    <path d="M-18 -30 a18 18 0 0 1 36 0 v-4 a18 18 0 0 0 -36 0z" fill="${c.escuro}"/>
  </g>`;

const ILUSTRACOES = {
  caminhao: (c) => `${chao(c)}
    <rect x="40" y="110" width="210" height="120" rx="10" fill="${c.cor}"/>
    <rect x="40" y="110" width="210" height="22" rx="10" fill="#fff" opacity=".18"/>
    <path d="M250 150 h60 l40 40 v40 h-100z" fill="${c.escuro}"/>
    <path d="M262 160 h44 l28 28 h-72z" fill="${c.cor2}" opacity=".85"/>
    <circle cx="100" cy="236" r="24" fill="${c.escuro}"/><circle cx="100" cy="236" r="10" fill="${c.claro}"/>
    <circle cx="300" cy="236" r="24" fill="${c.escuro}"/><circle cx="300" cy="236" r="10" fill="${c.claro}"/>
    ${caixa(c, 70, 70, 50, 40)}${caixa(c, 130, 80, 40, 30, c.ok)}`,
  caixas: (c) => `${chao(c)}
    ${caixa(c, 70, 170, 90, 85)}${caixa(c, 165, 170, 90, 85, c.cor2)}${caixa(c, 260, 190, 70, 65, c.ok)}
    ${caixa(c, 115, 90, 90, 80, c.cor)}${caixa(c, 210, 110, 70, 60)}
    <rect x="128" y="120" width="40" height="22" rx="3" fill="#fff"/><path d="M134 128h28M134 135h18" stroke="${c.escuro}" stroke-width="3"/>`,
  notaFiscal: (c) => `
    <rect x="95" y="20" width="210" height="260" rx="12" fill="#fff" stroke="${c.claro}" stroke-width="4"/>
    <rect x="95" y="20" width="210" height="50" rx="12" fill="${c.cor}"/><rect x="95" y="52" width="210" height="18" fill="${c.cor}"/>
    <text x="115" y="54" font-family="Inter, Arial" font-size="22" font-weight="700" fill="#fff">NF-e</text>
    ${[95, 120, 145, 170].map((y, i) => `<rect x="115" y="${y}" width="${[150, 110, 130, 90][i]}" height="10" rx="5" fill="${c.claro}"/>`).join("")}
    <rect x="115" y="200" width="170" height="2" fill="${c.claro}"/>
    <rect x="115" y="215" width="80" height="14" rx="7" fill="${c.escuro}"/><rect x="225" y="215" width="60" height="14" rx="7" fill="${c.destaque}"/>
    <g transform="translate(250 175)"><circle r="42" fill="${c.ok}"/><path d="M-18 0 l12 12 l24 -26" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`,
  checklist: (c) => `
    <rect x="110" y="30" width="180" height="245" rx="14" fill="${c.escuro}"/>
    <rect x="124" y="50" width="152" height="210" rx="8" fill="#fff"/>
    <rect x="165" y="18" width="70" height="30" rx="8" fill="${c.destaque}"/>
    ${[80, 125, 170, 215].map((y, i) => `
      <rect x="140" y="${y}" width="26" height="26" rx="6" fill="${i < 3 ? c.ok : c.claro}"/>
      ${i < 3 ? `<path d="M146 ${y + 13} l5 6 l10 -12" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>` : ""}
      <rect x="178" y="${y + 8}" width="${[80, 64, 72, 56][i]}" height="10" rx="5" fill="${c.claro}"/>`).join("")}`,
  empilhadeira: (c) => `${chao(c)}
    <rect x="270" y="40" width="12" height="200" fill="${c.escuro}"/><rect x="290" y="40" width="12" height="200" fill="${c.escuro}"/>
    <rect x="282" y="160" width="80" height="10" fill="${c.escuro}"/><rect x="282" y="225" width="80" height="10" fill="${c.escuro}"/>
    ${caixa(c, 300, 110, 60, 50)}
    <path d="M110 150 h120 v80 h-150 v-40z" fill="${c.destaque}"/>
    <path d="M150 80 h70 v70 h-90z" fill="none" stroke="${c.escuro}" stroke-width="10" stroke-linejoin="round"/>
    <rect x="80" y="190" width="30" height="40" fill="${c.escuro}"/>
    <circle cx="125" cy="235" r="26" fill="${c.escuro}"/><circle cx="125" cy="235" r="10" fill="${c.claro}"/>
    <circle cx="220" cy="240" r="20" fill="${c.escuro}"/><circle cx="220" cy="240" r="8" fill="${c.claro}"/>`,
  almoxarifado: (c) => `${chao(c, 270)}
    ${[40, 210].map((x) => `
      <rect x="${x}" y="40" width="10" height="225" fill="${c.escuro}"/><rect x="${x + 140}" y="40" width="10" height="225" fill="${c.escuro}"/>
      ${[100, 170, 240].map((y) => `<rect x="${x}" y="${y}" width="150" height="8" fill="${c.cor}"/>`).join("")}
      ${caixa(c, x + 18, 62, 50, 38)}${caixa(c, x + 78, 72, 44, 28, c.cor2)}
      ${caixa(c, x + 18, 136, 40, 34, c.ok)}${caixa(c, x + 66, 126, 64, 44)}
      ${caixa(c, x + 30, 202, 56, 38, c.cor2)}${caixa(c, x + 94, 210, 36, 30)}`).join("")}
    <rect x="70" y="20" width="60" height="16" rx="4" fill="${c.destaque}"/><text x="78" y="33" font-family="Inter, Arial" font-size="12" font-weight="700" fill="${c.escuro}">A-01</text>
    <rect x="240" y="20" width="60" height="16" rx="4" fill="${c.destaque}"/><text x="248" y="33" font-family="Inter, Arial" font-size="12" font-weight="700" fill="${c.escuro}">B-02</text>`,
  computador: (c) => `
    <rect x="70" y="40" width="260" height="170" rx="14" fill="${c.escuro}"/>
    <rect x="84" y="54" width="232" height="142" rx="6" fill="#fff"/>
    <rect x="84" y="54" width="232" height="26" fill="${c.cor}"/><text x="96" y="73" font-family="Inter, Arial" font-size="14" font-weight="700" fill="#fff">WMS</text>
    ${[92, 116, 140, 164].map((y, i) => `<rect x="98" y="${y}" width="16" height="14" rx="3" fill="${[c.ok, c.ok, c.destaque, c.claro][i]}"/>
      <rect x="122" y="${y + 3}" width="${[110, 90, 120, 70][i]}" height="8" rx="4" fill="${c.claro}"/>`).join("")}
    <rect x="250" y="92" width="52" height="86" rx="6" fill="${c.cor2}" opacity=".25"/><rect x="258" y="140" width="12" height="30" fill="${c.cor2}"/><rect x="276" y="118" width="12" height="52" fill="${c.cor}"/>
    <rect x="180" y="210" width="40" height="34" fill="${c.escuro}"/><rect x="130" y="244" width="140" height="14" rx="7" fill="${c.escuro}"/>`,
  seguranca: (c) => `${chao(c)}
    <path d="M110 160 a90 90 0 0 1 180 0 z" fill="${c.destaque}"/>
    <rect x="90" y="155" width="220" height="24" rx="12" fill="${c.destaque}"/>
    <rect x="190" y="72" width="20" height="88" rx="6" fill="#fff" opacity=".35"/>
    <path d="M270 200 l40 -70 l40 70 z" fill="${c.alerta}" stroke="${c.alerta}" stroke-width="10" stroke-linejoin="round"/>
    <rect x="305" y="155" width="10" height="26" rx="5" fill="#fff"/><circle cx="310" cy="192" r="6" fill="#fff"/>
    <g transform="translate(95 205)"><rect x="-40" y="0" width="80" height="50" rx="12" fill="${c.cor}"/><rect x="-30" y="10" width="26" height="22" rx="8" fill="${c.cor2}"/><rect x="4" y="10" width="26" height="22" rx="8" fill="${c.cor2}"/></g>`,
  equipe: (c) => `${chao(c, 270)}
    ${pessoa(c, 110, 160, c.cor2, 0.9)}${pessoa(c, 290, 160, c.ok, 0.9)}${pessoa(c, 200, 150, c.cor, 1.05)}
    <g transform="translate(250 40)"><rect width="110" height="56" rx="16" fill="#fff" stroke="${c.claro}" stroke-width="3"/><path d="M20 56 l-6 18 l22 -18z" fill="#fff"/>
      <circle cx="35" cy="28" r="6" fill="${c.cor}"/><circle cx="55" cy="28" r="6" fill="${c.cor}"/><circle cx="75" cy="28" r="6" fill="${c.cor}"/></g>`,
  instrutor: (c) => `${chao(c, 270)}
    <rect x="150" y="30" width="220" height="140" rx="10" fill="${c.escuro}"/><rect x="162" y="42" width="196" height="116" rx="6" fill="${c.cor}" opacity=".25"/>
    <path d="M180 130 l40 -30 l30 20 l50 -50" stroke="${c.destaque}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    ${pessoa(c, 90, 165, c.cor, 1.1)}<path d="M112 160 l50 -40" stroke="${c.pele}" stroke-width="10" stroke-linecap="round"/>`,
  lupa: (c) => `
    ${caixa(c, 60, 150, 110, 100, c.cor2)}${caixa(c, 180, 170, 90, 80)}
    <circle cx="230" cy="120" r="70" fill="#fff" stroke="${c.escuro}" stroke-width="16"/>
    <circle cx="230" cy="120" r="54" fill="${c.cor}" opacity=".15"/>
    <path d="M205 120 l18 18 l32 -36" stroke="${c.ok}" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="285" y="170" width="26" height="90" rx="13" fill="${c.escuro}" transform="rotate(-45 298 215)"/>`,
  fluxo: (c) => `
    ${[[40, c.cor], [160, c.cor2], [280, c.ok]].map(([x, cor], i) => `
      <rect x="${x}" y="105" width="90" height="90" rx="18" fill="${cor}"/>
      <text x="${x + 45}" y="162" text-anchor="middle" font-family="Inter, Arial" font-size="40" font-weight="800" fill="#fff">${i + 1}</text>
      ${i < 2 ? `<path d="M${x + 98} 150 h46" stroke="${c.escuro}" stroke-width="8" stroke-linecap="round"/><path d="M${x + 134} 138 l14 12 l-14 12" stroke="${c.escuro}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ""}`).join("")}`,
  alvo: (c) => `
    <circle cx="200" cy="150" r="115" fill="${c.alerta}" opacity=".9"/><circle cx="200" cy="150" r="85" fill="#fff"/>
    <circle cx="200" cy="150" r="58" fill="${c.alerta}" opacity=".9"/><circle cx="200" cy="150" r="30" fill="#fff"/><circle cx="200" cy="150" r="12" fill="${c.escuro}"/>
    <path d="M200 150 l120 -90" stroke="${c.escuro}" stroke-width="8" stroke-linecap="round"/><path d="M312 52 l26 -4 l-6 24z" fill="${c.destaque}"/>`,
  ideia: (c) => `
    <circle cx="200" cy="120" r="80" fill="${c.destaque}"/><circle cx="200" cy="120" r="80" fill="#fff" opacity=".15"/>
    <rect x="165" y="190" width="70" height="26" rx="6" fill="${c.escuro}"/><rect x="172" y="220" width="56" height="18" rx="6" fill="${c.escuro}"/>
    <path d="M182 150 q9 -22 18 0 t18 0" stroke="${c.escuro}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M190 152 v34 M210 152 v34" stroke="${c.escuro}" stroke-width="5"/>
    ${[[-120, 0], [120, 0], [0, -110], [-90, -80], [90, -80]].map(([dx, dy]) => `<path d="M${200 + dx * 0.85} ${120 + dy * 0.85} L${200 + dx} ${120 + dy}" stroke="${c.destaque}" stroke-width="8" stroke-linecap="round"/>`).join("")}`,
  relogio: (c) => `
    <circle cx="200" cy="150" r="110" fill="${c.cor}"/><circle cx="200" cy="150" r="90" fill="#fff"/>
    ${Array.from({ length: 12 }, (_, i) => `<rect x="197" y="66" width="6" height="14" rx="3" fill="${c.escuro}" transform="rotate(${i * 30} 200 150)"/>`).join("")}
    <path d="M200 150 v-56" stroke="${c.escuro}" stroke-width="9" stroke-linecap="round"/><path d="M200 150 l40 26" stroke="${c.destaque}" stroke-width="9" stroke-linecap="round"/><circle cx="200" cy="150" r="9" fill="${c.escuro}"/>`,
  trofeu: (c) => `${chao(c, 268)}
    <path d="M140 50 h120 v60 a60 60 0 0 1 -120 0z" fill="${c.destaque}"/>
    <path d="M140 70 h-30 a30 30 0 0 0 36 40 M260 70 h30 a30 30 0 0 1 -36 40" stroke="${c.destaque}" stroke-width="12" fill="none"/>
    <rect x="188" y="168" width="24" height="40" fill="${c.destaque}"/><rect x="150" y="206" width="100" height="44" rx="8" fill="${c.escuro}"/>
    <path d="M200 80 l9 18 l20 3 l-15 14 l4 20 l-18 -10 l-18 10 l4 -20 l-15 -14 l20 -3z" fill="#fff" opacity=".9"/>`,
};

// Ícones de traço (24x24) para cartões e listas.
const ICONES = {
  caminhao: '<path d="M1 6h13v10H1zM14 10h4l3 3v3h-7z"/><circle cx="5.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/>',
  caixa: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  documento: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h8M9 17h6"/>',
  check: '<circle cx="12" cy="12" r="10"/><path d="M7 12l3.5 3.5L17 9"/>',
  alerta: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  lupa: '<circle cx="11" cy="11" r="7"/><path d="M16 16l5 5"/>',
  computador: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  pessoas: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c3 0 5 2 5 5"/>',
  relogio: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  escudo: '<path d="M12 2l8 3v7c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  capacete: '<path d="M3 17h18M5 17a7 7 0 0 1 14 0M12 6v5"/>',
  setas: '<path d="M4 12h14M14 7l5 5-5 5"/>',
  grafico: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  alvo: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  ideia: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
  balanca: '<path d="M12 3v18M5 21h14M5 7h14"/><path d="M5 7l-3 7h6zM19 7l-3 7h6z"/>',
  estoque: '<path d="M3 21V8l9-5 9 5v13"/><path d="M7 21v-8h10v8M7 17h10"/>',
  codigo: '<path d="M3 5v14M6 5v14M10 5v14M13 5v14M17 5v14M21 5v14"/>',
  pergunta: '<circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7v.5M12 17v.5"/>',
  livro: '<path d="M4 4h6a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3"/><path d="M20 4v15h-7"/>',
};

const hex = (h) => `#${String(h).replace("#", "")}`;
function paleta(T) {
  return { cor: hex(T.cor), cor2: hex(T.cor2), destaque: hex(T.destaque), escuro: hex(T.escuro), ok: hex(T.ok), alerta: hex(T.alerta), claro: "#E2E8F0", pele: "#F1C7A5" };
}

function ilustracaoSvg(nome, T) {
  const f = ILUSTRACOES[nome];
  if (!f) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="800" height="600">${f(paleta(T))}</svg>`;
}
function iconeSvg(nome, cor, tamanho = 128) {
  const p = ICONES[nome];
  if (!p) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${tamanho}" height="${tamanho}" fill="none" stroke="${hex(cor)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}
// Fundo com gradiente suave e formas (para slides claros e escuros).
function fundoSvg(T, escuro, semente = 0) {
  const c = paleta(T), a = semente % 3;
  const base = escuro ? `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.escuro}"/><stop offset="1" stop-color="${c.cor}" stop-opacity=".55"/></linearGradient>`
    : `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="${hex(T.fundo)}"/></linearGradient>`;
  const formas = escuro
    ? `<circle cx="${[1200, 1150, 1250][a]}" cy="${[120, 650, 380][a]}" r="380" fill="${c.cor}" opacity=".35"/><circle cx="${[1050, 1250, 150][a]}" cy="${[700, 100, 720][a]}" r="240" fill="${c.cor2}" opacity=".25"/>`
    : `<circle cx="${[1290, 1300, 1280][a]}" cy="${[60, 700, 40][a]}" r="${[220, 180, 160][a]}" fill="${c.cor}" opacity=".06"/><circle cx="${[1180, 40, 60][a]}" cy="${[740, 720, 760][a]}" r="140" fill="${c.destaque}" opacity=".07"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1333 750" width="1600" height="900"><defs>${base}</defs><rect width="1333" height="750" fill="url(#g)"/>${formas}</svg>`;
}

module.exports = { ilustracaoSvg, iconeSvg, fundoSvg, ILUSTRACOES: Object.keys(ILUSTRACOES), ICONES: Object.keys(ICONES) };
