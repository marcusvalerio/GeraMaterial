# GeraMaterial SENAI

Aplicação web que ajuda instrutores do SENAI a gerar materiais didáticos com IA (Claude), seguindo a Metodologia SENAI de Educação Profissional (MSEP).

## Materiais gerados
- **Plano de Aula** – capacidades, conhecimentos, desenvolvimento da aula, critérios de avaliação.
- **Situação de Aprendizagem** – contextualização, desafio, entregas, critérios críticos/desejáveis.
- **Avaliação e Gabarito** – questões objetivas e dissertativas, gabarito comentado e matriz de correção.

Exportação em **Word (.docx)**, **PDF** e **Slides (.pptx)**.

## Como rodar
Requer Node.js 18+ e uma chave de IA gratuita (Google Gemini, Groq ou OpenRouter — veja `.env.example`).

```bash
npm install
export ANTHROPIC_API_KEY=sua_chave
npm start
```
Acesse http://localhost:3000, preencha curso, UC, tema e capacidades, clique em **Gerar material**, revise a prévia e baixe no formato desejado.

## Estrutura
- `src/server.js` – API (`/api/gerar`, `/api/exportar/:formato`)
- `src/prompts.js` – instruções de cada etapa da sequência (PER → Plano de Aula → PPTX → Avaliações 30/60 → Atividade)
- `src/planilhas.js` – preenche os modelos oficiais em `modelos/` (PER .xlsx e EP-190 .xlsm) sem alterar o layout
- `src/exportar.js` – geração de DOCX, PDF e PPTX
- `public/` – interface web

## Banco de dados (Neon)
O histórico de sequências fica no Postgres do Neon (tabelas `sequencias` e `entregas`).
Copie `.env.example` para `.env` e preencha `DATABASE_URL` e `ANTHROPIC_API_KEY`.
Sem `DATABASE_URL` o sistema funciona normalmente, apenas sem histórico.
