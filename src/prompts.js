import { ICONES } from "./slides.js";
// Sequência de entregas (padrão): 1º PER, 2º Plano de Aula (EP-190), 3º PPTX,
// 4º Avaliações (30 e 60 pontos), 5º Atividade do educador (teórica e prática).
// Base: MSEP + documento de referência enviado pelo instrutor.

export const SISTEMA = `Você é um especialista pedagógico do SENAI, com domínio da Metodologia SENAI de Educação Profissional (MSEP):
capacidades técnicas e socioemocionais, situações de aprendizagem (situação-problema, estudo de caso, projeto,
pesquisa aplicada), mediação do docente e avaliação por critérios críticos e desejáveis.
Use o DOCUMENTO DE REFERÊNCIA (plano de curso, ementa etc.) como fonte principal: copie capacidades, conhecimentos
e cargas horárias exatamente como estão nele, sem inventar.
Atenção: o texto do PDF pode vir com frases quebradas em várias linhas ou misturadas entre colunas.
Reconstrua cada capacidade e cada conhecimento como uma frase completa (ex.: "Armazenar respeitando o endereçamento
preestabelecido pela empresa"), nunca pedaços soltos. Use somente a Unidade Curricular informada pelo instrutor. Escreva em português do Brasil.
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
    instrucao: `Com base no PER e no Plano de Aula, crie a apresentação da aula (18 a 26 slides), no estilo editorial do SENAI:
objetiva, organizada em BLOCOS de conteúdo, com exemplos reais do mundo do trabalho. PROIBIDO usar emojis em qualquer texto. Use exatamente os nomes de campos em português indicados abaixo.
Ícones: use SOMENTE nomes desta lista no campo "icone": ${ICONES.join(", ")}.
Cada slide tem "olho" (rótulo curto acima do título, ex.: "BLOCO 1 · FUNDAMENTOS") e textos curtos. JSON:
{ "titulo": "", "rodape": "Curso | Unidade Curricular", "professor": "Professor(a) Nome", "slides": [ ... ] }
Layouts disponíveis ("layout") e seus campos:
- "capa" (1º slide): { olho: "SENAI · CURSO", contexto: "UC", modulo: "MÓDULO X", titulo, professor, subtitulo: "Carga horária...",
   lateral: [ { rotulo: "AULA 01", texto: "temas" } ] }
- "abertura" (início de cada aula/encontro): { olho: "Aula", numero: "01", titulo, subtitulo: "4 horas · teoria e prática", itens: ["tópicos da aula"] }
- "objetivos": { olho, titulo: "Ao final desta aula, você será capaz de:", itens: [4 a 6 objetivos] }
- "conceito": { olho, titulo, texto: "definição", cards: [ { icone, titulo, texto } ] (3 a 6), exemplo: { rotulo: "NA ROTINA", titulo, texto }, nota }
- "cards": { olho, titulo, cards: [ { icone, titulo, texto, citacao } ] (2 a 4), destaque: índice do card em destaque (opcional), nota }
- "jornada": { olho, titulo, passos: [ { icone, rotulo, titulo, texto } ] (3 a 5), nota }
- "fluxo": { olho, titulo, passos: [ { titulo } ] (4 a 6), destaque: índice, esquerda: { rotulo: "EXEMPLO", titulo, texto }, direita: { rotulo: "ATENÇÃO", titulo, texto } }
- "comparacao": { olho, titulo, esquerda: { rotulo, icone, titulo, itens, exemplo }, direita: { rotulo, icone, titulo, itens, exemplo } }
- "lista": { olho, titulo, itens: [ { icone, titulo, texto } ] (3 a 5), nota }
- "escala": { olho, titulo, texto, pontos: [ { rotulo, valor } ] (3: ideal, realista, limite; valor = número ou até 3 palavras), cards: [ { titulo, texto } ] (2), nota }
- "tabela": { olho, titulo, cabecalho: [...], linhas: [[...]] (até 8), alertas: ["erros comuns"] (opcional), nota }
- "caso": { olho, titulo, rotulo: "SITUAÇÃO", situacao: "texto do caso", tempo: "20 min", perguntas: [3 a 5] }
- "atividade": { olho, titulo, tempo, instrucoes: [...], entrega }
- "questoes": { olho, titulo, itens: [perguntas de fixação], nota }
- "ishikawa" (DESENHO do diagrama espinha de peixe — use sempre que a aula falar de Ishikawa/causa e efeito):
   { olho, titulo, efeito: "problema", categorias: [ { nome: "Máquina", causas: [até 3 causas curtas] } ] (6 categorias: 6M), nota }
