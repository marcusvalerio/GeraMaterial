// Plano de Aula em Word, no formato do modelo do SENAI: cabeçalho da UC, objetivo geral,
// distribuição da carga horária, plano encontro por encontro (com os conhecimentos em tópicos),
// organização das horas do encontro, instrumentos de avaliação, recursos e resultado esperado.
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType,
} from "docx";

const AZUL = "002F6C";
const txt = (v) => String(v ?? "").trim();
const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);

const p = (filhos, op = {}) => new Paragraph({ spacing: { after: 100, line: 300 }, ...op, children: filhos });
// Sem trim: os espaços depois de "Objetivo:" e antes da data fazem parte do texto.
const run = (t, op = {}) => new TextRun({ text: String(t ?? ""), ...op });
const titulo = (t) => p([run(t, { bold: true, size: 28, color: AZUL })], { spacing: { after: 160 } });
const secao = (t) => p([run(t, { bold: true, size: 24, color: AZUL })], { spacing: { before: 280, after: 120 } });
const texto = (t) => p([run(t)], { alignment: AlignmentType.JUSTIFIED });
// "Rótulo: valor" com o rótulo em negrito
const campo = (rotulo, valor) => (txt(valor) ? p([run(`${rotulo}: `, { bold: true }), run(valor)], { alignment: AlignmentType.JUSTIFIED }) : null);
const topico = (t) => p([run(t)], { bullet: { level: 0 }, spacing: { after: 40 } });

const borda = { style: BorderStyle.SINGLE, size: 4, color: "B8C2D0" };
const bordas = { top: borda, bottom: borda, left: borda, right: borda };
function tabela(cabecalho, linhas, larguras) {
  const linha = (cels, negrito) => new TableRow({
    children: cels.map((c, i) => new TableCell({
      borders: bordas,
      width: larguras ? { size: larguras[i], type: WidthType.PERCENTAGE } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      shading: negrito ? { fill: "E8EEF7" } : undefined,
      children: [new Paragraph({ children: [run(c, { bold: negrito })] })],
    })),
  });
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [linha(cabecalho, true), ...linhas.map((l) => linha(l, false))] });
}

export async function gerarPlanoAula(m) {
  const filhos = [];
  const add = (...xs) => xs.forEach((x) => x && filhos.push(x));

  add(titulo(m.titulo || "PLANO DE AULA – SENAI"));
  add(campo("Unidade Curricular", m.uc), campo("Curso", m.curso), campo("Carga horária total", m.cargaHoraria),
    campo("Organização", m.organizacao), campo("Referência metodológica", m.referencia || "Metodologia SENAI de Educação Profissional (MSEP)"),
    campo("Instrutor(a)", m.instrutor), campo("Turma", m.turma));

  let n = 1;
  if (txt(m.objetivoGeral)) { add(secao(`${n++}. Objetivo geral`), texto(m.objetivoGeral)); }

  const dist = arr(m.distribuicao);
  if (dist.length) {
    add(secao(`${n++}. Distribuição da carga horária`));
    add(tabela(["Grupos de conhecimentos", "Carga horária"], dist.map((d) => [d.grupo, d.ch]), [78, 22]));
    if (txt(m.observacaoDistribuicao)) add(p([run("")]), texto(m.observacaoDistribuicao));
  }

  const dias = arr(m.dias);
  if (dias.length) {
    add(secao(`${n++}. Plano de aula detalhado – ${dias.length} ${dias.length === 1 ? "encontro" : "encontros"}`));
    dias.forEach((d, i) => {
      const cab = [`Encontro ${d.numero || i + 1}`, txt(d.titulo)].filter(Boolean).join(" – ");
      const meta = [txt(d.data), txt(d.horas)].filter(Boolean).join(" · ");
      add(p([run(cab, { bold: true, size: 23, color: AZUL }), ...(meta ? [run(`   ${meta}`, { color: "4A5874" })] : [])],
        { spacing: { before: 220, after: 80 }, keepNext: true }));
      const con = arr(d.conhecimentos);
      if (con.length) { add(p([run("Conhecimentos:", { bold: true })], { spacing: { after: 40 }, keepNext: true })); con.forEach((c) => add(topico(c))); }
      add(campo("Objetivo", d.objetivo), campo("Estratégia MSEP", d.estrategia), campo("Atividade", d.atividade), campo("Avaliação", d.avaliacao));
    });
  }

  const org = arr(m.organizacaoDiaria);
  if (org.length) {
    add(secao(`${n++}. Organização das horas de cada encontro`));
    add(tabela(["Etapa", "Tempo", "Desenvolvimento"], org.map((o) => [o.etapa, o.tempo, o.desenvolvimento]), [30, 15, 55]));
  }

  const ins = arr(m.instrumentos);
  if (ins.length) {
    add(secao(`${n++}. Instrumentos de avaliação`));
    ins.forEach((i) => add(typeof i === "string" ? topico(i) : p([run(`${txt(i.tipo)}: `, { bold: true }), run(i.descricao)], { bullet: { level: 0 }, spacing: { after: 60 } })));
  }

  if (txt(m.recursos) || txt(m.observacaoRecursos)) {
    add(secao(`${n++}. Recursos didáticos`), txt(m.recursos) && texto(m.recursos), txt(m.observacaoRecursos) && texto(m.observacaoRecursos));
  }
  if (txt(m.resultadoEsperado)) add(secao(`${n++}. Resultado esperado`), texto(m.resultadoEsperado));

  return Packer.toBuffer(new Document({
    styles: { default: { document: { run: { font: "Inter", size: 21 } } } },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children: filhos }],
  }));
}
