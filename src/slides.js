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
// Tipografia: títulos em Geist Serif, texto em Inter, rótulos/números/rodapé em Geist (sans).
const F = "Inter";
const FT = "Geist Serif";
const FL = "Geist";
// Escala de fonte: todos os tamanhos passam por fs() (fácil ajustar num lugar só).
const ESCALA = 1.25;
const fs = (n) => Math.round(n * ESCALA);
const W = 13.333, H = 7.5, MX = 0.6;

const txt = (v) => String(v ?? "").replace(/\p{Extended_Pictographic}️?/gu, "").trim();
const semNum = (v) => txt(v).replace(/^\d+\s*[.)\-–]\s*/, "");
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
  if (olho) s.addText(txt(olho).toUpperCase(), { x: MX, y: 0.38, w: W - 2 * MX, h: 0.28, fontFace: FL, fontSize: fs(10), bold: true, color: C.azul, charSpacing: 1 });
  s.addText(txt(titulo), { x: MX, y: 0.66, w: W - 2 * MX, h: 0.75, fontFace: FT, fontSize: 34, color: C.texto, valign: "middle", fit: "shrink" });
}
function rodape(s, m, n, escuro = false) {
  const cor = escuro ? C.azulClaro : C.cinza;
  s.addText(txt(m.rodape), { x: MX, y: H - 0.42, w: 6, h: 0.25, fontFace: FL, fontSize: fs(8), color: cor });
  s.addText(txt(m.professor), { x: 5.4, y: H - 0.42, w: 4, h: 0.25, fontFace: FL, fontSize: fs(8), color: cor });
  s.addText(String(n), { x: W - MX - 1, y: H - 0.42, w: 1, h: 0.25, fontFace: FL, fontSize: fs(8), color: cor, align: "right" });
}
function caixa(s, x, y, w, h, { topo = C.azul, fundo = C.branco, borda = C.borda } = {}) {
  s.addShape("rect", { x, y, w, h, fill: { color: fundo }, line: { color: borda, width: 0.75 } });
  if (topo) s.addShape("rect", { x, y, w, h: 0.06, fill: { color: topo }, line: { type: "none" } });
}
function nota(s, texto, y = 6.45) {
  if (!texto) return;
  s.addText(txt(texto), { x: MX, y, w: W - 2 * MX, h: 0.45, fontFace: F, fontSize: fs(11), italic: true, color: C.azul, valign: "top", fit: "shrink" });
}
function rotulo(s, t, x, y, w, cor = C.azul) {
  s.addText(txt(t).toUpperCase(), { x, y, w, h: 0.22, fontFace: FL, fontSize: fs(8), bold: true, color: cor, charSpacing: 1 });
}

