// Gera a apresentação (PPTX) com layouts modernos a partir do JSON da IA.
import PptxGenJS from "pptxgenjs";

const C = {
  navy: "0A1F44", azul: "0B4FA3", azul2: "1D6FD6", claro: "E8F0FB", vermelho: "E30613",
  texto: "14213D", suave: "64748B", branco: "FFFFFF", fundo: "F6F8FC", verde: "12A150",
};
const FONTE = "Calibri";
const W = 13.333, H = 7.5;
const ACENTOS = [C.azul, C.vermelho, C.verde, "F5A524"];

const txt = (v) => String(v ?? "");
const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);

function base(pptx, { escuro = false } = {}) {
  const s = pptx.addSlide();
  s.background = { color: escuro ? C.navy : C.fundo };
  return s;
}

function rodape(s, n, total, rotulo) {
  s.addShape("rect", { x: 0, y: H - 0.08, w: W * (n / total), h: 0.08, fill: { color: C.vermelho }, line: { type: "none" } });
  s.addText(rotulo, { x: 0.6, y: H - 0.5, w: 8, h: 0.3, fontFace: FONTE, fontSize: 10, color: C.suave });
  s.addText(`${n} / ${total}`, { x: W - 1.6, y: H - 0.5, w: 1, h: 0.3, fontFace: FONTE, fontSize: 10, color: C.suave, align: "right" });
}

function titulo(s, t, sobre) {
  if (sobre) s.addText(sobre.toUpperCase(), { x: 0.6, y: 0.35, w: 10, h: 0.3, fontFace: FONTE, fontSize: 11, bold: true, color: C.vermelho, charSpacing: 2 });
  s.addText(txt(t), { x: 0.6, y: 0.6, w: W - 1.2, h: 0.9, fontFace: FONTE, fontSize: 30, bold: true, color: C.texto, valign: "middle" });
}

function card(s, x, y, w, h, cor = C.branco) {
  s.addShape("roundRect", { x, y, w, h, rectRadius: 0.12, fill: { color: cor },
    line: { color: "E2E8F0", width: 0.75 }, shadow: { type: "outer", blur: 8, offset: 2, angle: 90, color: "0F172A", opacity: 0.08 } });
}

function lista(s, itens, x, y, w, h, { cor = C.texto, tam = 18, marcador = C.azul } = {}) {
  s.addText(arr(itens).map((t) => ({ text: txt(t), options: { bullet: { code: "25A0", color: marcador }, paraSpaceAfter: 10 } })),
    { x, y, w, h, fontFace: FONTE, fontSize: tam, color: cor, valign: "top" });
}

