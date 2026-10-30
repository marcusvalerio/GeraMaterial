// Preenche os modelos de planilha (PER e EP-190) SEM alterar o layout:
// edita apenas o XML das células dentro do arquivo, preservando logos, imagens,
// macros, mesclagens, estilos e configurações de impressão.
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODELOS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "modelos");

const esc = (t) => String(t ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

const colNum = (ref) => [...ref.match(/^[A-Z]+/)[0]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
const rowNum = (ref) => Number(ref.match(/\d+$/)[0]);

function celula(ref, estilo, texto) {
  const s = estilo ? ` s="${estilo}"` : "";
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(texto)}</t></is></c>`;
}

// Grava texto em uma célula mantendo o estilo (s="") original.
function setCell(xml, ref, texto) {
  const re = new RegExp(`<c r="${ref}"(?=[\\s/>])([^>]*?)(/>|>[\\s\\S]*?</c>)`);
  const m = xml.match(re);
  if (m) {
    const estilo = (m[1].match(/\ss="(\d+)"/) || [])[1];
    return xml.replace(re, celula(ref, estilo, texto));
  }
  // Célula inexistente: insere na linha, na ordem das colunas.
  const r = rowNum(ref);
  const reLinha = new RegExp(`<row r="${r}"(?=[\\s>])([^>]*?)(/>|>([\\s\\S]*?)</row>)`);
  const ml = xml.match(reLinha);
  if (!ml) {
    // Linha inexistente: insere antes da primeira linha de número maior.
    const nova = `<row r="${r}">${celula(ref, null, texto)}</row>`;
    const linhas = [...xml.matchAll(/<row r="(\d+)"/g)];
    const depois = linhas.find((x) => Number(x[1]) > r);
    return depois ? xml.slice(0, depois.index) + nova + xml.slice(depois.index)
      : xml.replace("</sheetData>", nova + "</sheetData>");
  }
  const attrs = ml[1].replace(/\/$/, "");
  let conteudo = ml[3] || "";
  const cels = [...conteudo.matchAll(/<c r="([A-Z]+)\d+"/g)];
  const prox = cels.find((x) => colNum(x[1]) > colNum(ref));
  const nova = celula(ref, null, texto);
  conteudo = prox ? conteudo.slice(0, prox.index) + nova + conteudo.slice(prox.index) : conteudo + nova;
  return xml.replace(reLinha, `<row r="${r}"${attrs}>${conteudo}</row>`);
}

async function preencher(arquivo, valoresPorAba) {
  const zip = await JSZip.loadAsync(await readFile(path.join(MODELOS, arquivo)));
  for (const [aba, valores] of Object.entries(valoresPorAba)) {
    const caminho = `xl/worksheets/${aba}.xml`;
    let xml = await zip.file(caminho).async("string");
    for (const [ref, v] of Object.entries(valores)) {
      if (v !== undefined && v !== null && v !== "") xml = setCell(xml, ref, v);
    }
    zip.file(caminho, xml);
  }
  // Força o Excel a recalcular fórmulas ao abrir.
  let wb = await zip.file("xl/workbook.xml").async("string");
  if (!/fullCalcOnLoad/.test(wb)) {
    wb = /<calcPr\b/.test(wb) ? wb.replace(/<calcPr\b/, '<calcPr fullCalcOnLoad="1"') : wb;
    zip.file("xl/workbook.xml", wb);
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

const lista = (v) => (Array.isArray(v) ? v.join("\n") : v);

// ---------- PER (Plano de Ensino e Recursos) ----------
// Posições das células conforme o modelo (blocos mesclados da tabela).
const PER_DATAS = ["A16", "A19", "A21", "A26", "A30", "A34", "A38", "A43", "A48", "A51", "A55", "A61", "A64", "A68"];
const PER_CH = ["B16", "B21", "B26", "B30", "B38", "B48", "B51", "B55", "B61", "B64"];
const PER_CONHEC = ["F16", "F21", "F26", "F30", "F38", "F48", "F51", "F54", "F55", "F60", "F64", "F68", "F72"];

export function gerarPER(p) {
  const v = {
    A5: `Curso: ${p.curso ?? ""}`,
    F5: `Carga horário do curso: ${p.cargaHorariaCurso ?? ""}`,
    J5: `Modalidade: ${p.modalidade ?? ""}`,
    D6: p.competenciaGeral,
    A10: `Unidade curricular: ${p.uc ?? ""}`,
    G10: `Carga Horária total da UC: ${p.cargaHorariaUC ?? ""}`,
    K10: `Módulo: ${p.modulo ?? ""}`,
    A11: `Data início da UC: ${p.dataInicio ?? ""}`,
    F11: `Data término da UC: ${p.dataTermino ?? ""}`,
    K11: `Turma: ${p.turma ?? ""}`,
    D12: p.objetivoUC,
    C16: lista(p.capacidadesTecnicas),
    I16: lista(p.estrategias),
    L16: lista(p.criterios),
    C78: p.avaliacao30?.instrumento, I78: p.avaliacao30?.criterios, A78: p.avaliacao30?.data,
    C82: p.avaliacao60?.instrumento, I82: p.avaliacao60?.criterios, A82: p.avaliacao60?.data,
    A85: `Nome do instrutor: ${p.instrutor ?? ""}`,
  };
  (p.aulas || []).slice(0, PER_DATAS.length).forEach((a, i) => { v[PER_DATAS[i]] = a.data; });
  (p.aulas || []).slice(0, PER_CH.length).forEach((a, i) => { v[PER_CH[i]] = a.ch; });
  const conh = p.conhecimentos || [];
  // Se houver mais conhecimentos que blocos, o último bloco recebe o restante.
  PER_CONHEC.forEach((ref, i) => {
    v[ref] = i === PER_CONHEC.length - 1 ? conh.slice(i).join("\n") : conh[i];
  });
  return preencher("PER_MODELO.xlsx", { sheet1: v });
}

// ---------- EP-190 (Plano da Situação de Aprendizagem / Plano de Aula) ----------
const MARCA_ESTRATEGIA = {
  "situação-problema": "C14", "estudo de caso": "E14", projeto: "G14", "pesquisa aplicada": "I14",
};

export function gerarEP190(p) {
  const fl1 = {
    F7: p.segmento, F8: p.uc, F9: p.curso, F10: p.instrutor, L12: p.numero,
    C14: " ", E14: " ", G14: " ", I14: " ",
    B18: `Contextualização: ${p.contextualizacaoTitulo ?? ""}`,
    B19: p.contextualizacao,
    B22: lista(p.desafio),
    B25: lista(p.resultados),
  };
  const marca = MARCA_ESTRATEGIA[String(p.estrategia || "").toLowerCase()] || "C14";
  fl1[marca] = "X";
  const fl2 = {
    B9: lista(p.capacidades), C9: lista(p.conhecimentos),
    D9: p.criterio || "Qualitativo e Quantitativo",
    E9: p.critico === false ? " " : "X", F9: p.desejavel === false ? " " : "X",
    C39: p.materialConsumo, C40: p.ferramentas, C41: p.epis, C42: p.epcs,
    C43: p.equipamentos, C44: p.instrumentos, C45: lista(p.bibliografia),
    C48: p.data, C49: p.responsavel,
  };
  const anexos = { B33: "1 PASSO:", B34: " ", B35: " ", B36: " ", B37: " " };
  (p.passos || []).slice(0, 25).forEach((t, i) => { anexos[`B${34 + i}`] = t; });
  return preencher("EP-190_MODELO.xlsm", { sheet1: fl1, sheet2: fl2, sheet3: anexos });
}
