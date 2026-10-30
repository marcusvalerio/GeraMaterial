// Gera a apresentação (PPTX) no padrão visual do modelo do professor:
// fundo off-white, azul-marinho, Arial, cards com faixa azul no topo, "olho" (rótulo) acima do título,
// rodapé com curso | UC e nome do professor. Ícones vetoriais (Lucide) — nunca emojis.
import PptxGenJS from "pptxgenjs";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const C = {
  fundo: "F6F6F3", navy: "002F6C", azul: "005DAA", azulClaro: "6FB1F0", azulFundo: "EAF2FB",
  texto: "0B1A2E", cinza: "5B6675", borda: "D9DEE5", branco: "FFFFFF", vermelho: "C8102E",
  vermelhoFundo: "FBECEE", verde: "1E8E3E",
};
const F = "Arial";
const W = 13.333, H = 7.5, MX = 0.6;

const txt = (v) => String(v ?? "").replace(/\p{Extended_Pictographic}️?/gu, "").trim();
const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const num = (i) => String(i + 1).padStart(2, "0");

// ---------- Ícones (Lucide → PNG) ----------
const require = createRequire(import.meta.url);
const PASTA_ICONES = path.join(path.dirname(require.resolve("lucide-static/package.json")), "icons");
export const ICONES = [
  "target", "lightbulb", "users", "user", "handshake", "message-circle", "messages-square", "clipboard-list",
  "clipboard-check", "check-circle", "list-checks", "file-text", "book-open", "graduation-cap", "brain",
  "search", "zoom-in", "chart-bar", "chart-line", "chart-pie", "trending-up", "trending-down", "gauge",
  "settings", "wrench", "hammer", "cog", "factory", "package", "truck", "warehouse", "boxes",
  "shield-check", "shield-alert", "triangle-alert", "circle-alert", "ban", "lock", "scale", "gavel",
  "dollar-sign", "wallet", "calculator", "receipt", "percent", "clock", "calendar", "timer", "hourglass",
  "workflow", "git-branch", "network", "layers", "puzzle", "repeat", "refresh-cw", "arrow-right-left",
  "zap", "flame", "leaf", "recycle", "globe", "map-pin", "building-2", "store", "cpu", "monitor",
  "database", "server", "wifi", "plug", "battery", "thermometer", "ruler", "microscope", "flask-conical",
  "hard-hat", "heart-pulse", "star", "award", "trophy", "flag", "rocket", "compass", "eye", "pencil",
  "sticky-note", "presentation", "megaphone", "phone", "mail", "help-circle", "info", "thumbs-up",
];
const cacheIcone = new Map();
function icone(nome, cor) {
  const n = ICONES.includes(nome) ? nome : "circle-dot";
  const chave = `${n}:${cor}`;
  if (cacheIcone.has(chave)) return cacheIcone.get(chave);
  let arq = path.join(PASTA_ICONES, `${n}.svg`);
  if (!existsSync(arq)) arq = path.join(PASTA_ICONES, "circle-dot.svg");
  const svg = readFileSync(arq, "utf8").replace(/currentColor/g, `#${cor}`);
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 160 } }).render().asPng();
  const dado = `image/png;base64,${png.toString("base64")}`;
  cacheIcone.set(chave, dado);
  return dado;
}
function addIcone(s, nome, x, y, tam, cor = C.azul) {
  s.addImage({ data: icone(nome, cor), x, y, w: tam, h: tam });
}

