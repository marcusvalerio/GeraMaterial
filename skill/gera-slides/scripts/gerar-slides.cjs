#!/usr/bin/env node
// Gera um .pptx bem acabado a partir de um roteiro de slides em JSON.
// Uso: node gerar-slides.cjs roteiro.json saida.pptx
// Requer: npm install pptxgenjs @resvg/resvg-js
// O formato do JSON está em ../reference/roteiro.md.
const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");
const { Resvg } = require("@resvg/resvg-js");
const D = require(path.join(__dirname, "desenhos.cjs"));

const [, , entrada, saida = "slides.pptx"] = process.argv;
if (!entrada) { console.error("Uso: node gerar-slides.cjs roteiro.json saida.pptx"); process.exit(1); }
const R = JSON.parse(fs.readFileSync(entrada, "utf8"));

// ---------- Tema ----------
const T = {
  fundo: "EEF2F8", escuro: "14213D", tinta: "1F2937", suave: "5B6475", linha: "E2E8F0",
  cor: "2563EB", cor2: "0EA5E9", destaque: "F59E0B", ok: "10B981", alerta: "EF4444", branco: "FFFFFF",
  fonte: "Inter", ...(R.tema || {}),
};
const CORES = () => [T.cor, T.cor2, T.destaque, T.ok, T.alerta, T.escuro];
const W = 13.333, H = 7.5, M = 0.65; // 16:9

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.title = R.titulo || "Aula";
pptx.author = R.instrutor || "";

// ---------- Desenho (SVG → PNG) ----------
const png = (svg, largura) => "data:image/png;base64," + new Resvg(svg, { fitTo: { mode: "width", value: largura }, font: { loadSystemFonts: true } }).render().asPng().toString("base64");
function desenho(s, nome, x, y, w, h) {
  const svg = D.ilustracaoSvg(nome, T);
  if (!svg) { console.warn(`Desenho desconhecido "${nome}". Disponíveis: ${D.ILUSTRACOES.join(", ")}`); return false; }
  // Mantém a proporção 4:3 dentro da caixa.
  const k = Math.min(w / 4, h / 3), dw = 4 * k, dh = 3 * k;
  s.addImage({ data: png(svg, 900), x: x + (w - dw) / 2, y: y + (h - dh) / 2, w: dw, h: dh });
  return true;
}
function icone(s, nome, x, y, tam, cor = T.branco) {
  const svg = D.iconeSvg(nome, cor, 128);
  if (!svg) return false;
  s.addImage({ data: png(svg, 128), x, y, w: tam, h: tam });
  return true;
}

const sombra = () => ({ type: "outer", blur: 10, offset: 3, angle: 90, color: "1E293B", opacity: 0.1 });
const txt = (s, texto, o) => s.addText(texto, { fontFace: T.fonte, color: T.tinta, margin: 0, valign: "top", ...o });
const lista = (v) => (Array.isArray(v) ? v : v ? [v] : []);
let numero = 0;