- "ciclo" (DESENHO de ciclo — PDCA, ciclo de vida, melhoria contínua): { olho, titulo, centro: "PDCA", etapas: [ { sigla: "P", titulo, texto } ] (3 a 6) }
- "grafico" (GRÁFICO real — Pareto, comparação de valores, indicadores): { olho, titulo, tipo: "pareto" | "colunas" | "horizontal",
   serie: "nome da série", categorias: [...], valores: [números], texto: "leitura/interpretação do gráfico", nota }
REGRA: sempre que o conteúdo tiver uma ferramenta ou conceito visual (Ishikawa, PDCA, Pareto, histograma, fluxograma, gráfico),
MOSTRE o desenho com o layout correspondente (ishikawa, ciclo, grafico, fluxo), além de explicá-lo.
- "referencias" (SEMPRE o último slide): { titulo: "Fontes e bibliografia", itens: ["SOBRENOME, Nome. Título. Editora, ano."] }
   As fontes/bibliografia vão SOMENTE neste slide final — nunca no campo "nota" dos outros slides.
- "sintese" (penúltimo): { olho: "SÍNTESE", titulo: "O que levamos desta aula", frase: "frase de impacto", itens: [4 a 6] }`,
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
- Curso: ${d.curso || "-"}${d.cargaHorariaCurso ? ` (${d.cargaHorariaCurso})` : ""}
- Unidade Curricular (UC): ${d.uc || "-"}${d.cargaHorariaUC ? ` — carga horária ${d.cargaHorariaUC}` : ""}${d.modulo ? ` — módulo ${d.modulo}` : ""}
- Gere o material SOMENTE para esta unidade curricular; use do documento apenas a parte dela.${Array.isArray(d.aulasCronograma) && d.aulasCronograma.length ? `
- Calendário definido: ${d.aulasCronograma.length} aulas de ${d.horasAula || "?"}h (${d.diasAula || "-"}), de ${d.dataInicio} a ${d.dataTermino}.
  Datas das aulas: ${d.aulasCronograma.map((a) => a.data).join(", ")}.
  Distribua capacidades, conhecimentos, estratégias e avaliações ao longo dessas aulas; marque a avaliação de 30 pontos
  por volta da metade e a de 60 pontos na última aula.` : ""}
- Turma: ${d.turma || "-"} | Modalidade: ${d.modalidade || "-"}
- Datas da UC: ${d.dataInicio || "-"} a ${d.dataTermino || "-"} | Dias/horário: ${d.dias || "-"}
- Instrutor: ${d.instrutor || "-"} | Segmento: ${d.segmento || "-"}
- Tema da situação de aprendizagem: ${d.tema || "-"}
- Recursos/ambiente: ${d.recursos || "-"}
- Observações: ${d.observacoes || "-"}`;
}

// Leitura do plano de curso: identifica o curso e todas as unidades curriculares.
export const ANALISE = `Leia o DOCUMENTO DE REFERÊNCIA (plano de curso SENAI) e identifique o curso e TODAS as unidades curriculares (UCs).
Copie nomes e cargas horárias exatamente como estão no documento, sem inventar. Ignore índices, sumários e itinerários repetidos:
cada UC deve aparecer uma única vez, na ordem do curso. JSON:
{ "curso": "nome do curso", "cargaHoraria": "200h", "modalidade": "Qualificação Profissional", "eixo": "",
  "competenciaGeral": "texto da competência geral",
  "ucs": [ { "nome": "Fundamentos de Logística", "cargaHoraria": "20h", "modulo": "Básico", "objetivo": "objetivo geral da UC (resumido)" } ] }
Se o documento não for um plano de curso, devolva { "curso": "", "ucs": [] }.`;

// Roteiro de uma aula específica do calendário.
export const ROTEIRO = `Elabore o ROTEIRO desta aula específica, coerente com o que já foi dado nas aulas anteriores (diário)
e com o PER/plano da UC, se houver. Distribua o tempo total da aula entre os momentos. JSON:
{ "tema": "tema da aula em uma frase", "objetivos": ["2 a 4 objetivos"],
  "momentos": [ { "tempo": "20 min", "titulo": "Abertura", "docente": "o que o docente faz", "alunos": "o que os alunos fazem", "recursos": "" } ],
  "atividade": "atividade principal da aula", "avaliacao": "como verificar a aprendizagem nesta aula",
  "materiais": ["materiais e recursos"], "tarefa": "tarefa ou preparação para a próxima aula (opcional)" }`;
