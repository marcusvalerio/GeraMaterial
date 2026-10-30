# GeraMaterial SENAI

Aplicação web que ajuda instrutores do SENAI a gerar materiais didáticos com IA (Claude), seguindo a Metodologia SENAI de Educação Profissional (MSEP).

## Materiais gerados
- **Plano de Aula** – capacidades, conhecimentos, desenvolvimento da aula, critérios de avaliação.
- **Situação de Aprendizagem** – contextualização, desafio, entregas, critérios críticos/desejáveis.
- **Avaliação e Gabarito** – questões objetivas e dissertativas, gabarito comentado e matriz de correção.

Exportação em **Word (.docx)**, **PDF** e **Slides (.pptx)**.

## Como rodar
Requer Node.js 18+ e uma chave da API da Anthropic.

```bash
npm install
export ANTHROPIC_API_KEY=sua_chave
npm start
```
Acesse http://localhost:3000, preencha curso, UC, tema e capacidades, clique em **Gerar material**, revise a prévia e baixe no formato desejado.

## Estrutura
- `src/server.js` – API (`/api/gerar`, `/api/exportar/:formato`)
- `src/prompts.js` – instruções pedagógicas de cada tipo de material (ajuste aqui para o padrão da sua regional)
- `src/exportar.js` – geração de DOCX, PDF e PPTX
- `public/` – interface web