function base(s, { escuro = false } = {}) {
  numero++;
  // Fundo em cor sólida (sem degradê).
  s.background = { color: escuro ? T.escuro : T.fundo };
  const cor = escuro ? "94A3B8" : T.suave;
  txt(s, `${R.uc || ""}${R.encontro ? `  ·  ${R.encontro}` : ""}`, { x: M, y: H - 0.48, w: 9, h: 0.3, fontSize: 10, color: cor });
  txt(s, String(numero), { x: W - M - 1, y: H - 0.48, w: 1, h: 0.3, fontSize: 10, color: cor, align: "right" });
}
function cabecalho(s, d, w = W - 2 * M) {
  if (d.olho) {
    const largura = Math.min(w, 0.12 * d.olho.length + 0.6);
    s.addShape("roundRect", { x: M, y: 0.45, w: largura, h: 0.36, rectRadius: 0.18, fill: { color: T.cor, transparency: 88 } });
    txt(s, d.olho.toUpperCase(), { x: M, y: 0.45, w: largura, h: 0.36, fontSize: 11, bold: true, color: T.cor, charSpacing: 2, align: "center", valign: "middle" });
  }
  txt(s, d.titulo || "", { x: M, y: 0.9, w, h: 0.95, fontSize: 32, bold: true, color: T.escuro, valign: "middle" });
}
function chip(s, x, y, rotulo, cor = T.cor, tam = 0.66) {
  s.addShape("roundRect", { x, y, w: tam, h: tam, rectRadius: tam * 0.26, fill: { color: cor } });
  if (rotulo && D.ICONES.includes(rotulo)) return icone(s, rotulo, x + tam * 0.2, y + tam * 0.2, tam * 0.6);
  txt(s, String(rotulo ?? ""), { x, y, w: tam, h: tam, fontSize: tam * 28, bold: true, color: T.branco, align: "center", valign: "middle" });
}
function cartao(s, x, y, w, h, { cor, fill = T.branco } = {}) {
  s.addShape("roundRect", { x, y, w, h, rectRadius: 0.14, fill: { color: fill }, line: { color: T.linha, width: 0.75 }, shadow: sombra() });
  if (cor) s.addShape("rect", { x, y: y + 0.2, w: 0.07, h: h - 0.4, fill: { color: cor } });
}

