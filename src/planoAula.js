// Plano de Aula (Word e PDF) no padrão do modelo SENAI: identificação, objetivo geral, distribuição da carga horária,
// plano detalhado por encontro, organização das 4 horas, instrumentos de avaliação, recursos e resultado esperado.
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  AlignmentType, Footer, PageNumber, VerticalAlign,
} from "docx";
import PDFDocument from "pdfkit";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AZUL = "002F6C";
const AZUL_CLARO = "E8EEF7";
const CINZA = "5E6675";
const LINHA = "C9D3E0";
const LARANJA = "C2410C";
const FONTES = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "fonts");

const txt = (v) => (Array.isArray(v) ? v.join("; ") : String(v ?? "")).trim();
export const ehPlanoAula = (m) => Array.isArray(m?.aulas) && m.aulas.some((a) => a && (a.objetivo || a.atividade || a.conhecimentos));

function secoes(m) {
  const ident = [
    ["Curso", m.curso], ["Carga horária total", m.cargaHoraria], ["Organização", m.organizacao],
    ["Instrutor(a)", m.instrutor], ["Referência metodológica", m.referencia || "Metodologia SENAI de Educação Profissional (MSEP)"],
  ].filter(([, v]) => txt(v));
  const dist = (m.distribuicao || []).filter((d) => d && (d.grupo || d.ch));
  const total = dist.reduce((s, d) => s + (Number(String(d.ch || "").replace(",", ".").match(/[\d.]+/)?.[0]) || 0), 0);
  const aulas = (m.aulas || []).filter(Boolean);
  const org = (m.organizacaoDiaria || []).filter((o) => o && (o.etapa || o.tempo));
  const totalMin = org.reduce((s, o) => s + (Number(String(o.tempo || "").match(/\d+/)?.[0]) || 0), 0);
  return { ident, dist, total, aulas, org, totalMin };
}

// ---------------- Word ----------------
const borda = (cor = LINHA, size = 4) => ({ style: BorderStyle.SINGLE, size, color: cor });
const bordas = (cor) => ({ top: borda(cor), bottom: borda(cor), left: borda(cor), right: borda(cor) });
const sem = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const run = (text, o = {}) => new TextRun({ text: String(text ?? ""), font: "Inter", size: o.size || 20, bold: o.bold, color: o.color, italics: o.italic });
const par = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], spacing: { after: o.after ?? 120, before: o.before ?? 0, line: o.line ?? 300 }, alignment: o.align, keepNext: o.keepNext });
const cel = (children, o = {}) => new TableCell({
  children: Array.isArray(children) ? children : [children], width: o.w ? { size: o.w, type: WidthType.PERCENTAGE } : undefined,
  shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined, columnSpan: o.span,
  margins: { top: 90, bottom: 90, left: 140, right: 140 }, borders: o.borders || bordas(LINHA), verticalAlign: o.valign || VerticalAlign.TOP,
});
const tituloSecao = (n, t) => new Paragraph({
  keepNext: true, spacing: { before: 360, after: 160 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: AZUL, space: 4 } },
  children: [run(`${n}  `, { size: 28, bold: true, color: LARANJA }), run(t, { size: 28, bold: true, color: AZUL })],
});
const tabelaSimples = (cab, linhas, larg, opt = {}) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    new TableRow({ tableHeader: true, cantSplit: true, children: cab.map((c, i) => cel(par(run(c, { bold: true, color: "FFFFFF", size: 19 }), { after: 0 }), { w: larg[i], fill: AZUL, borders: bordas(AZUL) })) }),
    ...linhas.map((l, ri) => new TableRow({ cantSplit: true, children: l.map((c, i) => cel(par(run(c, { size: 19, bold: (opt.negritoUltima && ri === linhas.length - 1) || (opt.primeiraNegrito && i === 0), color: i === 0 && opt.primeiraNegrito ? AZUL : undefined }), { after: 0 }), { w: larg[i], fill: (opt.negritoUltima && ri === linhas.length - 1) ? AZUL_CLARO : (ri % 2 ? "F6F8FB" : undefined) })) })),
  ],
});

