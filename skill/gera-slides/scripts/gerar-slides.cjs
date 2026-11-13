#!/usr/bin/env node
// Gera um .pptx bem acabado a partir de um roteiro de slides em JSON.
// Uso: node gerar-slides.cjs roteiro.json saida.pptx
// Requer: npm install pptxgenjs
// O formato do JSON está em ../reference/roteiro.md.
const fs = require("fs");
const PptxGenJS = require("pptxgenjs");

const [, , entrada, saida = "slides.pptx"] = process.argv;
if (!entrada) { console.error("Uso: node gerar-slides.cjs roteiro.json saida.pptx"); process.exit(1); }
const R = JSON.parse(fs.readFileSync(entrada, "utf8"));

// ---------- Tema ----------
const T = {
  fundo: "F6F7FB", escuro: "14213D", tinta: "1F2937", suave: "6B7280", linha: "E5E7EB",
  cor: "2563EB", cor2: "0EA5E9", destaque: "F59E0B", ok: "10B981", alerta: "EF4444", branco: "FFFFFF",
  fonte: "Inter", ...(R.tema || {}),
};
const W = 13.333, H = 7.5, M = 0.6; // 16:9

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.title = R.titulo || "Aula";
pptx.author = R.instrutor || "";

const sombra = () => ({ type: "outer", blur: 8, offset: 2, angle: 90, color: "000000", opacity: 0.12 });
const txt = (s, texto, o) => s.addText(texto, { fontFace: T.fonte, color: T.tinta, margin: 0, valign: "top", ...o });
const lista = (v) => (Array.isArray(v) ? v : v ? [v] : []);
let numero = 0;

function base(s, { escuro = false } = {}) {
  s.background = { color: escuro ? T.escuro : T.fundo };
  numero++;
  if (!escuro) {
    s.addShape("rect", { x: 0, y: 0, w: W, h: 0.08, fill: { color: T.cor } });
    txt(s, `${R.uc || ""}${R.encontro ? `  ·  ${R.encontro}` : ""}`, { x: M, y: H - 0.45, w: 9, h: 0.3, fontSize: 10, color: T.suave });
    txt(s, String(numero), { x: W - M - 1, y: H - 0.45, w: 1, h: 0.3, fontSize: 10, color: T.suave, align: "right" });
  }
}
function cabecalho(s, d) {
  if (d.olho) txt(s, d.olho.toUpperCase(), { x: M, y: 0.45, w: W - 2 * M, h: 0.3, fontSize: 12, bold: true, color: T.cor, charSpacing: 2 });
  txt(s, d.titulo || "", { x: M, y: 0.75, w: W - 2 * M, h: 0.9, fontSize: 32, bold: true, color: T.escuro, valign: "middle" });
}
function chip(s, x, y, rotulo, cor = T.cor) {
  s.addShape("roundRect", { x, y, w: 0.62, h: 0.62, rectRadius: 0.15, fill: { color: cor } });
  txt(s, String(rotulo), { x, y, w: 0.62, h: 0.62, fontSize: 18, bold: true, color: T.branco, align: "center", valign: "middle" });
}
function cartao(s, x, y, w, h, cor) {
  s.addShape("roundRect", { x, y, w, h, rectRadius: 0.12, fill: { color: T.branco }, line: { color: T.linha, width: 0.75 }, shadow: sombra() });
  if (cor) s.addShape("rect", { x, y: y + 0.18, w: 0.07, h: h - 0.36, fill: { color: cor } });
}

