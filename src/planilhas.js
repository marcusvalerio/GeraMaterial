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

// Converte qualquer estrutura recebida em linhas legíveis. Serve como
// salvaguarda quando o formato do JSON muda e os campos do modelo não coincidem.
function linhasGenericas(obj, prefixo = "") {
  const saida = [];
  for (const [chave, valor] of Object.entries(obj || {})) {
    if (valor == null || valor === "" || chave === "cabecalho") continue;
    const nome = prefixo ? `${prefixo} / ${chave}` : chave;
    if (Array.isArray(valor)) {
      valor.forEach((item, i) => {
        if (item && typeof item === "object") saida.push(...linhasGenericas(item, `${nome} ${i + 1}`));
        else if (item != null && item !== "") saida.push([`${nome} ${i + 1}`, String(item)]);
      });
    } else if (typeof valor === "object") {
      saida.push(...linhasGenericas(valor, nome));
    } else {
      saida.push([nome, String(valor)]);
    }
  }
  return saida;
}


// ---------- PER (Plano de Ensino e Recursos) ----------
// Posições das células conforme o modelo (blocos mesclados da tabela).
const PER_DATAS = ["A16", "A19", "A21", "A26", "A30", "A34", "A38", "A43", "A48", "A51", "A55", "A61", "A64", "A68"];
// Cada célula de CH é mesclada e cobre uma ou duas células de data (conforme o modelo).
const PER_CH_BLOCOS = [["B16", ["A16", "A19"]], ["B21", ["A21"]], ["B26", ["A26"]], ["B30", ["A30", "A34"]], ["B38", ["A38", "A43"]],
  ["B48", ["A48"]], ["B51", ["A51"]], ["B55", ["A55"]], ["B61", ["A61"]], ["B64", ["A64", "A68"]]];

const horasNum = (ch) => Number(String(ch ?? "").replace(",", ".").match(/[\d.]+/)?.[0] || 0);
const fmtHoras = (h) => `${String(Math.round(h * 10) / 10).replace(".", ",")}h`;

// Distribui as aulas nas 14 linhas de data do modelo. Com mais de 14 aulas, junta datas na mesma linha
// (ex.: "02/12 e 03/12"), para nenhuma aula ficar de fora.
function distribuirAulas(aulas) {
  const n = PER_DATAS.length;
  const grupos = Array.from({ length: Math.min(n, aulas.length) }, () => []);
  aulas.forEach((a, i) => { grupos[Math.floor((i * grupos.length) / aulas.length)].push(a); });
  return grupos.map((g) => ({
    data: g.length === 1 ? g[0].data : g.map((a) => String(a.data).slice(0, 5)).join(" e ") + String(g.at(-1).data).slice(5),
    horas: g.reduce((s, a) => s + horasNum(a.ch), 0),
  }));
}
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
  const camposConhecidos = [p.curso, p.uc, p.objetivoUC, p.competenciaGeral, p.capacidadesTecnicas, p.conhecimentos, p.estrategias, p.criterios, p.aulas, p.avaliacao30, p.avaliacao60].filter((x) => x != null && x !== "").length;
  if (camposConhecidos < 2) {
    const extras = linhasGenericas(p);
    extras.forEach(([k, valor], i) => { v[`A${90 + i * 2}`] = k; v[`C${90 + i * 2}`] = valor; });
  }
  const linhas = distribuirAulas(Array.isArray(p.aulas) ? p.aulas : []);
  const porCelula = Object.fromEntries(linhas.map((l, i) => [PER_DATAS[i], l]));
  for (const [ref, l] of Object.entries(porCelula)) v[ref] = l.data;
  for (const [refCh, refsData] of PER_CH_BLOCOS) {
    const h = refsData.reduce((s, r) => s + (porCelula[r]?.horas || 0), 0);
    if (h) v[refCh] = fmtHoras(h);
  }
  const conh = Array.isArray(p.conhecimentos) ? p.conhecimentos : [];
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
  const camposConhecidos = [p.segmento, p.uc, p.curso, p.contextualizacao, p.desafio, p.resultados, p.capacidades, p.conhecimentos, p.passos].filter((x) => x != null && x !== "").length;
  if (camposConhecidos < 2) {
    linhasGenericas(p).forEach(([k, valor], i) => { anexos[`B${60 + i * 2}`] = `${k}: ${valor}`; });
  }
  (Array.isArray(p.passos) ? p.passos : []).slice(0, 25).forEach((t, i) => { anexos[`B${34 + i}`] = t; });
  return preencher("EP-190_MODELO.xlsm", { sheet1: fl1, sheet2: fl2, sheet3: anexos });
}
