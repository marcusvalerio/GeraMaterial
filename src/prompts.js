// Sequência de entregas: 1º PER (planilha), 2º Plano de Aula (Word, encontro por encontro),
// 3º Avaliações de 30 e 60 pontos + gabarito do professor, 4º Atividade do educador (EP-190 + roteiro).
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
    nome: "Plano de Aula",
    instrucao: `Com base no PER, elabore o PLANO DE AULA da Unidade Curricular, DESTRINCHADO encontro por encontro.
Regras:
- Um bloco em "dias" para CADA encontro do calendário (use as datas informadas; sem calendário, divida a carga horária da UC
  em encontros de 4 horas). Nunca agrupe vários encontros num bloco só.
- Os conhecimentos vêm do documento de referência, numerados como tópicos e subtópicos (ex.: "1.1 Definição", "1.2 Etapas").
  Todos os grupos de conhecimentos da UC precisam aparecer distribuídos pelos encontros.
- Em cada encontro: objetivo claro (verbo no infinitivo), estratégia da MSEP (aula dialogada, estudo de caso, situação-problema,
  projeto, simulação, oficina...), atividade concreta e detalhada que os alunos fazem, e como a aprendizagem é avaliada.
- Reserve encontros para as avaliações de 30 e 60 pontos (a de 60 pontos no último encontro), coerentes com o formato escolhido.
- "distribuicao" soma exatamente a carga horária da UC.
JSON:
{ "titulo": "PLANO DE AULA – SENAI", "uc": "", "curso": "", "cargaHoraria": "60 horas",
  "organizacao": "15 encontros presenciais de 4 horas", "referencia": "Metodologia SENAI de Educação Profissional (MSEP)",
  "objetivoGeral": "texto",
  "distribuicao": [ { "grupo": "1. Nome do grupo de conhecimentos", "ch": "4h" } ],
  "observacaoDistribuicao": "ex.: as 4 horas restantes são da avaliação integradora",
  "dias": [ { "numero": 1, "data": "dd/mm/aaaa", "titulo": "Processo de Armazenagem", "horas": "4 horas",
      "conhecimentos": ["1.1 Definição", "1.2 Etapas"], "objetivo": "", "estrategia": "", "atividade": "", "avaliacao": "" } ],
  "organizacaoDiaria": [ { "etapa": "Contextualização e revisão", "tempo": "30 min", "desenvolvimento": "" } ],
  "instrumentos": [ { "tipo": "Avaliação diagnóstica", "descricao": "" } ],
  "recursos": "lista de recursos didáticos em texto corrido", "observacaoRecursos": "",
  "resultadoEsperado": "texto" }`,
  },
  avaliacao: {
    nome: "Avaliações (30 e 60 pontos) e gabarito",
    instrucao: `Com base no PER e no Plano de Aula, elabore DUAS avaliações: uma valendo 30 pontos e outra valendo 60 pontos,
e um GABARITO separado, só para o professor.
Siga EXATAMENTE o "Formato das avaliações escolhido pelo instrutor" (informado acima) — não troque o formato.
- Prova: exatamente o número de questões pedido; as primeiras são objetivas de múltipla escolha (alternativas a–e, contextualizadas)
  e as demais discursivas, na quantidade indicada. A prova do aluno NÃO traz respostas.
- Atividade em grupo: orientações para formar os grupos (alunos por grupo), o desafio, o que cada grupo entrega/apresenta,
  tempo de preparo e de apresentação, e rubrica de avaliação por critérios.
- Prática ou situação-problema: contexto real, tarefa, recursos, tempo e rubrica por critérios.
Em todas: a soma das pontuações fecha exatamente 30 e 60, e há matriz de correção
(Item | Capacidade | Critério | Crítico/Desejável | Pontos).
GABARITO (documento do professor): uma seção para a avaliação de 30 e outra para a de 60. Para cada questão objetiva,
a alternativa correta e uma justificativa curta; para cada discursiva, a resposta esperada e como distribuir os pontos
(o que vale nota total, parcial ou zero); para atividade em grupo ou prática, o que se espera de cada critério da rubrica.
Use uma tabela "Questão | Resposta | Pontos" quando houver questões objetivas.
JSON: { "avaliacao30": ${DOC_GENERICO}, "avaliacao60": ${DOC_GENERICO}, "gabarito": ${DOC_GENERICO} }`,
  },
  atividade: {
    nome: "Atividade do educador (EP-190 – Situação de Aprendizagem)",
    instrucao: `Com base no PER e no Plano de Aula, elabore a SITUAÇÃO DE APRENDIZAGEM que o educador vai aplicar
(formulário EP-190) e o ROTEIRO detalhado dela.
- A situação de aprendizagem é desafiadora e realista, ligada ao tema e às capacidades da UC.
- "passos": o passo a passo DESTRINCHADO em tópicos, na ordem em que acontece (ex.: "1. Apresentação do problema — ...",
  "2. Formação dos grupos — ...", "2.1 ..."); entre 8 e 20 itens.
- O roteiro (Word) detalha cada etapa: tempo, o que o docente faz, o que os alunos fazem, entregas e critérios de avaliação.
JSON:
{ "segmento": "", "uc": "NOME DA UC + CH", "curso": "", "instrutor": "", "numero": "1",
  "estrategia": "Situação-problema" | "Estudo de Caso" | "Projeto" | "Pesquisa Aplicada",
  "contextualizacaoTitulo": "data (tema)", "contextualizacao": "texto do cenário",
  "desafio": ["..."], "resultados": ["..."], "capacidades": ["..."], "conhecimentos": ["..."],
  "criterio": "Qualitativo e Quantitativo", "critico": true, "desejavel": true,
  "materialConsumo": "", "ferramentas": "", "epis": "", "epcs": "", "equipamentos": "", "instrumentos": "",
  "bibliografia": ["..."], "data": "dd/mm/aaaa", "responsavel": "",
  "passos": ["1. ..."],
  "roteiro": ${DOC_GENERICO} }`,
  },
};

export const ORDEM = ["per", "plano", "avaliacao", "atividade"];

// Formato das avaliações escolhido pelo instrutor, em texto para a IA.
export function descreverAvaliacoes(av) {
  if (!av) return "";
  const um = (pts, a) => {
    if (!a) return "";
    const obs = a.obs ? ` Observação do instrutor: ${a.obs}` : "";
    if (a.tipo === "prova") {
      const disc = a.questoes - a.objetivas;
      const faixa = a.objetivas === a.questoes ? `todas as ${a.questoes} objetivas de múltipla escolha`
        : a.objetivas === 0 ? `todas as ${a.questoes} discursivas`
        : `questões 1 a ${a.objetivas} objetivas de múltipla escolha e ${a.objetivas + 1} a ${a.questoes} discursivas (${disc})`;
      return `- Avaliação de ${pts} pontos: PROVA com ${a.questoes} questões — ${faixa}.${obs}`;
    }
    if (a.tipo === "grupo") return `- Avaliação de ${pts} pontos: ATIVIDADE EM GRUPO, ${a.porGrupo} alunos por grupo, entrega: ${a.entrega}.${obs}`;
    return `- Avaliação de ${pts} pontos: PRÁTICA / SITUAÇÃO-PROBLEMA avaliada por rubrica.${obs}`;
  };
  return `\nFormato das avaliações escolhido pelo instrutor (obrigatório):\n${um(30, av["30"])}\n${um(60, av["60"])}`;
}

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
- Observações: ${d.observacoes || "-"}${d.participacao ? `\n- Participação do instrutor: ${d.participacao}` : ""}${descreverAvaliacoes(d.avaliacoes)}`;
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