// ---------- Layouts ----------
const L = {
  capa(d) {
    const s = pptx.addSlide(); base(s, { escuro: true });
    s.addShape("ellipse", { x: W - 5.2, y: -2.2, w: 7.5, h: 7.5, fill: { color: T.cor, transparency: 55 } });
    s.addShape("ellipse", { x: W - 3.4, y: 3.6, w: 5, h: 5, fill: { color: T.cor2, transparency: 65 } });
    s.addShape("rect", { x: M, y: 2.2, w: 0.9, h: 0.08, fill: { color: T.destaque } });
    txt(s, (d.olho || R.uc || "").toUpperCase(), { x: M, y: 1.6, w: 8.5, h: 0.4, fontSize: 14, bold: true, color: T.destaque, charSpacing: 3 });
    txt(s, d.titulo || R.titulo, { x: M, y: 2.5, w: 8.6, h: 2.2, fontSize: 46, bold: true, color: T.branco });
    if (d.subtitulo) txt(s, d.subtitulo, { x: M, y: 4.8, w: 8.6, h: 0.8, fontSize: 18, color: "CBD5E1" });
    txt(s, [R.instrutor, R.encontro, R.data].filter(Boolean).join("  ·  "), { x: M, y: H - 1, w: 9, h: 0.4, fontSize: 13, color: "94A3B8" });
  },
  agenda(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, d);
    const itens = lista(d.itens).slice(0, 6), cols = itens.length > 3 ? 2 : 1;
    const linhas = Math.ceil(itens.length / cols), cw = (W - 2 * M - (cols - 1) * 0.4) / cols, ch = Math.min(1.25, (H - 2.6) / linhas - 0.2);
    itens.forEach((it, i) => {
      const x = M + (i % cols) * (cw + 0.4), y = 1.95 + Math.floor(i / cols) * (ch + 0.2);
      const o = typeof it === "string" ? { titulo: it } : it;
      cartao(s, x, y, cw, ch); chip(s, x + 0.3, y + (ch - 0.62) / 2, i + 1);
      txt(s, o.titulo, { x: x + 1.15, y: y + 0.2, w: cw - 2.5, h: ch - 0.4, fontSize: 18, bold: true, valign: "middle" });
      if (o.tempo) txt(s, o.tempo, { x: x + cw - 1.4, y: y + 0.2, w: 1.15, h: ch - 0.4, fontSize: 14, color: T.cor, bold: true, align: "right", valign: "middle" });
    });
  },
  objetivos(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, d);
    lista(d.itens).slice(0, 4).forEach((it, i) => {
      const y = 1.95 + i * 1.18;
      cartao(s, M, y, W - 2 * M, 1.0, T.ok);
      txt(s, "✓", { x: M + 0.35, y, w: 0.6, h: 1.0, fontSize: 26, bold: true, color: T.ok, valign: "middle" });
      txt(s, it, { x: M + 1.1, y: y + 0.12, w: W - 2 * M - 1.4, h: 0.76, fontSize: 19, valign: "middle" });
    });
  },
  conceito(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, d);
    s.addShape("roundRect", { x: M, y: 1.95, w: 6.1, h: 4.6, rectRadius: 0.15, fill: { color: T.escuro } });
    txt(s, d.definicao || "", { x: M + 0.45, y: 2.3, w: 5.2, h: 3.9, fontSize: 22, color: T.branco, valign: "middle" });
    lista(d.pontos).slice(0, 4).forEach((p, i) => {
      const y = 1.95 + i * 1.18;
      cartao(s, 7.1, y, W - 7.1 - M, 1.02, [T.cor, T.cor2, T.destaque, T.ok][i]);
      txt(s, p, { x: 7.4, y: y + 0.12, w: W - 7.7 - M, h: 0.78, fontSize: 16, valign: "middle" });
    });
  },
  cards(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, d);
    const itens = lista(d.itens).slice(0, 4), n = itens.length || 1, gap = 0.3, cw = (W - 2 * M - (n - 1) * gap) / n;
    const cores = [T.cor, T.cor2, T.destaque, T.ok];
    itens.forEach((it, i) => {
      const x = M + i * (cw + gap), y = 2.0, h = 4.5;
      cartao(s, x, y, cw, h);
      s.addShape("rect", { x, y, w: cw, h: 0.12, fill: { color: cores[i] } });
      chip(s, x + 0.3, y + 0.4, it.icone || i + 1, cores[i]);
      txt(s, it.titulo, { x: x + 0.3, y: y + 1.2, w: cw - 0.6, h: 0.8, fontSize: 19, bold: true });
      txt(s, it.texto || "", { x: x + 0.3, y: y + 2.05, w: cw - 0.6, h: h - 2.3, fontSize: 14, color: T.suave });
    });
  },
  processo(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, d);
    const passos = lista(d.passos).slice(0, 6), n = passos.length || 1, cw = (W - 2 * M) / n;
    s.addShape("line", { x: M + cw / 2, y: 2.75, w: W - 2 * M - cw, h: 0, line: { color: T.linha, width: 3 } });
    passos.forEach((p, i) => {
      const o = typeof p === "string" ? { titulo: p } : p, cx = M + i * cw;
      s.addShape("ellipse", { x: cx + cw / 2 - 0.45, y: 2.3, w: 0.9, h: 0.9, fill: { color: i === n - 1 ? T.destaque : T.cor }, line: { color: T.fundo, width: 4 } });
      txt(s, String(i + 1), { x: cx + cw / 2 - 0.45, y: 2.3, w: 0.9, h: 0.9, fontSize: 22, bold: true, color: T.branco, align: "center", valign: "middle" });
      txt(s, o.titulo, { x: cx + 0.1, y: 3.45, w: cw - 0.2, h: 0.75, fontSize: 16, bold: true, align: "center" });
      if (o.texto) txt(s, o.texto, { x: cx + 0.1, y: 4.25, w: cw - 0.2, h: 2.2, fontSize: 13, color: T.suave, align: "center" });
    });
  },
  comparacao(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, d);
    [d.esquerda, d.direita].forEach((lado, i) => {
      if (!lado) return;
      const x = M + i * ((W - 2 * M) / 2 + 0.15), w = (W - 2 * M) / 2 - 0.15, cor = i ? T.ok : T.alerta;
      cartao(s, x, 1.95, w, 4.6);
      s.addShape("roundRect", { x: x + 0.3, y: 2.2, w: w - 0.6, h: 0.7, rectRadius: 0.1, fill: { color: cor, transparency: 85 } });
      txt(s, lado.titulo, { x: x + 0.5, y: 2.2, w: w - 1, h: 0.7, fontSize: 19, bold: true, color: cor, valign: "middle" });
      txt(s, lista(lado.itens).map((t) => ({ text: t, options: { bullet: { indent: 18 }, paraSpaceAfter: 8 } })),
        { x: x + 0.4, y: 3.1, w: w - 0.8, h: 3.2, fontSize: 16 });
    });
  },
  dados(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, d);
    const itens = lista(d.itens).slice(0, 3), n = itens.length || 1, gap = 0.35, cw = (W - 2 * M - (n - 1) * gap) / n;
    itens.forEach((it, i) => {
      const x = M + i * (cw + gap);
      cartao(s, x, 2.1, cw, 3.6);
      txt(s, it.valor, { x: x + 0.3, y: 2.4, w: cw - 0.6, h: 1.5, fontSize: 54, bold: true, color: [T.cor, T.destaque, T.ok][i] });
      txt(s, it.rotulo, { x: x + 0.3, y: 4.0, w: cw - 0.6, h: 1.5, fontSize: 16, color: T.suave });
    });
    if (d.fonte) txt(s, `Fonte: ${d.fonte}`, { x: M, y: 6.0, w: W - 2 * M, h: 0.35, fontSize: 11, color: T.suave, italic: true });
  },
  destaque(d) {
    const s = pptx.addSlide(); base(s, { escuro: true });
    s.addShape("rect", { x: M, y: 2.2, w: 0.12, h: 3.1, fill: { color: T.destaque } });
    txt(s, d.frase || d.titulo || "", { x: M + 0.5, y: 2.0, w: W - 2 * M - 1, h: 3.5, fontSize: 36, bold: true, color: T.branco, valign: "middle" });
    if (d.autor) txt(s, `— ${d.autor}`, { x: M + 0.5, y: 5.6, w: 10, h: 0.5, fontSize: 16, color: "94A3B8" });
  },
  pergunta(d) {
    const s = pptx.addSlide(); base(s, { escuro: true });
    txt(s, "?", { x: W - 4.2, y: 0.4, w: 3.6, h: 6.5, fontSize: 320, bold: true, color: T.cor, align: "center", valign: "middle", transparency: 40 });
    txt(s, (d.olho || "Para pensar").toUpperCase(), { x: M, y: 1.6, w: 8, h: 0.4, fontSize: 14, bold: true, color: T.destaque, charSpacing: 3 });
    txt(s, d.pergunta || d.titulo || "", { x: M, y: 2.2, w: 8.3, h: 3.2, fontSize: 34, bold: true, color: T.branco, valign: "middle" });
    if (d.dica) txt(s, d.dica, { x: M, y: 5.6, w: 8.3, h: 0.8, fontSize: 16, color: "CBD5E1" });
  },
  atividade(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, d);
    cartao(s, M, 1.95, 8.0, 4.6, T.destaque);
    txt(s, "COMO FAZER", { x: M + 0.4, y: 2.15, w: 7, h: 0.35, fontSize: 12, bold: true, color: T.destaque, charSpacing: 2 });
    txt(s, lista(d.passos).map((t, i) => ({ text: `${i + 1}.  ${t}`, options: { paraSpaceAfter: 10, breakLine: true } })),
      { x: M + 0.4, y: 2.6, w: 7.2, h: 3.8, fontSize: 16 });
    const info = [["Formato", d.formato], ["Tempo", d.tempo], ["Entrega", d.entrega]].filter(([, v]) => v);
    info.forEach(([r, v], i) => {
      const y = 1.95 + i * 1.6;
      s.addShape("roundRect", { x: 8.95, y, w: W - 8.95 - M, h: 1.4, rectRadius: 0.12, fill: { color: i === 2 ? T.escuro : T.branco }, line: { color: T.linha, width: 0.75 } });
      txt(s, r.toUpperCase(), { x: 9.2, y: y + 0.18, w: 3.2, h: 0.3, fontSize: 11, bold: true, color: i === 2 ? T.destaque : T.cor, charSpacing: 2 });
      txt(s, v, { x: 9.2, y: y + 0.5, w: W - 9.45 - M, h: 0.8, fontSize: 15, bold: true, color: i === 2 ? T.branco : T.tinta });
    });
  },
  avaliacao(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, d);
    const linhas = lista(d.criterios).map((c) => [
      { text: c.criterio, options: { bold: true } }, { text: c.evidencia || "" },
      { text: c.tipo || "", options: { color: /cr[ií]t/i.test(c.tipo || "") ? T.alerta : T.ok, bold: true, align: "center" } },
    ]);
    const cab = ["Critério", "Evidência", "Tipo"].map((t) => ({ text: t, options: { bold: true, color: T.branco, fill: { color: T.escuro } } }));
    s.addTable([cab, ...linhas], { x: M, y: 1.95, w: W - 2 * M, colW: [4.2, 6.0, W - 2 * M - 10.2], fontFace: T.fonte, fontSize: 14,
      color: T.tinta, border: { type: "solid", color: T.linha, pt: 0.75 }, fill: { color: T.branco }, rowH: 0.55, margin: 0.12, valign: "middle" });
  },
  resumo(d) {
    const s = pptx.addSlide(); base(s); cabecalho(s, d);
    lista(d.itens).slice(0, 6).forEach((it, i) => {
      const col = i % 2, lin = Math.floor(i / 2), w = (W - 2 * M - 0.4) / 2, x = M + col * (w + 0.4), y = 1.95 + lin * 1.5;
      cartao(s, x, y, w, 1.3); chip(s, x + 0.3, y + 0.34, "✓", T.ok);
      txt(s, it, { x: x + 1.1, y: y + 0.15, w: w - 1.35, h: 1.0, fontSize: 15, valign: "middle" });
    });
  },
  encerramento(d) {
    const s = pptx.addSlide(); base(s, { escuro: true });
    s.addShape("ellipse", { x: -2, y: 3.2, w: 6.5, h: 6.5, fill: { color: T.cor, transparency: 60 } });
    txt(s, d.titulo || "Obrigado!", { x: M, y: 1.8, w: W - 2 * M, h: 1.4, fontSize: 52, bold: true, color: T.branco, align: "center" });
    if (d.proxima) txt(s, `Próximo encontro: ${d.proxima}`, { x: M, y: 3.4, w: W - 2 * M, h: 0.6, fontSize: 20, color: T.destaque, align: "center", bold: true });
    if (d.tarefa) txt(s, d.tarefa, { x: 2, y: 4.2, w: W - 4, h: 1.2, fontSize: 16, color: "CBD5E1", align: "center" });
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
