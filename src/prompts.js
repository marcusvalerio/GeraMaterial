// Prompts para cada tipo de material, alinhados à Metodologia SENAI de Educação Profissional (MSEP).

const FORMATO = `
Responda SOMENTE com um objeto JSON válido (sem markdown, sem texto antes ou depois) no formato:
{
  "titulo": "string",
  "secoes": [
    {
      "titulo": "string",
      "paragrafos": ["string", ...],          // opcional
      "itens": ["string", ...],               // opcional (lista com marcadores)
      "tabela": { "cabecalho": ["..."], "linhas": [["..."]] }  // opcional
    }
  ]
}
Use linguagem clara, em português do Brasil, adequada ao ensino técnico/profissional.`;

const SISTEMA = `Você é um especialista pedagógico do SENAI, com domínio da Metodologia SENAI de Educação Profissional (MSEP):
desenvolvimento de competências a partir de capacidades técnicas e socioemocionais, situações de aprendizagem
(situação-problema, estudo de caso, projeto, pesquisa aplicada), mediação do docente e avaliação por critérios
(críticos e desejáveis). Você produz materiais prontos para uso por instrutores.`;

function contexto(d) {
  return `Dados informados pelo instrutor:
- Curso: ${d.curso || "-"}
- Unidade Curricular (UC): ${d.uc || "-"}
- Tema/assunto da aula: ${d.tema || "-"}
- Carga horária: ${d.cargaHoraria || "-"}
- Capacidades técnicas: ${d.capacidadesTecnicas || "-"}
- Capacidades socioemocionais: ${d.capacidadesSocio || "-"}
- Conhecimentos: ${d.conhecimentos || "-"}
- Perfil da turma: ${d.perfilTurma || "-"}
- Recursos/ambiente disponíveis: ${d.recursos || "-"}
- Observações: ${d.observacoes || "-"}`;
}

const INSTRUCOES = {
  plano: `Elabore um PLANO DE AULA / PLANO DE ENSINO no padrão MSEP. Inclua as seções:
Identificação (curso, UC, tema, carga horária); Capacidades técnicas e socioemocionais; Conhecimentos;
Estratégia de aprendizagem desafiadora; Desenvolvimento da aula em tabela (Momento | Tempo | Atividades do docente | Atividades dos alunos | Recursos);
Critérios de avaliação (críticos e desejáveis) em tabela; Instrumentos de avaliação; Recursos didáticos; Referências.`,

  situacao: `Elabore uma SITUAÇÃO DE APRENDIZAGEM no padrão MSEP. Inclua as seções:
Identificação; Estratégia de aprendizagem desafiadora (tipo escolhido e justificativa);
Contextualização (cenário realista do mundo do trabalho); Desafio; Resultados/entregas esperadas;
Capacidades mobilizadas; Conhecimentos; Etapas de desenvolvimento com tempo estimado;
Critérios de avaliação em tabela (Capacidade | Critério | Tipo: crítico/desejável); Mediação do docente; Recursos.`,

  avaliacao: `Elabore uma AVALIAÇÃO com GABARITO. Inclua as seções:
Identificação e orientações ao aluno; Questões objetivas (múltipla escolha com alternativas a-e, contextualizadas);
Questões dissertativas/práticas; Gabarito comentado (resposta correta e justificativa de cada questão);
Matriz de correção em tabela (Questão | Capacidade avaliada | Critério | Tipo crítico/desejável | Pontuação).
Use entre 8 e 12 questões salvo indicação em contrário.`,
};

export function montarPrompt(tipo, dados) {
  const instr = INSTRUCOES[tipo];
  if (!instr) throw new Error(`Tipo de material inválido: ${tipo}`);
  return { system: SISTEMA, user: `${instr}\n\n${contexto(dados)}\n${FORMATO}` };
}

export const TIPOS = { plano: "Plano de Aula", situacao: "Situação de Aprendizagem", avaliacao: "Avaliação e Gabarito" };
