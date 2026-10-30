// Converte o material (JSON genérico: titulo + secoes) em DOCX e PDF. Slides ficam em slides.js.
import {
  Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, WidthType,
} from "docx";
import PDFDocument from "pdfkit";

import path from "node:path";
import { fileURLToPath } from "node:url";

const AZUL = "002F6C"; // azul-marinho do padrão visual
const FONTES = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "fonts");

export async function gerarDocx(m) {
  const filhos = [new Paragraph({ text: m.titulo, heading: HeadingLevel.TITLE })];
  for (const s of m.secoes || []) {
    filhos.push(new Paragraph({ text: s.titulo, heading: HeadingLevel.HEADING_1 }));
    for (const p of s.paragrafos || []) filhos.push(new Paragraph({ children: [new TextRun(p)] }));
    for (const i of s.itens || []) filhos.push(new Paragraph({ text: i, bullet: { level: 0 } }));
    if (s.tabela?.cabecalho?.length) {
      const linha = (cels, negrito) => new TableRow({
        children: cels.map((c) => new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: String(c ?? ""), bold: negrito })] })],
        })),
      });
      filhos.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [linha(s.tabela.cabecalho, true), ...(s.tabela.linhas || []).map((l) => linha(l, false))],
      }));
      filhos.push(new Paragraph(""));
    }
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
