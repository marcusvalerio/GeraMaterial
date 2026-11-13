---
name: gera-slides
description: Gera slides .pptx bem acabados (visual moderno, estilo "Lovable") para um encontro de aula a partir do Plano de Aula SENAI/MSEP gerado pelo GeraMaterial. Use quando o instrutor enviar um Plano de Aula (PDF/Word) e pedir os slides de um dia/encontro, ou de todos os encontros.
---

# Slides de aula a partir do Plano de Aula

O Plano de Aula (PDF ou Word do GeraMaterial) é a **base** dos slides. Cada "Dia NN" do plano vira **uma apresentação**.

## Estilo visual (padrão aprovado — não mude)
O gerador já entrega o estilo aprovado pelo instrutor; use-o como está:
- **Fundos em cor sólida, sem degradê:** cinza-azulado claro (`EEF2F8`) nos slides de conteúdo; azul-marinho (`14213D`) em capa, pergunta, destaque e encerramento.
- Paleta: azul `2563EB`, azul-claro `0EA5E9`, âmbar `F59E0B`, verde `10B981`, vermelho `EF4444`; fonte Inter.
- Cartões brancos com cantos arredondados e sombra suave, ícones em quadrados coloridos, desenhos flat próprios.
- **Não passe `tema`** no roteiro e não acrescente degradês, imagens externas ou outros fundos, a menos que o instrutor peça.
- O resultado deve ficar igual a `exemplos/Dia 03 - Conferência.pptx` (referência visual e de conteúdo).

## Fluxo
1. Leia o Plano de Aula inteiro. Identifique: UC, curso, instrutor, e para cada dia: título, data, conhecimentos, objetivo, estratégia MSEP, atividade e avaliação. Leia também a "Organização das quatro horas" (vira a agenda).
2. Pergunte (se o instrutor não disse) **qual dia** gerar. "Todos" = uma apresentação por dia, gerando um de cada vez.
3. Escreva o **roteiro JSON** do dia seguindo `reference/roteiro.md` (layouts, campos e regras de conteúdo). Veja `exemplos/dia-03-conferencia.json` como referência de qualidade.
4. Gere o arquivo:
   ```bash
   npm install pptxgenjs @resvg/resvg-js   # se ainda não estiverem instalados
   node scripts/gerar-slides.cjs roteiro.json "Dia 03 - Conferência.pptx"
   ```
5. Confira o resultado convertendo para imagem (se houver LibreOffice: `soffice --headless --convert-to pdf`), corrija textos que estourem a caixa e entregue o .pptx.

## Regras de conteúdo (o que deixa o slide "bem trabalhado")
- **Uma ideia por slide.** Título é uma frase que afirma ou pergunta, não um rótulo ("Conferir evita estoque fantasma", não "Conferência").
- **Pouco texto:** no máximo 4–6 itens por slide e ~12 palavras por item. O detalhe vai nas `notas` (o que o instrutor fala).
- **Varie os layouts:** nunca dois iguais seguidos; alterne claro/escuro (`pergunta`, `destaque` quebram o ritmo).
- **Siga a MSEP e o plano:** os conhecimentos com a numeração do plano, a estratégia do dia (estudo de caso, situação-problema, simulação…) e a atividade exatamente como no plano, com o produto entregue e o instrumento de avaliação.
- **Contexto real da profissão:** exemplos e perguntas do dia a dia do trabalhador (ex.: canhoto da NF, WMS, cross-dock), nunca genéricos.
- **Desenhe:** use `desenho` em capa, pergunta, objetivos, caso, ilustração e encerramento, e `icone` em cards/passos/agenda. Escolha o desenho que conversa com o assunto (caminhão no recebimento, notaFiscal na conferência, seguranca em EPI…). Não repita o mesmo desenho em slides seguidos.
- **Interação:** todo encontro tem pelo menos um `caso` (situação real) e um `quiz`. Quando houver documento ou equipamento, use `ilustracao` com marcadores.
- **Não invente dados:** números no layout `dados` só com fonte conhecida; se não tiver, use outro layout.

## Estrutura padrão de um encontro (14–18 slides)
`capa` → `agenda` (da organização das 4 horas) → `objetivos` (do objetivo do dia) → `pergunta` (problematização) →
4–6 slides de conteúdo (`conceito`, `ilustracao`, `processo`, `cards`, `comparacao`, `dados`, `destaque`) com um `caso` e um `quiz` no meio →
`atividade` (do plano) → `avaliacao` (critérios críticos/desejáveis) → `resumo` → `encerramento` (próximo encontro).
Em dia de prova ou apresentação, troque o conteúdo por orientações da avaliação.