// ---------- Layouts ----------
const L = {
  capa(s, d, m) {
    s.background = { color: C.fundo };
    s.addShape("rect", { x: 8.55, y: 0, w: W - 8.55, h: H, fill: { color: C.navy }, line: { type: "none" } });
    s.addText(txt(d.olho || m.rodape).toUpperCase(), { x: MX, y: 0.55, w: 7.5, h: 0.3, fontFace: FL, fontSize: fs(10), bold: true, color: C.azul, charSpacing: 1 });
    s.addText(txt(d.contexto), { x: MX, y: 0.9, w: 7.5, h: 0.35, fontFace: F, fontSize: fs(13), color: C.cinza });
    if (d.modulo) s.addText(txt(d.modulo).toUpperCase(), { x: MX, y: 2.55, w: 7.5, h: 0.3, fontFace: F, fontSize: fs(11), bold: true, color: C.azul });
    s.addText(txt(d.titulo), { x: MX, y: 2.9, w: 7.6, h: 1.8, fontFace: FT, fontSize: fs(38), color: C.texto, valign: "top", fit: "shrink" });
    s.addShape("line", { x: MX, y: 5.55, w: 7.4, h: 0, line: { color: C.navy, width: 1.5 } });
    s.addText(txt(d.professor || m.professor), { x: MX, y: 5.7, w: 7.5, h: 0.35, fontFace: F, fontSize: fs(14), bold: true, color: C.navy });
    s.addText(txt(d.subtitulo), { x: MX, y: 6.05, w: 7.5, h: 0.3, fontFace: F, fontSize: fs(10), color: C.cinza });
    arr(d.lateral).slice(0, 4).forEach((it, i) => {
      const y = 1.0 + i * 1.45;
      s.addText(txt(it.rotulo).toUpperCase(), { x: 9.0, y, w: 3.8, h: 0.25, fontFace: F, fontSize: fs(8), bold: true, color: C.azulClaro });
      s.addText(txt(it.texto), { x: 9.0, y: y + 0.27, w: 3.8, h: 0.75, fontFace: F, fontSize: fs(11), color: C.branco, valign: "top", fit: "shrink" });
    });
  },
  abertura(s, d, m) {
    s.background = { color: C.navy };
    s.addText(txt(d.olho || "Aula").toUpperCase(), { x: MX, y: 0.8, w: 5, h: 0.3, fontFace: FL, fontSize: fs(10), bold: true, color: C.azulClaro });
    s.addText(txt(d.numero), { x: MX, y: 1.1, w: 6, h: 1.8, fontFace: FL, fontSize: fs(96), bold: true, color: C.branco });
    s.addText(txt(d.titulo), { x: MX, y: 3.1, w: 7.6, h: 1.7, fontFace: FT, fontSize: fs(32), color: C.branco, valign: "top", fit: "shrink" });
    s.addText(txt(d.subtitulo), { x: MX, y: 5.0, w: 7.6, h: 0.4, fontFace: F, fontSize: fs(12), color: C.azulClaro });
    s.addShape("line", { x: 9.1, y: 0.9, w: 0, h: 5.4, line: { color: C.azul, width: 1 } });
    s.addText("NESTA AULA", { x: 9.4, y: 0.9, w: 3.5, h: 0.25, fontFace: FL, fontSize: fs(8), bold: true, color: C.azulClaro });
    arr(d.itens).slice(0, 6).forEach((t, i) => {
      const y = 1.35 + i * 0.75;
      s.addText(num(i), { x: 9.4, y, w: 0.5, h: 0.5, fontFace: FL, fontSize: fs(9), color: C.azulClaro, valign: "top" });
      s.addText(txt(t), { x: 9.9, y, w: 3.0, h: 0.6, fontFace: F, fontSize: fs(11), color: C.branco, valign: "top", fit: "shrink" });
    });
  },
  objetivos(s, d) {
    olhoTitulo(s, d.olho, d.titulo || "Ao final desta aula, você será capaz de:");
    const it = arr(d.itens).slice(0, 6);
    it.forEach((t, i) => {
      const col = i % 2, lin = Math.floor(i / 2);
      const x = MX + col * 6.2, y = 1.75 + lin * 1.45;
      s.addText(num(i), { x, y, w: 0.8, h: 0.6, fontFace: FL, fontSize: fs(22), bold: true, color: C.azul, valign: "top" });
      s.addText(txt(t), { x: x + 0.85, y: y + 0.05, w: 5.1, h: 1.1, fontFace: F, fontSize: fs(14), color: C.texto, valign: "top", fit: "shrink" });
    });
  },
  conceito(s, d) {
    olhoTitulo(s, d.olho, d.titulo);
    const temEx = Boolean(d.exemplo);
    s.addText(txt(d.texto), { x: MX, y: 1.5, w: W - 2 * MX, h: 0.95, fontFace: F, fontSize: fs(14), color: C.texto, valign: "top", fit: "shrink" });
    const cs = arr(d.cards).slice(0, 6);
    const gap = 0.2, w = (W - 2 * MX - gap * (cs.length - 1)) / Math.max(cs.length, 1);
    const yC = 2.6, hC = temEx ? 2.05 : 3.4;
    cs.forEach((c, i) => {
      const x = MX + i * (w + gap);
      caixa(s, x, yC, w, hC);
      let y = yC + 0.25;
      if (c.icone) { addIcone(s, c.icone, x + 0.22, y, 0.38); y += 0.5; }
      s.addText(txt(c.titulo), { x: x + 0.22, y, w: w - 0.44, h: 0.4, fontFace: F, fontSize: fs(13), bold: true, color: C.texto, valign: "top", fit: "shrink" });
      s.addText(txt(c.texto), { x: x + 0.22, y: y + 0.42, w: w - 0.44, h: yC + hC - (y + 0.42) - 0.15, fontFace: F, fontSize: fs(10.5), color: C.cinza, valign: "top", fit: "shrink" });
    });
    if (temEx) {
      caixa(s, MX, 4.9, W - 2 * MX, 1.55, { topo: C.navy });
      rotulo(s, d.exemplo.rotulo || "Na rotina", MX + 0.3, 5.1, 5);
      s.addText(txt(d.exemplo.titulo), { x: MX + 0.3, y: 5.36, w: W - 2 * MX - 0.6, h: 0.35, fontFace: F, fontSize: fs(13), bold: true, color: C.texto });
      s.addText(txt(d.exemplo.texto), { x: MX + 0.3, y: 5.72, w: W - 2 * MX - 0.6, h: 0.65, fontFace: F, fontSize: fs(11), color: C.cinza, valign: "top", fit: "shrink" });
    } else nota(s, d.nota);
  },
  referencias(s, d) {
    olhoTitulo(s, d.olho || "Referências", d.titulo || "Fontes e bibliografia");
    const refs = arr(d.itens).slice(0, 10);
    caixa(s, MX, 1.7, W - 2 * MX, 4.95, { topo: C.navy });
    s.addText(refs.map((t) => ({ text: txt(t).replace(/^fonte:\s*/i, ""), options: { paraSpaceAfter: 12, breakLine: true, bullet: { code: "25AA", color: C.azul } } })),
      { x: MX + 0.35, y: 1.95, w: W - 2 * MX - 0.7, h: 4.5, fontFace: F, fontSize: fs(12), color: C.texto, valign: "top", fit: "shrink" });
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
      s.addText(num(i), { x: x + 0.25, y: 1.95, w: 1, h: 0.25, fontFace: FL, fontSize: fs(9), color: escuro ? C.azulClaro : C.azul });
      if (c.icone) addIcone(s, c.icone, x + w - 0.75, 1.92, 0.45, escuro ? C.branco : C.azul);
      s.addText(txt(c.titulo), { x: x + 0.25, y: 2.35, w: w - 0.5, h: 0.5, fontFace: F, fontSize: fs(18), bold: true, color: corT, fit: "shrink" });
      s.addText(txt(c.texto), { x: x + 0.25, y: 2.9, w: w - 0.5, h: 1.2, fontFace: F, fontSize: fs(12), color: corS, valign: "top", fit: "shrink" });
      if (c.citacao) s.addText(`“${txt(c.citacao)}”`, { x: x + 0.25, y: 4.2, w: w - 0.5, h: 0.9, fontFace: F, fontSize: fs(11), italic: true, color: corS, valign: "top", fit: "shrink" });
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
      s.addText(String(i + 1), { x: cx, y: 1.73, w: 0.44, h: 0.44, align: "center", valign: "middle", fontFace: FL, fontSize: fs(11), bold: true, color: i === 0 ? C.branco : C.azul });
      caixa(s, x, 2.5, w, 2.6);
      if (p.icone) addIcone(s, p.icone, x + 0.2, 2.7, 0.34);
      rotulo(s, p.rotulo, x + 0.2, p.icone ? 3.12 : 2.7, w - 0.4);
      s.addText(txt(p.titulo), { x: x + 0.2, y: p.icone ? 3.35 : 2.95, w: w - 0.4, h: 0.4, fontFace: F, fontSize: fs(15), bold: true, color: C.texto, fit: "shrink" });
      s.addText(txt(p.texto), { x: x + 0.2, y: p.icone ? 3.78 : 3.4, w: w - 0.4, h: 1.2, fontFace: F, fontSize: fs(11), color: C.cinza, valign: "top", fit: "shrink" });
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
      s.addText(txt(p.titulo ?? p), { x: x + 0.08, y: 1.7, w: w - 0.16, h: 0.9, align: "center", valign: "middle", fontFace: F, fontSize: fs(11), bold: true, color: escuro ? C.branco : C.texto, fit: "shrink" });
      if (i < ps.length - 1) s.addText("→", { x: x + w, y: 1.7, w: gap, h: 0.9, align: "center", valign: "middle", fontFace: F, fontSize: fs(14), color: C.cinza });
    });
    [[d.esquerda, C.azul, C.branco], [d.direita, C.vermelho, C.branco]].forEach(([b, cor], k) => {
      if (!b) return;
      const x = MX + k * 6.17;
      caixa(s, x, 3.0, 5.95, 2.6, { topo: cor });
      rotulo(s, b.rotulo, x + 0.25, 3.2, 5.4, cor);
      s.addText(txt(b.titulo), { x: x + 0.25, y: 3.45, w: 5.4, h: 0.35, fontFace: F, fontSize: fs(14), bold: true, color: C.texto });
      s.addText(txt(b.texto), { x: x + 0.25, y: 3.85, w: 5.4, h: 1.6, fontFace: F, fontSize: fs(12), color: C.cinza, valign: "top", fit: "shrink" });
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
      s.addText(txt(b.titulo), { x: x + 0.3, y: 2.22, w: 4.8, h: 0.45, fontFace: F, fontSize: fs(18), bold: true, color: C.texto, fit: "shrink" });
      s.addText(arr(b.itens).slice(0, 5).map((t) => ({ text: txt(t), options: { bullet: true, paraSpaceAfter: 6 } })),
        { x: x + 0.3, y: 2.8, w: 5.35, h: 1.8, fontFace: F, fontSize: fs(12), color: C.texto, valign: "top", fit: "shrink" });
      if (b.exemplo) {
        s.addShape("rect", { x: x + 0.3, y: 4.7, w: 5.35, h: 1.4, fill: { color: claro ? C.branco : C.fundo }, line: { color: C.borda, width: 0.5 } });
        rotulo(s, "Exemplo", x + 0.45, 4.82, 5);
        s.addText(txt(b.exemplo), { x: x + 0.45, y: 5.05, w: 5.05, h: 0.95, fontFace: F, fontSize: fs(10), color: C.cinza, valign: "top", fit: "shrink" });
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
      s.addText(txt(t.titulo ?? t), { x: MX + (t.icone ? 0.8 : 0.3), y, w: 3.4, h, fontFace: F, fontSize: fs(14), bold: true, color: C.texto, valign: "middle", fit: "shrink" });
      if (t.texto) s.addText(txt(t.texto), { x: MX + 4.4, y, w: W - 2 * MX - 4.6, h, fontFace: F, fontSize: fs(12), color: C.cinza, valign: "middle", fit: "shrink" });
    });
    nota(s, d.nota);
  },
  escala(s, d) {
    olhoTitulo(s, d.olho, d.titulo);
    s.addText(txt(d.texto), { x: MX, y: 1.45, w: W - 2 * MX, h: 0.5, fontFace: F, fontSize: fs(13), color: C.texto, fit: "shrink" });
    const pts = arr(d.pontos).slice(0, 3);
    const cores = [C.verde, C.azul, C.vermelho];
    s.addShape("line", { x: 1.6, y: 2.75, w: W - 3.2, h: 0, line: { color: C.borda, width: 2 } });
    pts.forEach((p, i) => {
      const cx = 1.6 + (i * (W - 3.2)) / Math.max(pts.length - 1, 1);
      // Pontas alinhadas para dentro, para o texto não sair do slide.
      const bw = 3.6, bx = Math.min(Math.max(cx - bw / 2, MX), W - MX - bw);
      const al = i === 0 && pts.length > 1 ? "left" : i === pts.length - 1 && pts.length > 1 ? "right" : "center";
      const valor = txt(p.valor), longo = valor.length > 14;
      s.addShape("ellipse", { x: cx - 0.17, y: 2.58, w: 0.34, h: 0.34, fill: { color: cores[i] }, line: { color: C.branco, width: 2 } });
      s.addText(txt(p.rotulo), { x: bx, y: 3.05, w: bw, h: 0.32, align: al, fontFace: F, fontSize: fs(11), bold: true, color: C.texto, fit: "shrink" });
      s.addText(valor, { x: bx, y: 3.4, w: bw, h: longo ? 0.85 : 0.45, align: al, valign: "top", fontFace: F,
        fontSize: longo ? fs(10) : fs(16), bold: !longo, color: longo ? C.cinza : cores[i], fit: "shrink" });
    });
    arr(d.cards).slice(0, 2).forEach((c, k) => {
      const x = MX + k * 6.17;
      caixa(s, x, 4.4, 5.95, 1.5);
      s.addText(txt(c.titulo), { x: x + 0.25, y: 4.58, w: 5.4, h: 0.3, fontFace: F, fontSize: fs(13), bold: true, color: C.texto });
      s.addText(txt(c.texto), { x: x + 0.25, y: 4.93, w: 5.4, h: 0.9, fontFace: F, fontSize: fs(11), color: C.cinza, valign: "top", fit: "shrink" });
    });
    nota(s, d.nota, 6.1);
  },
  tabela(s, d) {
    olhoTitulo(s, d.olho, d.titulo);
    const cab = arr(d.cabecalho).map((c) => ({ text: txt(c), options: { bold: true, color: C.branco, fill: { color: C.navy } } }));
    const linhas = arr(d.linhas).slice(0, d.alertas ? 5 : 8).map((l) => arr(l).map((c, j) => ({ text: txt(c), options: { bold: j === 0, color: C.texto } })));
    s.addTable([cab, ...linhas], { x: MX, y: 1.6, w: W - 2 * MX, fontFace: F, fontSize: fs(11), border: { type: "solid", color: C.borda, pt: 0.75 },
      fill: { color: C.branco }, valign: "middle", margin: 0.08, autoPage: false });
    if (d.alertas) {
      rotulo(s, d.alertasTitulo || "Erros comuns", MX, 5.35, 5, C.vermelho);
      arr(d.alertas).slice(0, 3).forEach((a, i) => {
        const w = (W - 2 * MX - 0.3) / 3, x = MX + i * (w + 0.15);
        s.addShape("rect", { x, y: 5.62, w, h: 0.6, fill: { color: C.vermelhoFundo }, line: { color: C.vermelho, width: 0.75 } });
        s.addText(txt(a), { x: x + 0.15, y: 5.62, w: w - 0.3, h: 0.6, fontFace: F, fontSize: fs(11), bold: true, color: C.texto, valign: "middle", fit: "shrink" });
      });
    } else nota(s, d.nota);
  },
  caso(s, d) {
    olhoTitulo(s, d.olho, d.titulo);
    s.addShape("rect", { x: MX, y: 1.7, w: 5.6, h: 4.6, fill: { color: C.navy }, line: { type: "none" } });
    rotulo(s, d.rotulo || "Situação", MX + 0.3, 1.95, 5, C.azulClaro);
    s.addText(txt(d.situacao), { x: MX + 0.3, y: 2.25, w: 5.0, h: 3.85, fontFace: F, fontSize: fs(13), color: C.branco, valign: "top", fit: "shrink" });
    rotulo(s, d.tempo ? `Em grupo · ${d.tempo}` : "Para discutir", 6.6, 1.75, 6);
    arr(d.perguntas).slice(0, 5).forEach((p, i) => {
      const y = 2.1 + i * 0.85;
      s.addShape("ellipse", { x: 6.6, y, w: 0.38, h: 0.38, fill: { color: C.azul }, line: { type: "none" } });
      s.addText(String(i + 1), { x: 6.6, y, w: 0.38, h: 0.38, align: "center", valign: "middle", fontFace: FL, fontSize: fs(10), bold: true, color: C.branco });
      s.addText(semNum(p), { x: 7.15, y: y - 0.05, w: 5.55, h: 0.75, fontFace: F, fontSize: fs(12), color: C.texto, valign: "top", fit: "shrink" });
    });
  },
  atividade(s, d) {
    olhoTitulo(s, d.olho || (d.tempo ? `Atividade · ${d.tempo}` : "Atividade"), d.titulo);
    caixa(s, MX, 1.7, 7.6, 4.6);
    rotulo(s, "Passo a passo", MX + 0.3, 1.95, 5);
    s.addText(arr(d.instrucoes).slice(0, 7).map((t) => ({ text: semNum(t), options: { bullet: { type: "number" }, paraSpaceAfter: 8 } })),
      { x: MX + 0.3, y: 2.3, w: 7.0, h: 3.85, fontFace: F, fontSize: fs(13), color: C.texto, valign: "top", fit: "shrink" });
    s.addShape("rect", { x: 8.45, y: 1.7, w: W - MX - 8.45, h: 4.6, fill: { color: C.azulFundo }, line: { type: "none" } });
    addIcone(s, "clipboard-check", 8.75, 1.95, 0.45);
    rotulo(s, "Entrega", 8.75, 2.6, 3.5);
    s.addText(txt(d.entrega), { x: 8.75, y: 2.9, w: 3.65, h: 3.2, fontFace: F, fontSize: fs(14), bold: true, color: C.texto, valign: "top", fit: "shrink" });
  },
  questoes(s, d) {
    olhoTitulo(s, d.olho, d.titulo);
    arr(d.itens).slice(0, 6).forEach((p, i) => {
      const y = 1.6 + i * 0.78;
      s.addShape("ellipse", { x: MX, y, w: 0.38, h: 0.38, fill: { color: C.azul }, line: { type: "none" } });
      s.addText(String(i + 1), { x: MX, y, w: 0.38, h: 0.38, align: "center", valign: "middle", fontFace: FL, fontSize: fs(10), bold: true, color: C.branco });
      s.addText(semNum(p), { x: MX + 0.55, y: y - 0.05, w: W - 2 * MX - 0.6, h: 0.7, fontFace: F, fontSize: fs(13), color: C.texto, valign: "top", fit: "shrink" });
    });
    nota(s, d.nota);
  },
  sintese(s, d) {
    s.addShape("rect", { x: 0, y: 0, w: 4.4, h: H, fill: { color: C.azulFundo }, line: { type: "none" } });
    s.addText(txt(d.olho || "Síntese").toUpperCase(), { x: MX, y: 1.6, w: 3.4, h: 0.3, fontFace: FL, fontSize: fs(10), bold: true, color: C.azul });
    s.addText(txt(d.titulo || "O que levamos desta aula"), { x: MX, y: 1.95, w: 3.4, h: 1.3, fontFace: FT, fontSize: fs(24), color: C.texto, valign: "top", fit: "shrink" });
    if (d.frase) s.addText(`“${txt(d.frase)}”`, { x: MX, y: 3.5, w: 3.3, h: 1.2, fontFace: F, fontSize: fs(12), italic: true, color: C.azul, valign: "top", fit: "shrink" });
    arr(d.itens).slice(0, 6).forEach((t, i) => {
      const y = 0.9 + i * 0.95;
      s.addText(num(i), { x: 4.9, y, w: 0.6, h: 0.5, fontFace: FL, fontSize: fs(14), bold: true, color: C.azul, valign: "top" });
      s.addText(txt(t), { x: 5.6, y, w: 7.1, h: 0.6, fontFace: F, fontSize: fs(13), color: C.texto, valign: "top", fit: "shrink" });
      if (i < 5) s.addShape("line", { x: 4.9, y: y + 0.78, w: 7.8, h: 0, line: { color: C.borda, width: 0.5 } });
    });
  },

  // Diagrama de Ishikawa (espinha de peixe) desenhado com formas.
  ishikawa(s, d) {
    olhoTitulo(s, d.olho, d.titulo || "Diagrama de Ishikawa");
    const cats = arr(d.categorias).slice(0, 6);
    const topo = cats.slice(0, Math.ceil(cats.length / 2)), base = cats.slice(Math.ceil(cats.length / 2));
    const yEixo = 4.15, x0 = MX + 0.1, xFim = 10.2;
    s.addShape("line", { x: x0, y: yEixo, w: xFim - x0, h: 0, line: { color: C.navy, width: 3, endArrowType: "triangle" } });
    // cabeça do peixe = efeito
    s.addShape("rect", { x: xFim + 0.1, y: yEixo - 0.85, w: W - MX - xFim - 0.1, h: 1.7, fill: { color: C.vermelho }, line: { type: "none" } });
    s.addText("EFEITO", { x: xFim + 0.25, y: yEixo - 0.75, w: 2.4, h: 0.3, fontFace: F, fontSize: fs(8), bold: true, color: "F8D7DC" });
    s.addText(txt(d.efeito), { x: xFim + 0.25, y: yEixo - 0.45, w: W - MX - xFim - 0.4, h: 1.2, fontFace: F, fontSize: fs(13), bold: true, color: C.branco, valign: "top", fit: "shrink" });
    const passo = (xFim - x0 - 0.6) / Math.max(topo.length, base.length, 1);
    const espinha = (c, i, cimaBool) => {
      const xBase = x0 + 0.9 + i * passo + passo * 0.55; // ponto no eixo
      const dx = 0.9, alt = 1.7;
      const yTopo = cimaBool ? yEixo - alt : yEixo + alt;
      s.addShape("line", { x: xBase - dx, y: Math.min(yTopo, yEixo), w: dx, h: alt, flipV: !cimaBool,
        line: { color: C.azul, width: 2 } });
      const xr = xBase - dx - 1.0, yr = cimaBool ? yTopo - 0.5 : yTopo + 0.05;
      s.addShape("rect", { x: xr, y: yr, w: 2.0, h: 0.45, fill: { color: C.azul }, line: { type: "none" } });
      s.addText(txt(c.nome), { x: xr, y: yr, w: 2.0, h: 0.45, align: "center", valign: "middle", fontFace: F, fontSize: fs(11), bold: true, color: C.branco, fit: "shrink" });
      arr(c.causas).slice(0, 3).forEach((ca, k) => {
        const f = (k + 1) / 4; // posição ao longo da espinha
        const yc = cimaBool ? yTopo + alt * f : yTopo - alt * f;
        const xc = xBase - dx + dx * f;
        s.addShape("line", { x: xc - 0.35, y: yc, w: 0.35, h: 0, line: { color: C.azulClaro, width: 1 } });
        s.addText(txt(ca), { x: xc - 2.15, y: yc - 0.18, w: 1.8, h: 0.36, align: "right", valign: "middle", fontFace: F, fontSize: fs(9), color: C.texto, fit: "shrink" });
      });
    };
    topo.forEach((c, i) => espinha(c, i, true));
    base.forEach((c, i) => espinha(c, i, false));
    nota(s, d.nota, 6.6);
  },
  // Ciclo (PDCA ou qualquer processo circular de 3 a 6 etapas).
  ciclo(s, d) {
    olhoTitulo(s, d.olho, d.titulo);
    const ps = arr(d.etapas).slice(0, 6), n = ps.length || 1;
    const cx = 3.6, cy = 4.15, R = 1.75, r = 0.72;
    s.addShape("ellipse", { x: cx - R, y: cy - R, w: 2 * R, h: 2 * R, fill: { type: "none" }, line: { color: C.borda, width: 2, dashType: "dash" } });
    if (d.centro) s.addText(txt(d.centro), { x: cx - 1, y: cy - 0.4, w: 2, h: 0.8, align: "center", valign: "middle", fontFace: F, fontSize: fs(14), bold: true, color: C.navy, fit: "shrink" });
    const cores = [C.azul, C.navy, C.verde, C.vermelho, C.azulClaro, C.cinza];
    ps.forEach((p, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
      const x = cx + R * Math.cos(a) - r, y = cy + R * Math.sin(a) - r;
      s.addShape("ellipse", { x, y, w: 2 * r, h: 2 * r, fill: { color: cores[i % 6] }, line: { color: C.fundo, width: 3 } });
      s.addText(txt(p.sigla || String(i + 1)), { x, y, w: 2 * r, h: 2 * r, align: "center", valign: "middle", fontFace: FL, fontSize: fs(18), bold: true, color: C.branco, fit: "shrink" });
      const yl = 1.65 + i * (4.7 / n);
      s.addShape("rect", { x: 6.9, y: yl, w: 0.08, h: 4.7 / n - 0.15, fill: { color: cores[i % 6] }, line: { type: "none" } });
      s.addText([{ text: txt(p.titulo), options: { bold: true, color: C.texto, fontSize: fs(14), breakLine: true } },
        { text: txt(p.texto), options: { color: C.cinza, fontSize: fs(11) } }],
        { x: 7.15, y: yl, w: W - MX - 7.15, h: 4.7 / n - 0.15, fontFace: F, valign: "middle", fit: "shrink" });
    });
  },
  // Gráfico de barras (ou Pareto, com linha de % acumulado).
  grafico(s, d) {
    olhoTitulo(s, d.olho, d.titulo);
    const cats = arr(d.categorias).map(txt), vals = arr(d.valores).map(Number);
    const w = d.texto ? 8.4 : W - 2 * MX;
    const comum = { x: MX, y: 1.6, w, h: 4.8, catAxisLabelFontFace: F, valAxisLabelFontFace: F, catAxisLabelFontSize: fs(10),
      valAxisLabelFontSize: fs(9), catAxisLabelColor: C.texto, valAxisLabelColor: C.cinza, valGridLine: { color: C.borda, size: 0.5 },
      showValue: true, dataLabelFontSize: fs(9), dataLabelFontFace: F, dataLabelColor: C.texto, chartColors: [C.azul] };
    if (d.tipo === "pareto") {
      const total = vals.reduce((a, b) => a + b, 0) || 1;
      let ac = 0;
      const acum = vals.map((v) => Math.round(((ac += v) / total) * 100));
      s.addChart([
        { type: "bar", data: [{ name: d.serie || "Ocorrências", labels: cats, values: vals }], options: { chartColors: [C.azul], barGapWidthPct: 40 } },
        { type: "line", data: [{ name: "% acumulado", labels: cats, values: acum }], options: { chartColors: [C.vermelho], lineSize: 2, lineDataSymbol: "circle", secondaryValAxis: true, secondaryCatAxis: true } },
      ], { ...comum, valAxes: [{ showValAxisTitle: false }, { showValAxisTitle: false, valAxisMaxVal: 100, valGridLine: { style: "none" } }],
        catAxes: [{ catAxisTitle: "" }, { catAxisHidden: true }], showLegend: true, legendPos: "b", legendFontFace: F, legendFontSize: fs(9) });
    } else {
      s.addChart("bar", [{ name: d.serie || "Valor", labels: cats, values: vals }], { ...comum, barDir: d.tipo === "horizontal" ? "bar" : "col", barGapWidthPct: 50 });
    }
    if (d.texto) {
      caixa(s, 9.25, 1.6, W - MX - 9.25, 4.8, { topo: C.navy });
      rotulo(s, d.rotulo || "Leitura do gráfico", 9.5, 1.85, 3.3);
      s.addText(txt(d.texto), { x: 9.5, y: 2.2, w: W - MX - 9.75, h: 4.0, fontFace: F, fontSize: fs(12), color: C.texto, valign: "top", fit: "shrink" });
    }
    nota(s, d.nota, 6.55);
  },
};
// Nomes antigos continuam funcionando.
Object.assign(L, { passos: L.jornada, topicos: L.lista, resumo: L.sintese, secao: L.abertura, exemplo: L.caso,
  destaque: L.conceito, encerramento: L.sintese });