const LAYOUTS = {
  capa(s, d, pptx) {
    s.background = { color: C.navy };
    s.addShape("ellipse", { x: 8.6, y: -2.2, w: 7, h: 7, fill: { color: C.azul, transparency: 40 }, line: { type: "none" } });
    s.addShape("ellipse", { x: 10.4, y: 3.8, w: 4.5, h: 4.5, fill: { color: C.azul2, transparency: 55 }, line: { type: "none" } });
    s.addShape("rect", { x: 0.8, y: 2.35, w: 0.12, h: 2.2, fill: { color: C.vermelho }, line: { type: "none" } });
    s.addText(txt(d.titulo), { x: 1.15, y: 2.2, w: 8.6, h: 1.7, fontFace: FONTE, fontSize: 40, bold: true, color: C.branco, valign: "top", fit: "shrink" });
    s.addText(txt(d.subtitulo), { x: 1.15, y: 3.95, w: 8.4, h: 0.7, fontFace: FONTE, fontSize: 18, color: "C7D6EC" });
    s.addText("SENAI", { x: 0.8, y: 0.6, w: 3, h: 0.5, fontFace: FONTE, fontSize: 20, bold: true, color: C.branco });
  },
  secao(s, d) {
    s.background = { color: C.azul };
    s.addText(txt(d.numero || ""), { x: 0.8, y: 1.2, w: 5, h: 2.4, fontFace: FONTE, fontSize: 140, bold: true, color: C.branco, transparency: 70 });
    s.addText(txt(d.titulo), { x: 0.8, y: 3.6, w: 11, h: 1.1, fontFace: FONTE, fontSize: 40, bold: true, color: C.branco, fit: "shrink" });
    s.addText(txt(d.subtitulo), { x: 0.8, y: 4.7, w: 11, h: 0.6, fontFace: FONTE, fontSize: 18, color: "DCE8F8" });
  },
  objetivos(s, d) {
    titulo(s, d.titulo || "Objetivos da aula", "Ao final desta aula");
    arr(d.itens).slice(0, 5).forEach((t, i) => {
      const y = 1.75 + i * 0.98;
      card(s, 0.6, y, W - 1.2, 0.8);
      s.addShape("ellipse", { x: 0.85, y: y + 0.15, w: 0.5, h: 0.5, fill: { color: C.verde }, line: { type: "none" } });
      s.addText("✓", { x: 0.85, y: y + 0.15, w: 0.5, h: 0.5, align: "center", valign: "middle", fontSize: 16, bold: true, color: C.branco });
      s.addText(txt(t), { x: 1.6, y, w: W - 2.5, h: 0.8, fontFace: FONTE, fontSize: 17, color: C.texto, valign: "middle" });
    });
  },
  cards(s, d) {
    titulo(s, d.titulo);
    const cs = arr(d.cards).slice(0, 4);
    const gap = 0.3, w = (W - 1.2 - gap * (cs.length - 1)) / Math.max(cs.length, 1);
    cs.forEach((c, i) => {
      const x = 0.6 + i * (w + gap);
      card(s, x, 1.8, w, 4.0);
      s.addShape("rect", { x, y: 1.8, w, h: 0.1, fill: { color: ACENTOS[i % 4] }, line: { type: "none" } });
      s.addShape("roundRect", { x: x + 0.3, y: 2.2, w: 0.9, h: 0.9, rectRadius: 0.15, fill: { color: C.claro }, line: { type: "none" } });
      s.addText(txt(c.icone || "•"), { x: x + 0.3, y: 2.2, w: 0.9, h: 0.9, align: "center", valign: "middle", fontSize: 28 });
      s.addText(txt(c.titulo), { x: x + 0.3, y: 3.3, w: w - 0.6, h: 0.8, fontFace: FONTE, fontSize: 19, bold: true, color: C.texto, valign: "top", fit: "shrink" });
      s.addText(txt(c.texto), { x: x + 0.3, y: 4.1, w: w - 0.6, h: 1.6, fontFace: FONTE, fontSize: 16, color: C.suave, valign: "top", fit: "shrink" });
    });
  },
  passos(s, d) {
    titulo(s, d.titulo);
    const ps = arr(d.passos).slice(0, 5);
    const gap = 0.25, w = (W - 1.2 - gap * (ps.length - 1)) / Math.max(ps.length, 1);
    s.addShape("line", { x: 0.6 + w / 2, y: 2.35, w: (w + gap) * (ps.length - 1), h: 0, line: { color: "C7D6EC", width: 3, dashType: "dash" } });
    ps.forEach((p, i) => {
      const x = 0.6 + i * (w + gap);
      s.addShape("ellipse", { x: x + w / 2 - 0.45, y: 1.9, w: 0.9, h: 0.9, fill: { color: i === ps.length - 1 ? C.vermelho : C.azul }, line: { color: C.fundo, width: 4 } });
      s.addText(String(i + 1), { x: x + w / 2 - 0.45, y: 1.9, w: 0.9, h: 0.9, align: "center", valign: "middle", fontFace: FONTE, fontSize: 24, bold: true, color: C.branco });
      card(s, x, 3.1, w, 2.6);
      s.addText(txt(p.titulo), { x: x + 0.2, y: 3.25, w: w - 0.4, h: 0.8, fontFace: FONTE, fontSize: 17, bold: true, color: C.texto, align: "center", fit: "shrink" });
      s.addText(txt(p.texto), { x: x + 0.2, y: 4.05, w: w - 0.4, h: 1.5, fontFace: FONTE, fontSize: 15, color: C.suave, align: "center", valign: "top", fit: "shrink" });
    });
  },
  comparacao(s, d) {
    titulo(s, d.titulo);
    [[d.esquerda, C.azul, 0.6], [d.direita, C.vermelho, 6.85]].forEach(([lado, cor, x]) => {
      lado = lado || {};
      card(s, x, 1.8, 5.9, 3.9);
      s.addShape("roundRect", { x, y: 1.8, w: 5.9, h: 0.9, rectRadius: 0.12, fill: { color: cor }, line: { type: "none" } });
      s.addText(txt(lado.titulo), { x: x + 0.3, y: 1.8, w: 5.3, h: 0.9, fontFace: FONTE, fontSize: 20, bold: true, color: C.branco, valign: "middle" });
      lista(s, lado.itens, x + 0.3, 2.95, 5.3, 2.6, { tam: 19, marcador: cor });
    });
    s.addShape("ellipse", { x: 6.27, y: 3.35, w: 0.8, h: 0.8, fill: { color: C.navy }, line: { color: C.fundo, width: 4 } });
    s.addText("vs", { x: 6.27, y: 3.35, w: 0.8, h: 0.8, align: "center", valign: "middle", fontFace: FONTE, fontSize: 16, bold: true, color: C.branco });
  },
  destaque(s, d) {
    s.background = { color: C.navy };
    s.addText(txt(d.titulo).toUpperCase(), { x: 0.8, y: 0.9, w: 11.5, h: 0.4, fontFace: FONTE, fontSize: 14, bold: true, color: C.vermelho, charSpacing: 3 });
    s.addText(txt(d.numero), { x: 0.8, y: 1.5, w: 11.5, h: 2.6, fontFace: FONTE, fontSize: 110, bold: true, color: C.branco, fit: "shrink" });
    s.addShape("rect", { x: 0.8, y: 4.35, w: 1.4, h: 0.08, fill: { color: C.vermelho }, line: { type: "none" } });
    s.addText(txt(d.texto), { x: 0.8, y: 4.65, w: 11, h: 1.8, fontFace: FONTE, fontSize: 24, color: "DCE8F8", valign: "top", fit: "shrink" });
  },
  topicos(s, d) {
    titulo(s, d.titulo);
    card(s, 0.6, 1.75, W - 1.2, 4.95);
    s.addShape("rect", { x: 0.6, y: 1.75, w: 0.1, h: 4.95, fill: { color: C.azul }, line: { type: "none" } });
    lista(s, arr(d.itens).slice(0, 6), 1.0, 2.05, W - 2.2, 4.5, { tam: 20 });
  },
  exemplo(s, d) {
    titulo(s, d.titulo, "Caso real");
    card(s, 0.6, 1.75, 7.6, 4.95);
    s.addText("“", { x: 0.8, y: 1.6, w: 1, h: 1.2, fontFace: "Georgia", fontSize: 80, color: C.azul, transparency: 50 });
    s.addText(txt(d.contexto), { x: 1.0, y: 2.6, w: 6.9, h: 3.9, fontFace: FONTE, fontSize: 17, color: C.texto, valign: "top", fit: "shrink" });
    s.addShape("roundRect", { x: 8.5, y: 1.75, w: 4.23, h: 4.95, rectRadius: 0.12, fill: { color: C.azul }, line: { type: "none" } });
    s.addText("PARA PENSAR", { x: 8.8, y: 2.05, w: 3.7, h: 0.4, fontFace: FONTE, fontSize: 12, bold: true, color: "C7D6EC", charSpacing: 2 });
    s.addText(txt(d.pergunta), { x: 8.8, y: 2.6, w: 3.7, h: 3.8, fontFace: FONTE, fontSize: 20, bold: true, color: C.branco, valign: "top", fit: "shrink" });
  },
  atividade(s, d) {
    titulo(s, d.titulo, "Mão na massa");
    if (d.tempo) {
      s.addShape("roundRect", { x: W - 2.6, y: 0.75, w: 2, h: 0.6, rectRadius: 0.3, fill: { color: C.vermelho }, line: { type: "none" } });
      s.addText(`⏱ ${d.tempo}`, { x: W - 2.6, y: 0.75, w: 2, h: 0.6, align: "center", valign: "middle", fontFace: FONTE, fontSize: 15, bold: true, color: C.branco });
    }
    card(s, 0.6, 1.75, 8, 4.95);
    s.addText(arr(d.instrucoes).slice(0, 6).map((t) => ({ text: txt(t), options: { bullet: { type: "number" }, paraSpaceAfter: 10 } })),
      { x: 0.9, y: 2.0, w: 7.4, h: 4.5, fontFace: FONTE, fontSize: 17, color: C.texto, valign: "top", fit: "shrink" });
    s.addShape("roundRect", { x: 8.9, y: 1.75, w: 3.83, h: 4.95, rectRadius: 0.12, fill: { color: C.claro }, line: { type: "none" } });
    s.addText("ENTREGA", { x: 9.2, y: 2.05, w: 3.3, h: 0.4, fontFace: FONTE, fontSize: 12, bold: true, color: C.azul, charSpacing: 2 });
    s.addText(txt(d.entrega), { x: 9.2, y: 2.6, w: 3.3, h: 3.8, fontFace: FONTE, fontSize: 17, bold: true, color: C.texto, valign: "top", fit: "shrink" });
  },
  resumo(s, d) {
    titulo(s, d.titulo || "Resumo", "O que vimos hoje");
    const it = arr(d.itens).slice(0, 6);
    it.forEach((t, i) => {
      const col = i % 2, lin = Math.floor(i / 2);
      const x = 0.6 + col * 6.17, y = 1.8 + lin * 1.6;
      card(s, x, y, 5.95, 1.4);
      s.addText(String(i + 1).padStart(2, "0"), { x: x + 0.25, y, w: 0.9, h: 1.4, fontFace: FONTE, fontSize: 28, bold: true, color: ACENTOS[i % 4], valign: "middle" });
      s.addText(txt(t), { x: x + 1.15, y, w: 4.6, h: 1.4, fontFace: FONTE, fontSize: 15, color: C.texto, valign: "middle", fit: "shrink" });
    });
  },
  encerramento(s, d) {
    s.background = { color: C.navy };
    s.addShape("ellipse", { x: -2, y: 3.5, w: 7, h: 7, fill: { color: C.azul, transparency: 50 }, line: { type: "none" } });
    s.addText(txt(d.titulo || "Obrigado!"), { x: 0.8, y: 2.3, w: 11.7, h: 1.5, fontFace: FONTE, fontSize: 54, bold: true, color: C.branco, align: "center" });
    s.addText(txt(d.texto), { x: 1.5, y: 3.9, w: 10.3, h: 1.2, fontFace: FONTE, fontSize: 20, color: "C7D6EC", align: "center", fit: "shrink" });
  },
};

// Compatibilidade com o formato antigo (titulo + secoes).
function normalizar(m) {
  if (Array.isArray(m.slides)) return m;
  const slides = [{ layout: "capa", titulo: m.titulo, subtitulo: m.subtitulo }];
  for (const s of m.secoes || []) slides.push({ layout: "topicos", titulo: s.titulo, itens: [...(s.paragrafos || []), ...(s.itens || [])] });
  return { ...m, slides };
}

export async function gerarSlides(m) {
  m = normalizar(m);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = txt(m.titulo);
  const total = m.slides.length;
  m.slides.forEach((d, i) => {
    const fn = LAYOUTS[d.layout] || LAYOUTS.topicos;
    const escuro = ["capa", "secao", "destaque", "encerramento"].includes(d.layout);
    const s = base(pptx, { escuro });
    fn(s, d, pptx);
    if (!escuro) rodape(s, i + 1, total, txt(m.titulo));
  });
  return pptx.write({ outputType: "nodebuffer" });
}
