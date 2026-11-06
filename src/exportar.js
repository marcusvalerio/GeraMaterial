// Converte o material (JSON genérico: titulo + secoes) em DOCX e PDF.
import {
  Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, TableLayoutType,
} from "docx";
import PDFDocument from "pdfkit";

import path from "node:path";
import { fileURLToPath } from "node:url";

const AZUL = "002F6C"; // azul-marinho do padrão visual
const FONTES = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "fonts");

// Campos do cabeçalho de prova: [rótulo, valor] por linha; valor vazio vira linha para preencher.
function camposCabecalho(c) {
  return [
    [["Aluno(a)", ""]],
    [["Turma", c.turma], ["Turno", c.turno], ["Data", ""]],
    [["Curso", c.curso], ["Unidade curricular", c.uc]],
    [["Instrutor(a)", c.instrutor], ["Nota", `______ / ${c.pontos || ""}`]],
  ];
}

function cabecalhoDocx(c) {
  const borda = { style: BorderStyle.SINGLE, size: 6, color: "B8C2D0" };
  const bordas = { top: borda, bottom: borda, left: borda, right: borda };
  const linhas = camposCabecalho(c).map((cels) => new TableRow({
    children: cels.map(([rot, val], i) => new TableCell({
      borders: bordas,
      columnSpan: cels.length === 1 ? 6 : cels.length === 2 ? 3 : 2,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [
        new TextRun({ text: `${rot}: `, bold: true, size: 20, color: AZUL }),
        new TextRun({ text: val || "", size: 20 }),
      ] })],
    })),
  }));
  return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: linhas }), new Paragraph("")];
}

// Tabela com colunas proporcionais ao conteúdo (antes: todas iguais, e a coluna de texto longo virava uma torre).
const LARGURA_UTIL = 9360; // largura útil da página em twips (A4/Carta com margens padrão)
function tabelaDocx(cabecalho, linhas) {
  const n = cabecalho.length;
  const peso = cabecalho.map((c, j) => {
    const textos = [c, ...linhas.map((l) => l[j])].map((x) => String(x ?? ""));
    const medio = textos.reduce((a, t) => a + t.length, 0) / textos.length;
    return Math.min(70, Math.max(String(c ?? "").length * 1.15, medio, 7));
  });
  const soma = peso.reduce((a, b) => a + b, 0);
  const larguras = peso.map((p) => Math.round((p / soma) * LARGURA_UTIL));
  const borda = { style: BorderStyle.SINGLE, size: 4, color: "B8C2D0" };
  const bordas = { top: borda, bottom: borda, left: borda, right: borda };
  const linha = (cels, negrito) => new TableRow({
    tableHeader: negrito,
    children: Array.from({ length: n }, (_, i) => new TableCell({
      borders: bordas,
      width: { size: larguras[i], type: WidthType.DXA },
      margins: { top: 50, bottom: 50, left: 90, right: 90 },
      shading: negrito ? { fill: "E8EEF7" } : undefined,
      children: [new Paragraph({ children: [new TextRun({ text: String(cels[i] ?? ""), bold: negrito, size: 19 })] })],
    })),
  });
  return [
    new Table({ width: { size: LARGURA_UTIL, type: WidthType.DXA }, columnWidths: larguras, layout: TableLayoutType.FIXED,
      rows: [linha(cabecalho, true), ...linhas.map((l) => linha(l, false))] }),
    new Paragraph(""),
  ];
}

export async function gerarDocx(m) {
  const filhos = [...(m.cabecalho ? cabecalhoDocx(m.cabecalho) : []), new Paragraph({ text: m.titulo, heading: HeadingLevel.TITLE })];
  for (const s of m.secoes || []) {
    filhos.push(new Paragraph({ text: s.titulo, heading: HeadingLevel.HEADING_1 }));
    for (const p of s.paragrafos || []) filhos.push(new Paragraph({ children: [new TextRun(p)] }));
    for (const i of s.itens || []) filhos.push(new Paragraph({ text: i, bullet: { level: 0 } }));
    if (s.tabela?.cabecalho?.length) filhos.push(...tabelaDocx(s.tabela.cabecalho, s.tabela.linhas || []));
  }
  return Packer.toBuffer(new Document({
    styles: {
      default: { document: { run: { font: "Inter", size: 22 } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", run: { font: "Inter", bold: true, size: 40, color: AZUL } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", run: { font: "Inter", bold: true, size: 28, color: AZUL },
          paragraph: { spacing: { before: 280, after: 120 } } },
      ],
    },
    sections: [{ children: filhos }],
  }));
}

export function gerarPdf(m) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const partes = [];
    doc.on("data", (b) => partes.push(b));
    doc.on("end", () => resolve(Buffer.concat(partes)));
    doc.on("error", reject);
    // No PDF as fontes vão embutidas: o visual fica certo mesmo sem instalar nada.
    doc.registerFont("Titulo", path.join(FONTES, "Inter-Bold.otf"));
    doc.registerFont("Texto", path.join(FONTES, "Inter-Regular.otf"));
    doc.registerFont("TextoNegrito", path.join(FONTES, "Inter-Bold.otf"));

    if (m.cabecalho) {
      const x0 = doc.page.margins.left, larg = doc.page.width - x0 - doc.page.margins.right, alt = 26;
      let y = doc.y;
      for (const cels of camposCabecalho(m.cabecalho)) {
        const w = larg / cels.length;
        cels.forEach(([rot, val], i) => {
          const x = x0 + i * w;
          doc.lineWidth(0.6).strokeColor("#B8C2D0").rect(x, y, w, alt).stroke();
          doc.fillColor(`#${AZUL}`).font("TextoNegrito").fontSize(9).text(`${rot}: `, x + 6, y + 8, { continued: true, lineBreak: false, width: w - 12, height: alt - 8, ellipsis: true })
            .fillColor("black").font("Texto").text(val || "");
        });
        y += alt;
      }
      doc.x = x0; doc.y = y + 16;
    }
    doc.fillColor(`#${AZUL}`).fontSize(18).font("Titulo").text(m.titulo).moveDown();
    for (const s of m.secoes || []) {
      doc.fillColor(`#${AZUL}`).fontSize(14).font("Titulo").text(s.titulo).moveDown(0.3);
      doc.fillColor("black").fontSize(10.5).font("Texto");
      for (const p of s.paragrafos || []) doc.text(p, { align: "justify" }).moveDown(0.4);
      for (const i of s.itens || []) doc.text(`•  ${i}`, { indent: 10 }).moveDown(0.15);
      if (s.tabela?.cabecalho?.length) {
        doc.moveDown(0.3).font("TextoNegrito").text(s.tabela.cabecalho.join("  |  "));
        doc.font("Texto");
        for (const l of s.tabela.linhas || []) {
          doc.text(l.join("  |  ")).moveDown(0.2);
        }
      }
      doc.moveDown();
    }
    doc.end();
  });
}
