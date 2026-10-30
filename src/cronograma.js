// Planilha do calendário da turma: resumo por UC, todas as aulas e os dias pulados.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ExcelJS = require("exceljs");

const AZUL = "FF002F6C", AZUL_CLARO = "FFE6EFFA", BORDA = "FFD9DEE5";

function cabecalho(ws, colunas) {
  ws.columns = colunas.map(([header, key, width]) => ({ header, key, width }));
  const linha = ws.getRow(1);
  linha.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Inter" };
  linha.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  linha.alignment = { vertical: "middle" };
  linha.height = 22;
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

function bordas(ws) {
  ws.eachRow((row) => row.eachCell((c) => {
    c.border = { bottom: { style: "thin", color: { argb: BORDA } } };
    if (!c.font?.bold) c.font = { name: "Inter", size: 10 };
  }));
}

export async function gerarCronograma(c) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "gera.documento";

  const r = wb.addWorksheet("Resumo");
  r.getColumn(1).width = 28; r.getColumn(2).width = 60;
  const info = [
    ["Curso", c.curso], ["Turma", c.turma], ["Instrutor(a)", c.instrutor],
    ["Período", `${c.inicio} a ${c.termino}`], ["Dias de aula", c.dias], ["Horas por aula", `${c.horasAula}h`],
    ["Total", `${c.totalAulas} aulas · ${c.totalHoras}h · ${c.semanas} semanas`],
  ];
  r.addRow(["Calendário da turma"]).font = { bold: true, size: 16, name: "Inter", color: { argb: AZUL } };
  r.addRow([]);
  for (const [k, v] of info) {
    const row = r.addRow([k, v || "-"]);
    row.getCell(1).font = { bold: true, name: "Inter" };
    row.getCell(2).font = { name: "Inter" };
  }
  r.addRow([]);
  const t = r.addRow(["Aulas por mês"]);
  t.font = { bold: true, name: "Inter", color: { argb: AZUL } };
  for (const m of c.meses || []) r.addRow([m.rotulo, `${m.aulas} aulas · ${m.horas}h`]).font = { name: "Inter" };

  const u = wb.addWorksheet("Unidades curriculares");
  cabecalho(u, [["Unidade curricular", "nome", 44], ["Módulo", "modulo", 26], ["Horas", "horas", 9], ["Aulas", "aulas", 9],
    ["Início", "inicio", 13], ["Término", "termino", 13], ["Semanas", "semanas", 10]]);
  for (const x of c.ucs || []) u.addRow({ ...x, aulas: x.aulas.length, horas: x.horas });
  bordas(u);

  const a = wb.addWorksheet("Aulas");
  cabecalho(a, [["Nº", "n", 6], ["Data", "data", 13], ["Dia", "dia", 7], ["Horas", "ch", 8], ["Unidade curricular", "uc", 44],
    ["Aula da UC", "aulaUc", 12], ["Conteúdo / observações", "obs", 50]]);
  let n = 0;
  for (const x of c.ucs || []) {
    x.aulas.forEach((au, i) => {
      const row = a.addRow({ n: ++n, data: au.data, dia: au.dia, ch: au.ch, uc: x.nome, aulaUc: `${i + 1} de ${x.aulas.length}`, obs: "" });
      if (i === 0) row.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_CLARO } }; });
    });
  }
  bordas(a);

  if (c.pulados?.length) {
    const p = wb.addWorksheet("Dias sem aula");
    cabecalho(p, [["Data", "data", 13], ["Motivo", "motivo", 40]]);
    for (const x of c.pulados) p.addRow(x);
    bordas(p);
  }
  return wb.xlsx.writeBuffer();
}