function cartaoAula(a, i) {
  const dia = String(a.dia || i + 1).padStart(2, "0");
  const meta = [a.ch || "4 horas", a.data].filter((x) => txt(x)).join("  ·  ");
  const campos = [["Conhecimentos", a.conhecimentos], ["Objetivo", a.objetivo], ["Estratégia MSEP", a.estrategia], ["Atividade", a.atividade], ["Avaliação", a.avaliacao]].filter(([, v]) => txt(v));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ cantSplit: true, children: [cel([
        par([run(`DIA ${dia}`, { size: 17, bold: true, color: "9FC1F5" }), run(meta ? `   ${meta}` : "", { size: 17, color: "C9D6EA" })], { after: 40, keepNext: true }),
        par(run(a.titulo || "", { size: 24, bold: true, color: "FFFFFF" }), { after: 0, keepNext: true }),
      ], { span: 2, fill: AZUL, borders: bordas(AZUL) })] }),
      // keepNext em todas as linhas menos a última: o encontro fica inteiro na mesma página.
      ...campos.map(([r, v], k) => new TableRow({ cantSplit: true, children: [
        cel(par(run(r, { size: 18, bold: true, color: AZUL }), { after: 0, keepNext: k < campos.length - 1 }), { w: 22, fill: AZUL_CLARO }),
        cel(par(run(txt(v), { size: 19 }), { after: 0, keepNext: k < campos.length - 1 }), { w: 78 }),
      ] })),
    ],
  }), new Paragraph({ spacing: { after: 200 }, children: [] })];
}

export async function gerarPlanoDocx(m) {
  const { ident, dist, total, aulas, org, totalMin } = secoes(m);
  const uc = m.uc || m.titulo || "";
  const f = [];
  // Capa/cabeçalho do documento
  f.push(par(run("PLANO DE AULA  ·  SENAI", { size: 18, bold: true, color: LARANJA }), { after: 80 }));
  f.push(par(run(uc ? `Unidade Curricular: ${uc}` : (m.titulo || "Plano de Aula"), { size: 40, bold: true, color: AZUL }), { after: 240, line: 260 }));
  if (ident.length) f.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: ident.map(([r, v]) => new TableRow({ cantSplit: true, children: [
      cel(par(run(r, { size: 18, bold: true, color: AZUL }), { after: 0 }), { w: 28, fill: AZUL_CLARO, borders: bordas("FFFFFF") }),
      cel(par(run(txt(v), { size: 20 }), { after: 0 }), { w: 72, fill: "F6F8FB", borders: bordas("FFFFFF") }),
    ] })),
  }));
  let n = 0;
  if (txt(m.objetivoGeral)) { f.push(tituloSecao(++n, "Objetivo geral")); f.push(par(run(m.objetivoGeral, { size: 21 }), { align: AlignmentType.JUSTIFIED })); }
  if (dist.length) {
    f.push(tituloSecao(++n, "Distribuição da carga horária"));
    const linhas = dist.map((d) => [txt(d.grupo), txt(d.ch)]);
    if (total) linhas.push(["Total", `${String(total).replace(".", ",")}h`]);
    f.push(tabelaSimples(["Grupos de conhecimentos", "Carga horária"], linhas, [78, 22], { negritoUltima: !!total }));
    if (txt(m.observacaoCargaHoraria)) f.push(par(run(m.observacaoCargaHoraria, { size: 19, italic: true, color: CINZA }), { before: 120 }));
  }
  if (aulas.length) {
    f.push(tituloSecao(++n, `Plano de aula detalhado: ${aulas.length} ${aulas.length === 1 ? "encontro" : "encontros"}`));
    aulas.forEach((a, i) => f.push(...cartaoAula(a, i)));
  }
  if (org.length) {
    f.push(tituloSecao(++n, "Organização das quatro horas diárias"));
    if (txt(m.organizacaoIntro)) f.push(par(run(m.organizacaoIntro, { size: 20 })));
    const linhas = org.map((o) => [txt(o.etapa), txt(o.tempo), txt(o.desenvolvimento)]);
    if (totalMin) linhas.push(["Total", `${totalMin} min`, `${String(Math.round(totalMin / 6) / 10).replace(".", ",")} horas`]);
    f.push(tabelaSimples(["Etapa", "Tempo", "Desenvolvimento"], linhas, [32, 14, 54], { negritoUltima: !!totalMin, primeiraNegrito: true }));
  }
  if ((m.instrumentos || []).length) {
    f.push(tituloSecao(++n, "Instrumentos de avaliação"));
    if (txt(m.instrumentosIntro)) f.push(par(run(m.instrumentosIntro, { size: 20 })));
    for (const it of m.instrumentos) {
      const [t, d] = typeof it === "string" ? (it.includes(":") ? [it.split(":")[0], it.split(":").slice(1).join(":")] : ["", it]) : [it.tipo, it.descricao];
      f.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 80, line: 300 }, children: [run(t ? `${txt(t)}: ` : "", { bold: true, color: AZUL }), run(txt(d).trim())] }));
    }
  }
  if (txt(m.recursos)) {
    f.push(tituloSecao(++n, "Recursos didáticos"));
    f.push(par(run(txt(m.recursos), { size: 20 }), { align: AlignmentType.JUSTIFIED }));
    if (txt(m.observacaoRecursos)) f.push(caixa("Segurança", m.observacaoRecursos));
  }
  if (txt(m.resultadoEsperado)) { f.push(tituloSecao(++n, "Resultado esperado")); f.push(par(run(m.resultadoEsperado, { size: 20 }), { align: AlignmentType.JUSTIFIED })); }
  if (txt(m.observacaoPedagogica)) f.push(caixa("Observação pedagógica", m.observacaoPedagogica));

  const rodape = new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
    run(`Plano de Aula${uc ? `  ·  ${uc}` : ""}    `, { size: 16, color: CINZA }), new TextRun({ children: [PageNumber.CURRENT], font: "Inter", size: 16, color: CINZA }),
  ] })] });
  return Packer.toBuffer(new Document({
    creator: m.instrutor || "SENAI", title: `Plano de Aula${uc ? ` - ${uc}` : ""}`,
    styles: { default: { document: { run: { font: "Inter", size: 20 } } } },
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, footers: { default: rodape }, children: f }],
  }));
}