// ---------- Peças comuns ----------
function olhoTitulo(s, olho, titulo) {
  if (olho) s.addText(txt(olho).toUpperCase(), { x: MX, y: 0.38, w: W - 2 * MX, h: 0.28, fontFace: F, fontSize: 10, bold: true, color: C.azul, charSpacing: 1 });
  s.addText(txt(titulo), { x: MX, y: 0.66, w: W - 2 * MX, h: 0.7, fontFace: F, fontSize: 26, bold: true, color: C.texto, valign: "middle", fit: "shrink" });
}
function rodape(s, m, n, escuro = false) {
  const cor = escuro ? C.azulClaro : C.cinza;
  s.addText(txt(m.rodape), { x: MX, y: H - 0.42, w: 6, h: 0.25, fontFace: F, fontSize: 8, color: cor });
  s.addText(txt(m.professor), { x: 5.4, y: H - 0.42, w: 4, h: 0.25, fontFace: F, fontSize: 8, color: cor });
  s.addText(String(n), { x: W - MX - 1, y: H - 0.42, w: 1, h: 0.25, fontFace: F, fontSize: 8, color: cor, align: "right" });
}
function caixa(s, x, y, w, h, { topo = C.azul, fundo = C.branco, borda = C.borda } = {}) {
  s.addShape("rect", { x, y, w, h, fill: { color: fundo }, line: { color: borda, width: 0.75 } });
  if (topo) s.addShape("rect", { x, y, w, h: 0.06, fill: { color: topo }, line: { type: "none" } });
}
function nota(s, texto, y = 6.45) {
  if (!texto) return;
  s.addText(txt(texto), { x: MX, y, w: W - 2 * MX, h: 0.45, fontFace: F, fontSize: 11, italic: true, color: C.azul, valign: "top", fit: "shrink" });
}
function rotulo(s, t, x, y, w, cor = C.azul) {
  s.addText(txt(t).toUpperCase(), { x, y, w, h: 0.22, fontFace: F, fontSize: 8, bold: true, color: cor, charSpacing: 1 });
}

