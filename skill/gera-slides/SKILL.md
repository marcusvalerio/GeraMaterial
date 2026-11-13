---
name: gera-slides
description: Gera slides .pptx bem acabados (visual moderno, estilo "Lovable") para um encontro de aula a partir do Plano de Aula SENAI/MSEP gerado pelo GeraMaterial. Use quando o instrutor enviar um Plano de Aula (PDF/Word) e pedir os slides de um dia/encontro, ou de todos os encontros.
---

# Slides de aula a partir do Plano de Aula

O Plano de Aula (PDF ou Word do GeraMaterial) é a **base** dos slides. Cada "Dia NN" do plano vira **uma apresentação**.

## Fluxo
1. Leia o Plano de Aula inteiro. Identifique: UC, curso, instrutor, e para cada dia: título, data, conhecimentos, objetivo, estratégia MSEP, atividade e avaliação. Leia também a "Organização das quatro horas" (vira a agenda).
2. Pergunte (se o instrutor não disse) **qual dia** gerar. "Todos" = uma apresentação por dia, gerando um de cada vez.
3. Escreva o **roteiro JSON** do dia seguindo `reference/roteiro.md` (layouts, campos e regras de conteúdo). Veja `exemplos/dia-03-conferencia.json` como referência de qualidade.
4. Gere o arquivo:
   ```bash
   npm install pptxgenjs   # se ainda não estiver instalado
   node scripts/gerar-slides.cjs roteiro.json "Dia 03 - Conferência.pptx"
   ```
5. Confira o resultado convertendo para imagem (se houver LibreOffice: `soffice --headless --convert-to pdf`), corrija textos que estourem a caixa e entregue o .pptx.

## Regras de conteúdo (o que deixa o slide "bem trabalhado")
- **Uma ideia por slide.** Título é uma frase que afirma ou pergunta, não um rótulo ("Conferir evita estoque fantasma", não "Conferência").
- **Pouco texto:** no máximo 4–6 itens por slide e ~12 palavras por item. O detalhe vai nas `notas` (o que o instrutor fala).
- **Varie os layouts:** nunca dois iguais seguidos; alterne claro/escuro (`pergunta`, `destaque` quebram o ritmo).
- **Siga a MSEP e o plano:** os conhecimentos com a numeração do plano, a estratégia do dia (estudo de caso, situação-problema, simulação…) e a atividade exatamente como no plano, com o produto entregue e o instrumento de avaliação.
- **Contexto real da profissão:** exemplos e perguntas do dia a dia do trabalhador (ex.: canhoto da NF, WMS, cross-dock), nunca genéricos.
- **Não invente dados:** números no layout `dados` só com fonte conhecida; se não tiver, use outro layout.

## Estrutura padrão de um encontro (10–14 slides)
`capa` → `agenda` (da organização das 4 horas) → `objetivos` (do objetivo do dia) → `pergunta` (problematização) →
2–4 slides de conteúdo (`conceito`, `processo`, `cards`, `comparacao`, `dados`, `destaque`) →
`atividade` (do plano) → `avaliacao` (critérios críticos/desejáveis) → `resumo` → `encerramento` (próximo encontro).
Em dia de prova ou apresentação, troque o conteúdo por orientações da avaliação.
