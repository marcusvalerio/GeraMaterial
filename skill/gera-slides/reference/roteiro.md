# Formato do roteiro (JSON)

```json
{
  "titulo": "Título da aula", "uc": "Nome da UC", "encontro": "Dia 03", "data": "11/11/2026", "instrutor": "Nome",
  "tema": { "cor": "2563EB", "destaque": "F59E0B", "escuro": "14213D" },
  "slides": [ { "layout": "capa", "...": "..." } ]
}
```
`tema` é opcional (cores hex sem `#`; também `cor2`, `fundo`, `fonte`). Todo slide aceita `"notas"`: texto do instrutor no modo apresentador.

| layout | campos | uso |
|---|---|---|
| `capa` | `olho`, `titulo`, `subtitulo` | abertura (fundo escuro) |
| `agenda` | `titulo`, `itens`: [{`titulo`, `tempo`}] (até 6) | etapas das 4 horas |
| `objetivos` | `olho`, `titulo`, `itens`: [texto] (até 4) | o que o aluno será capaz de fazer |
| `pergunta` | `olho`, `pergunta`, `dica` | problematização (fundo escuro) |
| `conceito` | `olho`, `titulo`, `definicao`, `pontos`: [texto] (até 4) | definição + pontos-chave |
| `cards` | `olho`, `titulo`, `itens`: [{`titulo`, `texto`}] (2–4) | tipos, categorias, características |
| `processo` | `olho`, `titulo`, `passos`: [{`titulo`, `texto`}] (3–6) | fluxo, etapas, procedimento |
| `comparacao` | `titulo`, `esquerda`/`direita`: {`titulo`, `itens`} | certo × errado, antes × depois |
| `dados` | `titulo`, `itens`: [{`valor`, `rotulo`}] (até 3), `fonte` | números de impacto (com fonte) |
| `destaque` | `frase`, `autor` | frase-chave, norma, regra de ouro (fundo escuro) |
| `atividade` | `olho`, `titulo`, `passos`, `formato`, `tempo`, `entrega` | atividade do plano |
| `avaliacao` | `titulo`, `criterios`: [{`criterio`, `evidencia`, `tipo`: "Crítico"/"Desejável"}] | critérios MSEP |
| `resumo` | `titulo`, `itens`: [texto] (até 6) | síntese |
| `encerramento` | `titulo`, `proxima`, `tarefa` | fechamento |

Limites de texto para caber: títulos até ~60 caracteres; itens até ~70; `definicao` até ~200; textos de card até ~90.
