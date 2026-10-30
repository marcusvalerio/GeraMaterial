// Converte o material (JSON genérico: titulo + secoes) em DOCX, PDF e PPTX.
import {
  Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, WidthType,
} from "docx";
import PDFDocument from "pdfkit";
import PptxGenJS from "pptxgenjs";

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

export async function gerarPptx(m) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  const capa = pptx.addSlide();
  capa.background = { color: AZUL };
  capa.addText(m.titulo, { x: 0.6, y: 2.6, w: 12, h: 1.5, fontSize: 36, bold: true, color: "FFFFFF" });

  for (const s of m.secoes || []) {
    const blocos = [...(s.paragrafos || []), ...(s.itens || [])];
    // Divide conteúdo longo em vários slides (6 blocos por slide).
    const grupos = [];
    for (let i = 0; i < blocos.length; i += 6) grupos.push(blocos.slice(i, i + 6));
    if (!grupos.length && !s.tabela) grupos.push([]);
    grupos.forEach((g, idx) => {
      const sl = pptx.addSlide();
      sl.addText(s.titulo + (grupos.length > 1 ? ` (${idx + 1}/${grupos.length})` : ""),
        { x: 0.5, y: 0.3, w: 12.3, h: 0.8, fontSize: 26, bold: true, color: AZUL });
      sl.addText(g.map((t) => ({ text: t, options: { bullet: true } })),
        { x: 0.6, y: 1.3, w: 12.1, h: 5.8, fontSize: 18, valign: "top" });
    });
    if (s.tabela?.cabecalho?.length) {
      const sl = pptx.addSlide();
      sl.addText(s.titulo, { x: 0.5, y: 0.3, w: 12.3, h: 0.8, fontSize: 26, bold: true, color: AZUL });
      const cab = s.tabela.cabecalho.map((c) => ({ text: String(c), options: { bold: true, color: "FFFFFF", fill: { color: AZUL } } }));
      const linhas = (s.tabela.linhas || []).map((l) => l.map((c) => ({ text: String(c ?? "") })));
      sl.addTable([cab, ...linhas], { x: 0.5, y: 1.3, w: 12.3, fontSize: 12, border: { color: "999999", pt: 0.5 }, autoPage: true });
    }
  }
  return pptx.write({ outputType: "nodebuffer" });
}