function caixa(rotulo, texto) {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ cantSplit: true, children: [cel([
    par(run(rotulo, { size: 18, bold: true, color: LARANJA }), { after: 60 }),
    par(run(txt(texto), { size: 19 }), { after: 0 }),
  ], { fill: "FDF3E3", borders: { top: sem, bottom: sem, left: borda(LARANJA, 18), right: sem } })] })] });
}

// ---------------- PDF ----------------
export function gerarPlanoPdf(m) {
  return new Promise((resolve, reject) => {
    const { ident, dist, total, aulas, org, totalMin } = secoes(m);
    const uc = m.uc || m.titulo || "";
    const doc = new PDFDocument({ size: "A4", margins: { top: 56, bottom: 60, left: 56, right: 56 }, bufferPages: true });
    const partes = [];
    doc.on("data", (b) => partes.push(b)); doc.on("end", () => resolve(Buffer.concat(partes))); doc.on("error", reject);
    doc.registerFont("B", path.join(FONTES, "Inter-Bold.otf"));
    doc.registerFont("R", path.join(FONTES, "Inter-Regular.otf"));
    const X = doc.page.margins.left, W = doc.page.width - X - doc.page.margins.right;
    const limite = () => doc.page.height - doc.page.margins.bottom;
    const garante = (h) => { if (doc.y + h > limite()) doc.addPage(); };
    const hTexto = (t, w, font, size) => doc.font(font).fontSize(size).heightOfString(String(t ?? ""), { width: w, lineGap: 2 });

    // linha de tabela: cels = [{t, w, font, size, color, fill}]
    const linha = (cels, pad = 6) => {
      const h = Math.max(...cels.map((c) => hTexto(c.t, c.w - 2 * pad, c.font || "R", c.size || 9.5))) + 2 * pad;
      garante(h);
      let x = X; const y = doc.y;
      for (const c of cels) {
        if (c.fill) doc.rect(x, y, c.w, h).fill(`#${c.fill}`);
        doc.lineWidth(0.5).strokeColor(`#${c.stroke || LINHA}`).rect(x, y, c.w, h).stroke();
        doc.fillColor(`#${c.color || "1B2333"}`).font(c.font || "R").fontSize(c.size || 9.5).text(String(c.t ?? ""), x + pad, y + pad, { width: c.w - 2 * pad, lineGap: 2 });
        x += c.w;
      }
      doc.x = X; doc.y = y + h;
    };
    const tituloSec = (n, t) => {
      garante(60); doc.moveDown(0.8);
      const y = doc.y;
      doc.font("B").fontSize(14).fillColor(`#${LARANJA}`).text(`${n}`, X, y, { continued: true }).fillColor(`#${AZUL}`).text(`   ${t}`);
      doc.moveTo(X, doc.y + 3).lineTo(X + W, doc.y + 3).lineWidth(1.2).strokeColor(`#${AZUL}`).stroke();
      doc.y += 10; doc.x = X;
    };
    const paragrafo = (t, o = {}) => { doc.font(o.font || "R").fontSize(o.size || 10).fillColor(`#${o.color || "1B2333"}`).text(txt(t), X, doc.y, { width: W, align: o.align || "justify", lineGap: 2.5 }); doc.moveDown(0.5); };
    const tabela = (cab, linhas, larg, opt = {}) => {
      linha(cab.map((c, i) => ({ t: c, w: W * larg[i] / 100, font: "B", color: "FFFFFF", fill: AZUL, stroke: AZUL, size: 9 })));
      linhas.forEach((l, ri) => {
        const ult = opt.negritoUltima && ri === linhas.length - 1;
        linha(l.map((c, i) => ({ t: c, w: W * larg[i] / 100, font: ult || (opt.primeiraNegrito && i === 0) ? "B" : "R", color: opt.primeiraNegrito && i === 0 ? AZUL : "1B2333", fill: ult ? AZUL_CLARO : (ri % 2 ? "F6F8FB" : null) })));
      });
    };

    // cabeçalho
    doc.font("B").fontSize(9).fillColor(`#${LARANJA}`).text("PLANO DE AULA  ·  SENAI", X, doc.y, { characterSpacing: 1.5 });
    doc.moveDown(0.3);
    doc.font("B").fontSize(20).fillColor(`#${AZUL}`).text(uc ? `Unidade Curricular: ${uc}` : (m.titulo || "Plano de Aula"), { width: W });
    doc.moveDown(0.6);
    for (const [r, v] of ident) linha([{ t: r, w: W * 0.28, font: "B", color: AZUL, fill: AZUL_CLARO, stroke: "FFFFFF", size: 9 }, { t: txt(v), w: W * 0.72, fill: "F6F8FB", stroke: "FFFFFF" }]);
    let n = 0;
    if (txt(m.objetivoGeral)) { tituloSec(++n, "Objetivo geral"); paragrafo(m.objetivoGeral); }
    if (dist.length) {
      tituloSec(++n, "Distribuição da carga horária");
      const ls = dist.map((d) => [txt(d.grupo), txt(d.ch)]);
      if (total) ls.push(["Total", `${String(total).replace(".", ",")}h`]);
      tabela(["Grupos de conhecimentos", "Carga horária"], ls, [78, 22], { negritoUltima: !!total });
      if (txt(m.observacaoCargaHoraria)) { doc.moveDown(0.4); paragrafo(m.observacaoCargaHoraria, { color: CINZA, size: 9.5 }); }
    }
    if (aulas.length) {
      tituloSec(++n, `Plano de aula detalhado: ${aulas.length} ${aulas.length === 1 ? "encontro" : "encontros"}`);
      aulas.forEach((a, i) => {
        const campos = [["Conhecimentos", a.conhecimentos], ["Objetivo", a.objetivo], ["Estratégia MSEP", a.estrategia], ["Atividade", a.atividade], ["Avaliação", a.avaliacao]].filter(([, v]) => txt(v));
        const altura = 46 + campos.reduce((s, [, v]) => s + hTexto(txt(v), W * 0.78 - 12, "R", 9.5) + 12, 0);
        garante(Math.min(altura, limite() - doc.page.margins.top));
        const y = doc.y, meta = [a.ch || "4 horas", a.data].filter((x) => txt(x)).join("  ·  ");
        doc.rect(X, y, W, 42).fill(`#${AZUL}`);
        doc.font("B").fontSize(8).fillColor("#9FC1F5").text(`DIA ${String(a.dia || i + 1).padStart(2, "0")}${meta ? "    " + meta : ""}`, X + 8, y + 7, { width: W - 16, characterSpacing: 1 });
        doc.font("B").fontSize(12).fillColor("#FFFFFF").text(a.titulo || "", X + 8, y + 20, { width: W - 16, height: 18, ellipsis: true });
        doc.y = y + 42; doc.x = X;
        for (const [r, v] of campos) linha([{ t: r, w: W * 0.22, font: "B", color: AZUL, fill: AZUL_CLARO, size: 9 }, { t: txt(v), w: W * 0.78 }]);
        doc.moveDown(0.9);
      });
    }
    if (org.length) {
      tituloSec(++n, "Organização das quatro horas diárias");
      if (txt(m.organizacaoIntro)) paragrafo(m.organizacaoIntro);
      const ls = org.map((o) => [txt(o.etapa), txt(o.tempo), txt(o.desenvolvimento)]);
      if (totalMin) ls.push(["Total", `${totalMin} min`, `${String(Math.round(totalMin / 6) / 10).replace(".", ",")} horas`]);
      tabela(["Etapa", "Tempo", "Desenvolvimento"], ls, [32, 14, 54], { negritoUltima: !!totalMin, primeiraNegrito: true });
    }
    if ((m.instrumentos || []).length) {
      tituloSec(++n, "Instrumentos de avaliação");
      if (txt(m.instrumentosIntro)) paragrafo(m.instrumentosIntro);
      for (const it of m.instrumentos) {
        const [t, d] = typeof it === "string" ? (it.includes(":") ? [it.split(":")[0], it.split(":").slice(1).join(":")] : ["", it]) : [it.tipo, it.descricao];
        garante(30);
        doc.font("R").fontSize(10).fillColor(`#${LARANJA}`).text("•  ", X, doc.y, { continued: true })
          .font("B").fillColor(`#${AZUL}`).text(t ? `${txt(t)}: ` : "", { continued: true })
          .font("R").fillColor("#1B2333").text(txt(d).trim(), { width: W, lineGap: 2.5 });
        doc.moveDown(0.3);
      }
    }
    const caixaPdf = (rot, t) => {
      const h = hTexto(txt(t), W - 28, "R", 9.5) + 34; garante(h); doc.moveDown(0.4);
      const y = doc.y; doc.rect(X, y, W, h).fill("#FDF3E3"); doc.rect(X, y, 3, h).fill(`#${LARANJA}`);
      doc.font("B").fontSize(9).fillColor(`#${LARANJA}`).text(rot, X + 14, y + 8);
      doc.font("R").fontSize(9.5).fillColor("#1B2333").text(txt(t), X + 14, y + 22, { width: W - 28, lineGap: 2 });
      doc.y = y + h + 6; doc.x = X;
    };
    if (txt(m.recursos)) { tituloSec(++n, "Recursos didáticos"); paragrafo(m.recursos); if (txt(m.observacaoRecursos)) caixaPdf("Segurança", m.observacaoRecursos); }
    if (txt(m.resultadoEsperado)) { tituloSec(++n, "Resultado esperado"); paragrafo(m.resultadoEsperado); }
    if (txt(m.observacaoPedagogica)) caixaPdf("Observação pedagógica", m.observacaoPedagogica);

    const rng = doc.bufferedPageRange();
    for (let i = rng.start; i < rng.start + rng.count; i++) {
      doc.switchToPage(i);
      const bm = doc.page.margins.bottom; doc.page.margins.bottom = 0;
      doc.font("R").fontSize(8).fillColor(`#${CINZA}`).text(`Plano de Aula${uc ? "  ·  " + uc : ""}    ${i + 1}`, X, doc.page.height - 36, { width: W, align: "right", lineBreak: false });
      doc.page.margins.bottom = bm;
    }
    doc.end();
  });
}
