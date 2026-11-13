# gera.documento

Aplicação web que ajuda instrutores do SENAI a gerar materiais didáticos com IA (Claude), seguindo a Metodologia SENAI de Educação Profissional (MSEP).

## Materiais gerados
- **PER** – Plano de Ensino e Recursos (planilha oficial).
- **Plano de Aula** – aula a aula: conhecimentos, estratégias, recursos e avaliação (Word/PDF).
- **Avaliações 30 e 60 pontos** – com gabarito comentado e matriz de correção (Word/PDF).
- **Atividade do educador** – Situação de Aprendizagem no formulário EP-190 + atividades teórica e prática (Word).

Exportação em **Word (.docx)**, **PDF** e planilhas oficiais (**PER .xlsx** e **EP-190 .xlsm**).

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
- `src/prompts.js` – instruções de cada etapa da sequência (PER → Plano de Aula → Avaliações 30/60 → Atividade do educador/EP-190)
- `src/planilhas.js` – preenche os modelos oficiais em `modelos/` (PER .xlsx e EP-190 .xlsm) sem alterar o layout
- `src/exportar.js` – geração de DOCX e PDF
- `public/` – interface web

## Banco de dados (Neon)
O histórico de sequências fica no Postgres do Neon (tabelas `sequencias` e `entregas`).
Copie `.env.example` para `.env` e preencha `DATABASE_URL` e `ANTHROPIC_API_KEY`.
Sem `DATABASE_URL` o sistema funciona normalmente, apenas sem histórico.