const SINONIMOS = { left: "esquerda", right: "direita", title: "titulo", subtitle: "subtitulo", items: "itens",
  steps: "passos", icon: "icone", text: "texto", label: "rotulo", eyebrow: "olho", note: "nota" };
function sinonimos(o) {
  if (Array.isArray(o)) return o.map(sinonimos);
  if (!o || typeof o !== "object") return o;
  const r = {};
  for (const [k, v] of Object.entries(o)) r[SINONIMOS[k] && !(SINONIMOS[k] in o) ? SINONIMOS[k] : k] = sinonimos(v);
  return r;
}

function normalizar(m) {
  if (Array.isArray(m.slides)) return { ...m, slides: sinonimos(m.slides) };
  const slides = [{ layout: "capa", titulo: m.titulo, subtitulo: m.subtitulo }];
  for (const s of m.secoes || []) slides.push({ layout: "lista", titulo: s.titulo, itens: [...(s.paragrafos || []), ...(s.itens || [])] });
  return { ...m, slides };
}

const PARECE_FONTE = /^\s*(fonte|fontes|refer[eê]ncia|bibliografia)\s*:|[A-ZÁÉÍÓÚ]{3,},\s+[A-Z][^.]*\.[^]*\b(19|20)\d{2}\b/i;
function separarFontes(m) {
  const refs = [...arr(m.referencias)];
  for (const d of m.slides) {
    if (d.nota && PARECE_FONTE.test(d.nota)) { refs.push(d.nota); delete d.nota; }
  }
  const unicas = [...new Set(refs.map((r) => txt(r).replace(/^fontes?:\s*/i, "")))].filter(Boolean);
  const slides = m.slides.filter((d) => d.layout !== "referencias");
  const existente = m.slides.find((d) => d.layout === "referencias");
  const itens = [...new Set([...arr(existente?.itens), ...unicas])];
  if (itens.length) slides.push({ layout: "referencias", olho: existente?.olho, titulo: existente?.titulo, itens });
  return { ...m, slides };
}

export async function gerarSlides(m) {
  m = separarFontes(normalizar(m));
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
