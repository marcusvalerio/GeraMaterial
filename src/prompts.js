// Sequência de entregas (padrão): 1º PER, 2º Plano de Aula (EP-190), 3º PPTX,
// 4º Avaliações (30 e 60 pontos), 5º Atividade do educador (teórica e prática).
// Base: MSEP + documento de referência enviado pelo instrutor.

export const SISTEMA = `Você é um especialista pedagógico do SENAI, com domínio da Metodologia SENAI de Educação Profissional (MSEP):
capacidades técnicas e socioemocionais, situações de aprendizagem (situação-problema, estudo de caso, projeto,
pesquisa aplicada), mediação do docente e avaliação por critérios críticos e desejáveis.
Use o DOCUMENTO DE REFERÊNCIA (plano de curso, ementa etc.) como fonte principal: copie capacidades, conhecimentos
e cargas horárias exatamente como estão nele, sem inventar. Escreva em português do Brasil.
Responda SOMENTE com um objeto JSON válido, sem markdown e sem texto fora do JSON.`;

const DOC_GENERICO = `{ "titulo": "string", "secoes": [ { "titulo": "string", "paragrafos": ["..."], "itens": ["..."],
  "tabela": { "cabecalho": ["..."], "linhas": [["..."]] } } ] }  (paragrafos, itens e tabela são opcionais)`;

export const ETAPAS = {
  per: {
    nome: "PER – Plano de Ensino e Recursos",
    instrucao: `Preencha o PER (Plano de Ensino e Recursos) da Unidade Curricular. JSON:
{ "curso": "", "cargaHorariaCurso": "", "modalidade": "", "competenciaGeral": "", "uc": "", "cargaHorariaUC": "",
  "modulo": "", "dataInicio": "dd/mm/aaaa", "dataTermino": "dd/mm/aaaa", "turma": "", "objetivoUC": "",
  "aulas": [ { "data": "dd/mm/aaaa", "ch": "4h" } ],          // até 14 encontros, distribuindo a CH da UC
  "capacidadesTecnicas": ["..."], "conhecimentos": ["..."],    // conhecimentos: até 13 itens (agrupe se precisar)
  "estrategias": ["..."], "criterios": ["..."],
  "avaliacao30": { "data": "", "instrumento": "", "criterios": "" },
  "avaliacao60": { "data": "", "instrumento": "", "criterios": "" },
  "instrutor": "" }`,
  },
  plano: {
    nome: "Plano de Aula (EP-190 – Situação de Aprendizagem)",
    instrucao: `Com base no PER, elabore o Plano da Situação de Aprendizagem (formulário EP-190). JSON:
{ "segmento": "", "uc": "NOME DA UC + CH", "curso": "", "instrutor": "", "numero": "1",
  "estrategia": "Situação-problema" | "Estudo de Caso" | "Projeto" | "Pesquisa Aplicada",
  "contextualizacaoTitulo": "data (tema)", "contextualizacao": "texto do cenário",
  "desafio": ["..."], "resultados": ["..."], "capacidades": ["..."], "conhecimentos": ["..."],
  "criterio": "Qualitativo e Quantitativo", "critico": true, "desejavel": true,
  "materialConsumo": "", "ferramentas": "", "epis": "", "epcs": "", "equipamentos": "", "instrumentos": "",
  "bibliografia": ["..."], "data": "dd/mm/aaaa", "responsavel": "",
  "passos": ["etapas de desenvolvimento da atividade, para a aba Anexos"] }`,
  },
  slides: {
    nome: "Slides da aula (PPTX)",
    instrucao: `Com base no Plano de Aula, crie uma apresentação MODERNA e VISUAL para a aula (14 a 20 slides).
Varie os layouts; textos curtos (máx. ~15 palavras por item); nada de parágrafos longos. JSON:
{ "titulo": "", "subtitulo": "", "slides": [ ... ] }
Cada slide tem "layout" e os campos do layout:
- "capa": { titulo, subtitulo }                                   (sempre o 1º)
- "objetivos": { titulo, itens: ["..."] }                         (3 a 5 objetivos da aula)
- "secao": { numero: "01", titulo, subtitulo }                    (abre cada bloco de conteúdo)
- "cards": { titulo, cards: [ { icone: "emoji", titulo, texto } ] }   (3 ou 4 cards)
- "passos": { titulo, passos: [ { titulo, texto } ] }             (processo/etapas, 3 a 5)
- "comparacao": { titulo, esquerda: { titulo, itens }, direita: { titulo, itens } }
- "destaque": { titulo, numero: "80%", texto }                    (dado, conceito-chave ou frase de impacto)
- "topicos": { titulo, itens: ["..."] }                           (máx. 5 itens)
- "exemplo": { titulo, contexto, pergunta }                       (caso real do mundo do trabalho)
- "atividade": { titulo, tempo: "30 min", instrucoes: ["..."], entrega }
- "resumo": { titulo, itens: ["..."] }                            (penúltimo)
- "encerramento": { titulo, texto }                               (sempre o último)`,
  },
  avaliacao: {
    nome: "Avaliações (30 e 60 pontos)",
    instrucao: `Com base no PER e no Plano de Aula, elabore DUAS avaliações com gabarito: uma valendo 30 pontos e outra valendo 60 pontos.
A soma das pontuações das questões deve fechar exatamente 30 e 60. Inclua questões objetivas contextualizadas e
dissertativas/práticas, gabarito comentado e matriz de correção (Questão | Capacidade | Critério | Crítico/Desejável | Pontos).
JSON: { "avaliacao30": ${DOC_GENERICO}, "avaliacao60": ${DOC_GENERICO} }`,
  },
  atividade: {
    nome: "Atividade do educador (teórica e prática)",
    instrucao: `Com base no Plano de Aula, elabore duas atividades para o educador aplicar: uma TEÓRICA e uma PRÁTICA.
Cada uma com objetivo, capacidades, orientações, passo a passo, tempo, recursos, critérios de avaliação e resposta esperada.
JSON: { "teorica": ${DOC_GENERICO}, "pratica": ${DOC_GENERICO} }`,
  },
};

export const ORDEM = ["per", "plano", "slides", "avaliacao", "atividade"];

export function contexto(d) {
  return `Dados informados pelo instrutor:
- Curso: ${d.curso || "-"}
- Unidade Curricular (UC): ${d.uc || "-"}
- Turma: ${d.turma || "-"} | Modalidade: ${d.modalidade || "-"}
- Datas da UC: ${d.dataInicio || "-"} a ${d.dataTermino || "-"} | Dias/horário: ${d.dias || "-"}
- Instrutor: ${d.instrutor || "-"} | Segmento: ${d.segmento || "-"}
- Tema da situação de aprendizagem: ${d.tema || "-"}
- Recursos/ambiente: ${d.recursos || "-"}
- Observações: ${d.observacoes || "-"}`;
}
