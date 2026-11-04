# Auditoria de qualidade dos materiais — GeraMaterial

## Objetivo
Avaliar a qualidade pedagógica, técnica e editorial dos materiais gerados pelo GeraMaterial, usando materiais de referência reais do SENAI fornecidos pelo instrutor. Esta etapa estabelece critérios de avaliação e registra a primeira melhoria controlada no prompt de geração dos slides: maior profundidade por encontro, com distribuição didática do tempo.

## Dimensões de avaliação

### 1. Qualidade pedagógica
- Aderência à Metodologia SENAI de Educação Profissional (MSEP) e aos documentos institucionais de referência.
- Alinhamento entre perfil profissional, capacidades, conhecimentos, critérios de avaliação e atividades.
- Coerência entre objetivos de aprendizagem, desenvolvimento da aula e evidências de aprendizagem.
- Progressão didática: contextualização, mobilização, desenvolvimento, síntese e avaliação.
- Adequação ao nível da turma, carga horária e unidade curricular.

### 2. Consistência técnica
- Correção conceitual e terminológica da área profissional.
- Ausência de afirmações inventadas, dados sem fonte ou exemplos tecnicamente incorretos.
- Atualidade das informações quando o tema depender de normas, legislação ou dados recentes.
- Exemplos e situações-problema realistas, contextualizados e aplicáveis.

### 3. Qualidade dos slides
- Narrativa clara, com começo, desenvolvimento e fechamento.
- Conteúdo suficiente para apoiar a aula, sem excesso de texto nem superficialidade.
- Legibilidade, hierarquia visual, consistência editorial e variedade funcional de layouts.
- Uso correto de diagramas, fluxos, tabelas, gráficos e outros recursos visuais.
- Referências identificáveis e coerentes com o conteúdo apresentado.

### 4. Qualidade das avaliações
- Questões alinhadas às capacidades e aos objetivos trabalhados.
- Enunciados claros, sem ambiguidades ou pistas involuntárias.
- Alternativas plausíveis e apenas uma resposta correta quando a questão for de escolha única.
- Gabarito correto e justificativas consistentes.
- Critérios e rubricas objetivos, observáveis e compatíveis com o nível de exigência.

### 5. Integração entre entregáveis
- Consistência entre PER, Plano de Aula, slides, avaliações e atividade do educador.
- Mesma terminologia, capacidades, conhecimentos e contexto ao longo da sequência.
- Ausência de contradições, lacunas e repetições desnecessárias.
- Carga horária e sequência de atividades compatíveis em todos os documentos.

## Protocolo de teste com material de referência
1. Selecionar um conjunto de referência fornecido pelo instrutor (documentos oficiais, modelos, plano, PER e/ou material didático).
2. Registrar os dados do caso: curso, unidade curricular, capacidades, tema, turma, carga horária e entregáveis esperados.
3. Executar o fluxo completo no ambiente Preview, sem usar dados ou credenciais de produção.
4. Comparar cada entregável com as referências, distinguindo erro factual, erro pedagógico, falha editorial e preferência de estilo.
5. Registrar evidências concretas: trecho/slide/questão, referência correspondente, gravidade e recomendação.
6. Repetir após ajustes para verificar se a correção resolveu o problema sem degradar outros entregáveis.

## Escala de avaliação
- **0 — Ausente/incorreto:** não atende ao critério ou apresenta erro grave.
- **1 — Fraco:** atende parcialmente, com lacunas importantes.
- **2 — Adequado:** atende ao esperado, com ajustes pontuais.
- **3 — Muito bom:** consistente, correto e pronto para uso com revisão normal do instrutor.

Cada nota deve vir acompanhada de evidência. Não atribuir nota apenas por aparência ou impressão geral.

## Severidade dos achados
- **Crítica:** erro que pode ensinar algo incorreto, comprometer avaliação ou violar requisito institucional.
- **Alta:** desalinhamento pedagógico importante, inconsistência entre entregáveis ou material insuficiente para conduzir a aula.
- **Média:** problema de clareza, profundidade, organização ou recurso visual.
- **Baixa:** refinamento editorial ou preferência sem impacto relevante na aprendizagem.

## Regra de decisão
Não alterar prompts ou lógica de geração com base em um único exemplo isolado. Priorizar problemas reproduzíveis, documentar a evidência e validar a correção com o mesmo caso e pelo menos um segundo caso de referência.

## Limites desta branch
Esta branch contém o protocolo de avaliação e uma alteração isolada no prompt dos slides. A meta inicial é 10 a 14 slides por encontro de 4 horas, ajustando proporcionalmente a duração e respeitando encontros reservados a avaliações. A produção permanece intocada. A alteração deve ser validada com os materiais de referência antes de qualquer promoção.