// ---------- Layouts ----------
const L = {
  capa(d) {
    const s = pptx.addSlide(); base(s, { escuro: true });
    const temDesenho = d.desenho && desenho(s, d.desenho, 7.6, 1.2, 5.2, 4.8);
    const w = temDesenho ? 6.8 : 9.5;
    txt(s, (d.olho || R.uc || "").toUpperCase(), { x: M, y: 1.5, w, h: 0.4, fontSize: 14, bold: true, color: T.destaque, charSpacing: 3 });
    s.addShape("rect", { x: M, y: 2.05, w: 0.9, h: 0.08, fill: { color: T.destaque } });
    txt(s, d.titulo || R.titulo, { x: M, y: 2.35, w, h: 2.4, fontSize: 44, bold: true, color: T.branco, valign: "middle" });
    if (d.subtitulo) txt(s, d.subtitulo, { x: M, y: 4.85, w, h: 0.9, fontSize: 18, color: "CBD5E1" });
    txt(s, [R.instrutor, R.encontro, R.data].filter(Boolean).join("  ·  "), { x: M, y: H - 1.15, w: 9, h: 0.4, fontSize: 14, color: "94A3B8" });
  },
  agenda(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, d);
    const itens = lista(d.itens).slice(0, 6), cols = itens.length > 3 ? 2 : 1;
    const linhas = Math.ceil(itens.length / cols), cw = (W - 2 * M - (cols - 1) * 0.4) / cols, ch = Math.min(1.3, (H - 2.75) / linhas - 0.22);
    itens.forEach((it, i) => {
      const x = M + (i % cols) * (cw + 0.4), y = 2.05 + Math.floor(i / cols) * (ch + 0.22);
      const o = typeof it === "string" ? { titulo: it } : it;
      cartao(s, x, y, cw, ch); chip(s, x + 0.3, y + (ch - 0.66) / 2, o.icone || i + 1, CORES()[i % 4]);
      txt(s, o.titulo, { x: x + 1.2, y: y + 0.15, w: cw - 2.6, h: ch - 0.3, fontSize: 19, bold: true, valign: "middle" });
      if (o.tempo) txt(s, o.tempo, { x: x + cw - 1.45, y: y + 0.15, w: 1.2, h: ch - 0.3, fontSize: 15, color: T.cor, bold: true, align: "right", valign: "middle" });
    });
  },
  objetivos(d) {
    const s = pptx.addSlide(); base(s);
    const temDesenho = d.desenho && desenho(s, d.desenho, 8.6, 1.9, 4.2, 4.4);
    const w = temDesenho ? 7.7 : W - 2 * M;
    cabecalho(s, d, w);
    lista(d.itens).slice(0, 4).forEach((it, i) => {
      const y = 2.05 + i * 1.22;
      cartao(s, M, y, w, 1.04, { cor: T.ok });
      chip(s, M + 0.3, y + 0.2, "check", T.ok, 0.64);
      txt(s, it, { x: M + 1.2, y: y + 0.1, w: w - 1.5, h: 0.84, fontSize: 20, valign: "middle" });
    });
  },
  conceito(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, d);
    s.addShape("roundRect", { x: M, y: 2.05, w: 6.0, h: 4.6, rectRadius: 0.18, fill: { color: T.escuro }, shadow: sombra() });
    if (d.desenho) { desenho(s, d.desenho, M + 0.3, 2.2, 5.4, 2.3); txt(s, d.definicao || "", { x: M + 0.45, y: 4.55, w: 5.1, h: 1.95, fontSize: 18, color: T.branco, valign: "middle" }); }
    else txt(s, d.definicao || "", { x: M + 0.45, y: 2.4, w: 5.1, h: 3.9, fontSize: 23, color: T.branco, valign: "middle" });
    lista(d.pontos).slice(0, 4).forEach((p, i) => {
      const o = typeof p === "string" ? { texto: p } : p, y = 2.05 + i * 1.18;
      cartao(s, 7.0, y, W - 7.0 - M, 1.02);
      chip(s, 7.25, y + 0.21, o.icone || i + 1, CORES()[i], 0.6);
      txt(s, o.texto, { x: 8.05, y: y + 0.1, w: W - 8.3 - M, h: 0.82, fontSize: 17, valign: "middle" });
    });
  },
  cards(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, d);
    const itens = lista(d.itens).slice(0, 4), n = itens.length || 1, gap = 0.3, cw = (W - 2 * M - (n - 1) * gap) / n;
    itens.forEach((it, i) => {
      const x = M + i * (cw + gap), y = 2.1, h = 4.4, cor = CORES()[i];
      cartao(s, x, y, cw, h);
      s.addShape("rect", { x: x + 0.01, y, w: cw - 0.02, h: 0.12, fill: { color: cor } });
      chip(s, x + 0.35, y + 0.45, it.icone || i + 1, cor, 0.85);
      txt(s, it.titulo, { x: x + 0.35, y: y + 1.5, w: cw - 0.7, h: 0.8, fontSize: 22, bold: true });
      txt(s, it.texto || "", { x: x + 0.35, y: y + 2.35, w: cw - 0.7, h: h - 2.55, fontSize: 17, color: T.suave });
    });
  },
  processo(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, d);
    const passos = lista(d.passos).slice(0, 6), n = passos.length || 1, cw = (W - 2 * M) / n;
    s.addShape("line", { x: M + cw / 2, y: 2.95, w: W - 2 * M - cw, h: 0, line: { color: T.cor, width: 3, dashType: "dash" } });
    passos.forEach((p, i) => {
      const o = typeof p === "string" ? { titulo: p } : p, cx = M + i * cw, ult = i === n - 1;
      s.addShape("ellipse", { x: cx + cw / 2 - 0.55, y: 2.4, w: 1.1, h: 1.1, fill: { color: ult ? T.destaque : T.cor }, line: { color: T.branco, width: 5 }, shadow: sombra() });
      if (!(o.icone && icone(s, o.icone, cx + cw / 2 - 0.3, 2.65, 0.6)))
        txt(s, String(i + 1), { x: cx + cw / 2 - 0.55, y: 2.4, w: 1.1, h: 1.1, fontSize: 26, bold: true, color: T.branco, align: "center", valign: "middle" });
      cartao(s, cx + 0.1, 3.8, cw - 0.2, 2.1);
      txt(s, o.titulo, { x: cx + 0.25, y: 3.95, w: cw - 0.5, h: 0.8, fontSize: 18, bold: true, align: "center", valign: "middle" });
      if (o.texto) txt(s, o.texto, { x: cx + 0.25, y: 4.8, w: cw - 0.5, h: 1.0, fontSize: 15, color: T.suave, align: "center" });
    });
  },
  comparacao(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, d);
    [d.esquerda, d.direita].forEach((lado, i) => {
      if (!lado) return;
      const w = (W - 2 * M) / 2 - 0.2, x = M + i * (w + 0.4), cor = i ? T.ok : T.alerta;
      cartao(s, x, 2.05, w, 4.6);
      chip(s, x + 0.35, 2.35, i ? "check" : "alerta", cor, 0.7);
      txt(s, lado.titulo, { x: x + 1.25, y: 2.35, w: w - 1.5, h: 0.7, fontSize: 22, bold: true, color: cor, valign: "middle" });
      lista(lado.itens).slice(0, 4).forEach((t, k) => {
        const y = 3.3 + k * 0.82;
        s.addShape("roundRect", { x: x + 0.35, y, w: w - 0.7, h: 0.68, rectRadius: 0.1, fill: { color: cor, transparency: 92 } });
        txt(s, t, { x: x + 0.6, y, w: w - 1.2, h: 0.68, fontSize: 17, valign: "middle" });
      });
    });
  },
  dados(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, d);
    const itens = lista(d.itens).slice(0, 3), n = itens.length || 1, gap = 0.35, cw = (W - 2 * M - (n - 1) * gap) / n;
    itens.forEach((it, i) => {
      const x = M + i * (cw + gap);
      cartao(s, x, 2.2, cw, 3.7);
      txt(s, it.valor, { x: x + 0.35, y: 2.5, w: cw - 0.7, h: 1.5, fontSize: 60, bold: true, color: [T.cor, T.destaque, T.ok][i] });
      txt(s, it.rotulo, { x: x + 0.35, y: 4.1, w: cw - 0.7, h: 1.6, fontSize: 18, color: T.suave });
    });
    if (d.fonte) txt(s, `Fonte: ${d.fonte}`, { x: M, y: 6.15, w: W - 2 * M, h: 0.35, fontSize: 12, color: T.suave, italic: true });
  },
  destaque(d) {
    const s = pptx.addSlide(); base(s, { escuro: true });
    const temDesenho = d.desenho && desenho(s, d.desenho, 8.4, 1.5, 4.4, 4.4);
    const w = temDesenho ? 7.2 : W - 2 * M - 1;
    s.addShape("rect", { x: M, y: 2.2, w: 0.12, h: 3.1, fill: { color: T.destaque } });
    txt(s, d.frase || d.titulo || "", { x: M + 0.5, y: 1.9, w, h: 3.7, fontSize: 36, bold: true, color: T.branco, valign: "middle" });
    if (d.autor) txt(s, `— ${d.autor}`, { x: M + 0.5, y: 5.7, w: 10, h: 0.5, fontSize: 16, color: "94A3B8" });
  },
  pergunta(d) {
    const s = pptx.addSlide(); base(s, { escuro: true });
    if (!(d.desenho && desenho(s, d.desenho, 8.3, 1.3, 4.5, 4.8)))
      txt(s, "?", { x: W - 4.3, y: 0.4, w: 3.6, h: 6.5, fontSize: 320, bold: true, color: T.cor, align: "center", valign: "middle", transparency: 30 });
    txt(s, (d.olho || "Para pensar").toUpperCase(), { x: M, y: 1.5, w: 7.4, h: 0.4, fontSize: 14, bold: true, color: T.destaque, charSpacing: 3 });
    txt(s, d.pergunta || d.titulo || "", { x: M, y: 2.1, w: 7.4, h: 3.3, fontSize: 34, bold: true, color: T.branco, valign: "middle" });
    if (d.dica) txt(s, d.dica, { x: M, y: 5.5, w: 7.4, h: 0.9, fontSize: 17, color: "CBD5E1" });
  },
  // Situação real da profissão: desenho + narrativa + o que fazer.
  caso(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, { olho: d.olho || "Caso real", titulo: d.titulo });
    cartao(s, M, 2.05, 4.6, 4.6, { fill: "E8EEFB" });
    desenho(s, d.desenho || "caminhao", M + 0.2, 2.3, 4.2, 4.1);
    cartao(s, 5.6, 2.05, W - 5.6 - M, 2.75);
    txt(s, "A SITUAÇÃO", { x: 5.95, y: 2.25, w: 5, h: 0.3, fontSize: 11, bold: true, color: T.cor, charSpacing: 2 });
    txt(s, d.situacao || "", { x: 5.95, y: 2.6, w: W - 6.3 - M, h: 2.05, fontSize: 18 });
    s.addShape("roundRect", { x: 5.6, y: 5.0, w: W - 5.6 - M, h: 1.65, rectRadius: 0.14, fill: { color: T.destaque } });
    chip(s, 5.85, 5.48, "pergunta", T.escuro, 0.7);
    txt(s, d.pergunta || "", { x: 6.8, y: 5.05, w: W - 7.1 - M, h: 1.55, fontSize: 20, bold: true, color: T.escuro, valign: "middle" });
  },
  // Pergunta rápida com alternativas; a resposta vai nas notas e é destacada se "mostrarResposta".
  quiz(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, { olho: d.olho || "Quiz rápido", titulo: d.pergunta });
    lista(d.alternativas).slice(0, 4).forEach((a, i) => {
      const col = i % 2, lin = Math.floor(i / 2), w = (W - 2 * M - 0.4) / 2, x = M + col * (w + 0.4), y = 2.3 + lin * 2.05;
      const certa = d.mostrarResposta && i === d.correta;
      cartao(s, x, y, w, 1.8, { fill: certa ? "ECFDF5" : T.branco, cor: certa ? T.ok : undefined });
      chip(s, x + 0.35, y + 0.52, "ABCD"[i], certa ? T.ok : CORES()[i], 0.76);
      txt(s, a, { x: x + 1.35, y: y + 0.15, w: w - 1.65, h: 1.5, fontSize: 19, valign: "middle", bold: certa });
    });
    if (Number.isInteger(d.correta)) d.notas = `Resposta: ${"ABCD"[d.correta]}. ${d.explicacao || ""}\n${d.notas || ""}`.trim();
  },
  // Desenho grande com marcadores numerados e a explicação de cada parte.
  ilustracao(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, d);
    cartao(s, M, 2.05, 6.6, 4.6);
    desenho(s, d.desenho || "notaFiscal", M + 0.2, 2.2, 6.2, 4.3);
    lista(d.marcadores).slice(0, 4).forEach((m, i) => {
      // Marcador sobre o desenho (posição em % da área do desenho).
      if (m.x != null && m.y != null) {
        const mx = M + 0.2 + (m.x / 100) * 6.2 - 0.25, my = 2.2 + (m.y / 100) * 4.3 - 0.25;
        s.addShape("ellipse", { x: mx, y: my, w: 0.5, h: 0.5, fill: { color: T.destaque }, line: { color: T.branco, width: 3 }, shadow: sombra() });
        txt(s, String(i + 1), { x: mx, y: my, w: 0.5, h: 0.5, fontSize: 15, bold: true, color: T.escuro, align: "center", valign: "middle" });
      }
      const y = 2.05 + i * 1.18;
      cartao(s, 7.55, y, W - 7.55 - M, 1.02);
      chip(s, 7.8, y + 0.23, i + 1, T.destaque, 0.56);
      txt(s, [{ text: m.titulo || "", options: { bold: true, breakLine: true } }, { text: m.texto || "", options: { color: T.suave } }],
        { x: 8.55, y: y + 0.08, w: W - 8.8 - M, h: 0.86, fontSize: 15, valign: "middle" });
    });
  },
  atividade(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, d);
    cartao(s, M, 2.05, 7.9, 4.6, { cor: T.destaque });
    txt(s, "COMO FAZER", { x: M + 0.45, y: 2.25, w: 7, h: 0.35, fontSize: 12, bold: true, color: T.destaque, charSpacing: 2 });
    lista(d.passos).slice(0, 5).forEach((t, i) => {
      const y = 2.75 + i * 0.75;
      chip(s, M + 0.45, y + 0.06, i + 1, T.escuro, 0.5);
      txt(s, t, { x: M + 1.15, y, w: 6.5, h: 0.62, fontSize: 17, valign: "middle" });
    });
    const info = [["Formato", d.formato, "pessoas"], ["Tempo", d.tempo, "relogio"], ["Entrega", d.entrega, "documento"]].filter(([, v]) => v);
    info.forEach(([r, v, ic], i) => {
      const y = 2.05 + i * 1.58, ult = r === "Entrega";
      s.addShape("roundRect", { x: 8.85, y, w: W - 8.85 - M, h: 1.42, rectRadius: 0.14, fill: { color: ult ? T.escuro : T.branco }, line: { color: T.linha, width: 0.75 }, shadow: sombra() });
      chip(s, 9.05, y + 0.36, ic, ult ? T.destaque : T.cor, 0.7);
      txt(s, r.toUpperCase(), { x: 9.95, y: y + 0.18, w: 2.6, h: 0.3, fontSize: 11, bold: true, color: ult ? T.destaque : T.cor, charSpacing: 2 });
      txt(s, v, { x: 9.95, y: y + 0.5, w: W - 10.2 - M, h: 0.8, fontSize: 15, bold: true, color: ult ? T.branco : T.tinta });
    });
  },
  avaliacao(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, d);
    lista(d.criterios).slice(0, 5).forEach((c, i) => {
      const y = 2.05 + i * 0.92, critico = /cr[ií]t/i.test(c.tipo || ""), cor = critico ? T.alerta : T.ok;
      cartao(s, M, y, W - 2 * M, 0.78, { cor });
      txt(s, c.criterio, { x: M + 0.35, y, w: 3.9, h: 0.78, fontSize: 17, bold: true, valign: "middle" });
      txt(s, c.evidencia || "", { x: M + 4.35, y, w: 5.6, h: 0.78, fontSize: 16, color: T.suave, valign: "middle" });
      s.addShape("roundRect", { x: W - M - 1.85, y: y + 0.2, w: 1.6, h: 0.4, rectRadius: 0.2, fill: { color: cor, transparency: 85 } });
      txt(s, c.tipo || "", { x: W - M - 1.85, y: y + 0.2, w: 1.6, h: 0.4, fontSize: 13, bold: true, color: cor, align: "center", valign: "middle" });
    });
  },
  resumo(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, d);
    lista(d.itens).slice(0, 6).forEach((it, i) => {
      const col = i % 2, lin = Math.floor(i / 2), w = (W - 2 * M - 0.4) / 2, x = M + col * (w + 0.4), y = 2.05 + lin * 1.5;
      cartao(s, x, y, w, 1.3); chip(s, x + 0.3, y + 0.32, "check", T.ok);
      txt(s, it, { x: x + 1.2, y: y + 0.15, w: w - 1.45, h: 1.0, fontSize: 18, valign: "middle" });
    });
  },
  encerramento(d) {
    const s = pptx.addSlide(); base(s, { escuro: true });
    desenho(s, d.desenho || "trofeu", W / 2 - 1.6, 0.6, 3.2, 2.4);
    txt(s, d.titulo || "Obrigado!", { x: M, y: 3.1, w: W - 2 * M, h: 1.2, fontSize: 48, bold: true, color: T.branco, align: "center", valign: "middle" });
    if (d.proxima) txt(s, `Próximo encontro: ${d.proxima}`, { x: M, y: 4.4, w: W - 2 * M, h: 0.6, fontSize: 21, color: T.destaque, align: "center", bold: true });
    if (d.tarefa) txt(s, d.tarefa, { x: 2, y: 5.1, w: W - 4, h: 1.0, fontSize: 17, color: "CBD5E1", align: "center" });
  },
};

for (const d of R.slides || []) {
  const fn = L[d.layout];
  if (!fn) { console.warn(`Layout desconhecido "${d.layout}", usando "conceito".`); L.conceito(d); }
  else fn(d);
  // Anotações do instrutor (o que falar), visíveis no modo apresentador.
  if (d.notas) pptx._slides[pptx._slides.length - 1].addNotes(d.notas);
}

pptx.writeFile({ fileName: saida }).then(() => console.log(`Gerado: ${saida} (${numero} slides)`));