// ---------- Layouts ----------
const L = {
  capa(s, d, m) {
    s.background = { color: C.fundo };
    s.addShape("rect", { x: 8.55, y: 0, w: W - 8.55, h: H, fill: { color: C.navy }, line: { type: "none" } });
    s.addText(txt(d.olho || m.rodape).toUpperCase(), { x: MX, y: 0.55, w: 7.5, h: 0.3, fontFace: F, fontSize: 10, bold: true, color: C.azul, charSpacing: 1 });
    s.addText(txt(d.contexto), { x: MX, y: 0.9, w: 7.5, h: 0.35, fontFace: F, fontSize: 13, color: C.cinza });
    if (d.modulo) s.addText(txt(d.modulo).toUpperCase(), { x: MX, y: 2.55, w: 7.5, h: 0.3, fontFace: F, fontSize: 11, bold: true, color: C.azul });
    s.addText(txt(d.titulo), { x: MX, y: 2.9, w: 7.6, h: 1.8, fontFace: F, fontSize: 38, bold: true, color: C.texto, valign: "top", fit: "shrink" });
    s.addShape("line", { x: MX, y: 5.55, w: 7.4, h: 0, line: { color: C.navy, width: 1.5 } });
    s.addText(txt(d.professor || m.professor), { x: MX, y: 5.7, w: 7.5, h: 0.35, fontFace: F, fontSize: 14, bold: true, color: C.navy });
    s.addText(txt(d.subtitulo), { x: MX, y: 6.05, w: 7.5, h: 0.3, fontFace: F, fontSize: 10, color: C.cinza });
    arr(d.lateral).slice(0, 4).forEach((it, i) => {
      const y = 1.0 + i * 1.45;
      s.addText(txt(it.rotulo).toUpperCase(), { x: 9.0, y, w: 3.8, h: 0.25, fontFace: F, fontSize: 8, bold: true, color: C.azulClaro });
      s.addText(txt(it.texto), { x: 9.0, y: y + 0.27, w: 3.8, h: 0.75, fontFace: F, fontSize: 11, color: C.branco, valign: "top", fit: "shrink" });
    });
  },
  abertura(s, d, m) {
    s.background = { color: C.navy };
    s.addText(txt(d.olho || "Aula").toUpperCase(), { x: MX, y: 0.8, w: 5, h: 0.3, fontFace: F, fontSize: 10, bold: true, color: C.azulClaro });
    s.addText(txt(d.numero), { x: MX, y: 1.1, w: 6, h: 1.8, fontFace: F, fontSize: 96, bold: true, color: C.branco });
    s.addText(txt(d.titulo), { x: MX, y: 3.1, w: 7.6, h: 1.7, fontFace: F, fontSize: 32, bold: true, color: C.branco, valign: "top", fit: "shrink" });
    s.addText(txt(d.subtitulo), { x: MX, y: 5.0, w: 7.6, h: 0.4, fontFace: F, fontSize: 12, color: C.azulClaro });
    s.addShape("line", { x: 9.1, y: 0.9, w: 0, h: 5.4, line: { color: C.azul, width: 1 } });
    s.addText("NESTA AULA", { x: 9.4, y: 0.9, w: 3.5, h: 0.25, fontFace: F, fontSize: 8, bold: true, color: C.azulClaro });
    arr(d.itens).slice(0, 6).forEach((t, i) => {
      const y = 1.35 + i * 0.75;
      s.addText(num(i), { x: 9.4, y, w: 0.5, h: 0.5, fontFace: F, fontSize: 9, color: C.azulClaro, valign: "top" });
      s.addText(txt(t), { x: 9.9, y, w: 3.0, h: 0.6, fontFace: F, fontSize: 11, color: C.branco, valign: "top", fit: "shrink" });
    });
  },
  objetivos(s, d) {
    olhoTitulo(s, d.olho, d.titulo || "Ao final desta aula, você será capaz de:");
    const it = arr(d.itens).slice(0, 6);
    it.forEach((t, i) => {
      const col = i % 2, lin = Math.floor(i / 2);
      const x = MX + col * 6.2, y = 1.75 + lin * 1.45;
      s.addText(num(i), { x, y, w: 0.8, h: 0.6, fontFace: F, fontSize: 22, bold: true, color: C.azul, valign: "top" });
      s.addText(txt(t), { x: x + 0.85, y: y + 0.05, w: 5.1, h: 1.1, fontFace: F, fontSize: 14, color: C.texto, valign: "top", fit: "shrink" });
    });
  },
  conceito(s, d) {
    olhoTitulo(s, d.olho, d.titulo);
    s.addText(txt(d.texto), { x: MX, y: 1.45, w: W - 2 * MX, h: 0.8, fontFace: F, fontSize: 14, color: C.texto, valign: "top", fit: "shrink" });
    const cs = arr(d.cards).slice(0, 6);
    const gap = 0.15, w = (W - 2 * MX - gap * (cs.length - 1)) / Math.max(cs.length, 1);
    cs.forEach((c, i) => {
      const x = MX + i * (w + gap);
      caixa(s, x, 2.45, w, 1.55);
      if (c.icone) addIcone(s, c.icone, x + 0.15, 2.65, 0.32);
      s.addText(txt(c.titulo), { x: x + 0.15, y: c.icone ? 3.02 : 2.62, w: w - 0.3, h: 0.32, fontFace: F, fontSize: 13, bold: true, color: C.texto, fit: "shrink" });
      s.addText(txt(c.texto), { x: x + 0.15, y: c.icone ? 3.35 : 2.98, w: w - 0.3, h: 0.6, fontFace: F, fontSize: 10, color: C.cinza, valign: "top", fit: "shrink" });
    });
    if (d.exemplo) {
      caixa(s, MX, 4.35, W - 2 * MX, 1.6, { topo: C.navy });
      rotulo(s, d.exemplo.rotulo || "Na rotina", MX + 0.25, 4.55, 5);
      s.addText(txt(d.exemplo.titulo), { x: MX + 0.25, y: 4.8, w: W - 2 * MX - 0.5, h: 0.3, fontFace: F, fontSize: 13, bold: true, color: C.texto });
      s.addText(txt(d.exemplo.texto), { x: MX + 0.25, y: 5.12, w: W - 2 * MX - 0.5, h: 0.75, fontFace: F, fontSize: 11, color: C.cinza, valign: "top", fit: "shrink" });
    }
    nota(s, d.nota);
  },
  cards(s, d) {
    olhoTitulo(s, d.olho, d.titulo);
    const cs = arr(d.cards).slice(0, 4);
    const gap = 0.25, w = (W - 2 * MX - gap * (cs.length - 1)) / Math.max(cs.length, 1);
    const destaque = Number.isInteger(d.destaque) ? d.destaque : -1;
    cs.forEach((c, i) => {
      const x = MX + i * (w + gap), escuro = i === destaque;
      if (escuro) s.addShape("rect", { x, y: 1.7, w, h: 3.6, fill: { color: C.azul }, line: { type: "none" } });
      else caixa(s, x, 1.7, w, 3.6);
      const corT = escuro ? C.branco : C.texto, corS = escuro ? "DCE8F8" : C.cinza;
      s.addText(num(i), { x: x + 0.25, y: 1.95, w: 1, h: 0.25, fontFace: F, fontSize: 9, color: escuro ? C.azulClaro : C.azul });
      if (c.icone) addIcone(s, c.icone, x + w - 0.75, 1.92, 0.45, escuro ? C.branco : C.azul);
      s.addText(txt(c.titulo), { x: x + 0.25, y: 2.35, w: w - 0.5, h: 0.5, fontFace: F, fontSize: 18, bold: true, color: corT, fit: "shrink" });
      s.addText(txt(c.texto), { x: x + 0.25, y: 2.9, w: w - 0.5, h: 1.2, fontFace: F, fontSize: 12, color: corS, valign: "top", fit: "shrink" });
      if (c.citacao) s.addText(`“${txt(c.citacao)}”`, { x: x + 0.25, y: 4.2, w: w - 0.5, h: 0.9, fontFace: F, fontSize: 11, italic: true, color: corS, valign: "top", fit: "shrink" });
    });
    nota(s, d.nota, 5.6);
  },
  jornada(s, d) {
    olhoTitulo(s, d.olho, d.titulo);
    const ps = arr(d.passos).slice(0, 5);
    const gap = 0.2, w = (W - 2 * MX - gap * (ps.length - 1)) / Math.max(ps.length, 1);
    s.addShape("line", { x: MX + w / 2, y: 1.95, w: (w + gap) * (ps.length - 1), h: 0, line: { color: C.borda, width: 1.5 } });
    ps.forEach((p, i) => {
      const x = MX + i * (w + gap), cx = x + w / 2 - 0.22;
      s.addShape("ellipse", { x: cx, y: 1.73, w: 0.44, h: 0.44, fill: { color: i === 0 ? C.azul : C.branco }, line: { color: C.azul, width: 1.25 } });
      s.addText(String(i + 1), { x: cx, y: 1.73, w: 0.44, h: 0.44, align: "center", valign: "middle", fontFace: F, fontSize: 11, bold: true, color: i === 0 ? C.branco : C.azul });
      caixa(s, x, 2.5, w, 2.6);
      if (p.icone) addIcone(s, p.icone, x + 0.2, 2.7, 0.34);
      rotulo(s, p.rotulo, x + 0.2, p.icone ? 3.12 : 2.7, w - 0.4);
      s.addText(txt(p.titulo), { x: x + 0.2, y: p.icone ? 3.35 : 2.95, w: w - 0.4, h: 0.4, fontFace: F, fontSize: 15, bold: true, color: C.texto, fit: "shrink" });
      s.addText(txt(p.texto), { x: x + 0.2, y: p.icone ? 3.78 : 3.4, w: w - 0.4, h: 1.2, fontFace: F, fontSize: 11, color: C.cinza, valign: "top", fit: "shrink" });
    });
    nota(s, d.nota, 5.45);
  },
  fluxo(s, d) {
    olhoTitulo(s, d.olho, d.titulo);
    const ps = arr(d.passos).slice(0, 6);
    const gap = 0.35, w = (W - 2 * MX - gap * (ps.length - 1)) / Math.max(ps.length, 1);
    const dest = Number.isInteger(d.destaque) ? d.destaque : -1;
    ps.forEach((p, i) => {
      const x = MX + i * (w + gap), escuro = i === dest;
      if (escuro) s.addShape("rect", { x, y: 1.7, w, h: 0.9, fill: { color: C.azul }, line: { type: "none" } });
      else caixa(s, x, 1.7, w, 0.9, { topo: null });
      s.addText(txt(p.titulo ?? p), { x: x + 0.08, y: 1.7, w: w - 0.16, h: 0.9, align: "center", valign: "middle", fontFace: F, fontSize: 11, bold: true, color: escuro ? C.branco : C.texto, fit: "shrink" });
      if (i < ps.length - 1) s.addText("→", { x: x + w, y: 1.7, w: gap, h: 0.9, align: "center", valign: "middle", fontFace: F, fontSize: 14, color: C.cinza });
    });
    [[d.esquerda, C.azul, C.branco], [d.direita, C.vermelho, C.branco]].forEach(([b, cor], k) => {
      if (!b) return;
      const x = MX + k * 6.17;
      caixa(s, x, 3.0, 5.95, 2.6, { topo: cor });
      rotulo(s, b.rotulo, x + 0.25, 3.2, 5.4, cor);
      s.addText(txt(b.titulo), { x: x + 0.25, y: 3.45, w: 5.4, h: 0.35, fontFace: F, fontSize: 14, bold: true, color: C.texto });
      s.addText(txt(b.texto), { x: x + 0.25, y: 3.85, w: 5.4, h: 1.6, fontFace: F, fontSize: 12, color: C.cinza, valign: "top", fit: "shrink" });
    });
    nota(s, d.nota, 5.85);
  },
  comparacao(s, d) {
    olhoTitulo(s, d.olho, d.titulo);
    [[d.esquerda, C.fundo === "" ? C.azul : C.azul, false], [d.direita, C.azul, true]].forEach(([b, cor, claro], k) => {
      b = b || {};
      const x = MX + k * 6.17;
      caixa(s, x, 1.7, 5.95, 4.6, { topo: cor, fundo: claro ? C.azulFundo : C.branco });
      rotulo(s, b.rotulo, x + 0.3, 1.95, 5.3);
      if (b.icone) addIcone(s, b.icone, x + 5.15, 1.95, 0.45);
      s.addText(txt(b.titulo), { x: x + 0.3, y: 2.22, w: 4.8, h: 0.45, fontFace: F, fontSize: 18, bold: true, color: C.texto, fit: "shrink" });
      s.addText(arr(b.itens).slice(0, 5).map((t) => ({ text: txt(t), options: { bullet: true, paraSpaceAfter: 6 } })),
        { x: x + 0.3, y: 2.8, w: 5.35, h: 1.8, fontFace: F, fontSize: 12, color: C.texto, valign: "top", fit: "shrink" });
      if (b.exemplo) {
        s.addShape("rect", { x: x + 0.3, y: 4.7, w: 5.35, h: 1.4, fill: { color: claro ? C.branco : C.fundo }, line: { color: C.borda, width: 0.5 } });
        rotulo(s, "Exemplo", x + 0.45, 4.82, 5);
        s.addText(txt(b.exemplo), { x: x + 0.45, y: 5.05, w: 5.05, h: 0.95, fontFace: F, fontSize: 10, color: C.cinza, valign: "top", fit: "shrink" });
      }
    });
  },
  lista(s, d) {
    olhoTitulo(s, d.olho, d.titulo);
    const it = arr(d.itens).slice(0, 5);
    const h = Math.min(1.0, 4.6 / Math.max(it.length, 1));
    it.forEach((t, i) => {
      const y = 1.7 + i * (h + 0.12);
      s.addShape("rect", { x: MX, y, w: 0.06, h, fill: { color: C.azul }, line: { type: "none" } });
      s.addShape("rect", { x: MX + 0.06, y, w: W - 2 * MX - 0.06, h, fill: { color: C.branco }, line: { color: C.borda, width: 0.5 } });
      if (t.icone) addIcone(s, t.icone, MX + 0.3, y + h / 2 - 0.17, 0.34);
      s.addText(txt(t.titulo ?? t), { x: MX + (t.icone ? 0.8 : 0.3), y, w: 3.4, h, fontFace: F, fontSize: 14, bold: true, color: C.texto, valign: "middle", fit: "shrink" });
      if (t.texto) s.addText(txt(t.texto), { x: MX + 4.4, y, w: W - 2 * MX - 4.6, h, fontFace: F, fontSize: 12, color: C.cinza, valign: "middle", fit: "shrink" });
    });
    nota(s, d.nota);
  },
  escala(s, d) {
    olhoTitulo(s, d.olho, d.titulo);
    s.addText(txt(d.texto), { x: MX, y: 1.45, w: W - 2 * MX, h: 0.5, fontFace: F, fontSize: 13, color: C.texto, fit: "shrink" });
    const pts = arr(d.pontos).slice(0, 3);
    const cores = [C.verde, C.azul, C.vermelho];
    s.addShape("line", { x: 1.6, y: 2.75, w: W - 3.2, h: 0, line: { color: C.borda, width: 2 } });
    pts.forEach((p, i) => {
      const cx = 1.6 + (i * (W - 3.2)) / Math.max(pts.length - 1, 1);
      s.addShape("ellipse", { x: cx - 0.17, y: 2.58, w: 0.34, h: 0.34, fill: { color: cores[i] }, line: { color: C.branco, width: 2 } });
      s.addText(txt(p.rotulo), { x: cx - 1.5, y: 3.05, w: 3, h: 0.3, align: "center", fontFace: F, fontSize: 11, bold: true, color: C.texto });
      s.addText(txt(p.valor), { x: cx - 1.5, y: 3.35, w: 3, h: 0.4, align: "center", fontFace: F, fontSize: 16, bold: true, color: cores[i] });
    });
    arr(d.cards).slice(0, 2).forEach((c, k) => {
      const x = MX + k * 6.17;
      caixa(s, x, 4.15, 5.95, 1.7);
      s.addText(txt(c.titulo), { x: x + 0.25, y: 4.35, w: 5.4, h: 0.3, fontFace: F, fontSize: 13, bold: true, color: C.texto });
      s.addText(txt(c.texto), { x: x + 0.25, y: 4.7, w: 5.4, h: 1.05, fontFace: F, fontSize: 11, color: C.cinza, valign: "top", fit: "shrink" });
    });
    nota(s, d.nota, 6.1);
  },
  tabela(s, d) {
    olhoTitulo(s, d.olho, d.titulo);
    const cab = arr(d.cabecalho).map((c) => ({ text: txt(c), options: { bold: true, color: C.branco, fill: { color: C.navy } } }));
    const linhas = arr(d.linhas).slice(0, 8).map((l) => arr(l).map((c, j) => ({ text: txt(c), options: { bold: j === 0, color: C.texto } })));
    s.addTable([cab, ...linhas], { x: MX, y: 1.6, w: W - 2 * MX, fontFace: F, fontSize: 11, border: { type: "solid", color: C.borda, pt: 0.75 },
      fill: { color: C.branco }, valign: "middle", margin: 0.08, autoPage: false });
    if (d.alertas) {
      rotulo(s, d.alertasTitulo || "Erros comuns", MX, 5.35, 5, C.vermelho);
      arr(d.alertas).slice(0, 3).forEach((a, i) => {
        const w = (W - 2 * MX - 0.3) / 3, x = MX + i * (w + 0.15);
        s.addShape("rect", { x, y: 5.62, w, h: 0.6, fill: { color: C.vermelhoFundo }, line: { color: C.vermelho, width: 0.75 } });
        s.addText(txt(a), { x: x + 0.15, y: 5.62, w: w - 0.3, h: 0.6, fontFace: F, fontSize: 11, bold: true, color: C.texto, valign: "middle", fit: "shrink" });
      });
    } else nota(s, d.nota);
  },
  caso(s, d) {
    olhoTitulo(s, d.olho, d.titulo);
    s.addShape("rect", { x: MX, y: 1.7, w: 5.6, h: 4.6, fill: { color: C.navy }, line: { type: "none" } });
    rotulo(s, d.rotulo || "Situação", MX + 0.3, 1.95, 5, C.azulClaro);
    s.addText(txt(d.situacao), { x: MX + 0.3, y: 2.25, w: 5.0, h: 3.85, fontFace: F, fontSize: 13, color: C.branco, valign: "top", fit: "shrink" });
    rotulo(s, d.tempo ? `Em grupo · ${d.tempo}` : "Para discutir", 6.6, 1.75, 6);
    arr(d.perguntas).slice(0, 5).forEach((p, i) => {
      const y = 2.1 + i * 0.85;
      s.addShape("ellipse", { x: 6.6, y, w: 0.38, h: 0.38, fill: { color: C.azul }, line: { type: "none" } });
      s.addText(String(i + 1), { x: 6.6, y, w: 0.38, h: 0.38, align: "center", valign: "middle", fontFace: F, fontSize: 10, bold: true, color: C.branco });
      s.addText(txt(p), { x: 7.15, y: y - 0.05, w: 5.55, h: 0.75, fontFace: F, fontSize: 12, color: C.texto, valign: "top", fit: "shrink" });
    });
  },
  atividade(s, d) {
    olhoTitulo(s, d.olho || (d.tempo ? `Atividade · ${d.tempo}` : "Atividade"), d.titulo);
    caixa(s, MX, 1.7, 7.6, 4.6);
    rotulo(s, "Passo a passo", MX + 0.3, 1.95, 5);
    s.addText(arr(d.instrucoes).slice(0, 7).map((t) => ({ text: txt(t), options: { bullet: { type: "number" }, paraSpaceAfter: 8 } })),
      { x: MX + 0.3, y: 2.3, w: 7.0, h: 3.85, fontFace: F, fontSize: 13, color: C.texto, valign: "top", fit: "shrink" });
    s.addShape("rect", { x: 8.45, y: 1.7, w: W - MX - 8.45, h: 4.6, fill: { color: C.azulFundo }, line: { type: "none" } });
    addIcone(s, "clipboard-check", 8.75, 1.95, 0.45);
    rotulo(s, "Entrega", 8.75, 2.6, 3.5);
    s.addText(txt(d.entrega), { x: 8.75, y: 2.9, w: 3.65, h: 3.2, fontFace: F, fontSize: 14, bold: true, color: C.texto, valign: "top", fit: "shrink" });
  },
  questoes(s, d) {
    olhoTitulo(s, d.olho, d.titulo);
    arr(d.itens).slice(0, 6).forEach((p, i) => {
      const y = 1.6 + i * 0.78;
      s.addShape("ellipse", { x: MX, y, w: 0.38, h: 0.38, fill: { color: C.azul }, line: { type: "none" } });
      s.addText(String(i + 1), { x: MX, y, w: 0.38, h: 0.38, align: "center", valign: "middle", fontFace: F, fontSize: 10, bold: true, color: C.branco });
      s.addText(txt(p), { x: MX + 0.55, y: y - 0.05, w: W - 2 * MX - 0.6, h: 0.7, fontFace: F, fontSize: 13, color: C.texto, valign: "top", fit: "shrink" });
    });
    nota(s, d.nota);
  },
  sintese(s, d) {
    s.addShape("rect", { x: 0, y: 0, w: 4.4, h: H, fill: { color: C.azulFundo }, line: { type: "none" } });
    s.addText(txt(d.olho || "Síntese").toUpperCase(), { x: MX, y: 1.6, w: 3.4, h: 0.3, fontFace: F, fontSize: 10, bold: true, color: C.azul });
    s.addText(txt(d.titulo || "O que levamos desta aula"), { x: MX, y: 1.95, w: 3.4, h: 1.3, fontFace: F, fontSize: 24, bold: true, color: C.texto, valign: "top", fit: "shrink" });
    if (d.frase) s.addText(`“${txt(d.frase)}”`, { x: MX, y: 3.5, w: 3.3, h: 1.2, fontFace: F, fontSize: 12, italic: true, color: C.azul, valign: "top", fit: "shrink" });
    arr(d.itens).slice(0, 6).forEach((t, i) => {
      const y = 0.9 + i * 0.95;
      s.addText(num(i), { x: 4.9, y, w: 0.6, h: 0.5, fontFace: F, fontSize: 14, bold: true, color: C.azul, valign: "top" });
      s.addText(txt(t), { x: 5.6, y, w: 7.1, h: 0.6, fontFace: F, fontSize: 13, color: C.texto, valign: "top", fit: "shrink" });
      if (i < 5) s.addShape("line", { x: 4.9, y: y + 0.78, w: 7.8, h: 0, line: { color: C.borda, width: 0.5 } });
    });
  },
};
// Nomes antigos continuam funcionando.
Object.assign(L, { passos: L.jornada, topicos: L.lista, resumo: L.sintese, secao: L.abertura, exemplo: L.caso,
  destaque: L.conceito, encerramento: L.sintese });

function normalizar(m) {
  if (Array.isArray(m.slides)) return m;
  const slides = [{ layout: "capa", titulo: m.titulo, subtitulo: m.subtitulo }];
  for (const s of m.secoes || []) slides.push({ layout: "lista", titulo: s.titulo, itens: [...(s.paragrafos || []), ...(s.itens || [])] });
  return { ...m, slides };
}

export async function gerarSlides(m) {
  m = normalizar(m);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = txt(m.titulo);
  m.slides.forEach((d, i) => {
    const s = pptx.addSlide();
    s.background = { color: C.fundo };
    (L[d.layout] || L.lista)(s, d, m);
    if (d.layout !== "capa") rodape(s, m, i + 1, d.layout === "abertura" || d.layout === "secao");
  });
  return pptx.write({ outputType: "nodebuffer" });
}
