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
| `capa` | `olho`, `titulo`, `subtitulo`, `desenho` | abertura (fundo escuro) |
| `agenda` | `titulo`, `itens`: [{`titulo`, `tempo`}] (até 6) | etapas das 4 horas |
| `objetivos` | `olho`, `titulo`, `itens`: [texto] (até 4), `desenho` | o que o aluno será capaz de fazer |
| `pergunta` | `olho`, `pergunta`, `dica`, `desenho` | problematização (fundo escuro) |
| `conceito` | `olho`, `titulo`, `definicao`, `pontos`: [texto ou {`texto`, `icone`}] (até 4), `desenho` | definição + pontos-chave |
| `cards` | `olho`, `titulo`, `itens`: [{`titulo`, `texto`, `icone`}] (2–4) | tipos, categorias, características |
| `processo` | `olho`, `titulo`, `passos`: [{`titulo`, `texto`, `icone`}] (3–6) | fluxo, etapas, procedimento |
| `comparacao` | `titulo`, `esquerda`/`direita`: {`titulo`, `itens`} | certo × errado, antes × depois |
| `dados` | `titulo`, `itens`: [{`valor`, `rotulo`}] (até 3), `fonte` | números de impacto (com fonte) |
| `destaque` | `frase`, `autor`, `desenho` | frase-chave, norma, regra de ouro (fundo escuro) |
| `caso` | `titulo`, `situacao`, `pergunta`, `desenho` | caso real da profissão: "o que você faria?" |
| `quiz` | `pergunta`, `alternativas` (4), `correta` (0–3), `explicacao`, `mostrarResposta` | checagem rápida; a resposta vai para as notas |
| `ilustracao` | `titulo`, `desenho`, `marcadores`: [{`titulo`, `texto`, `x`, `y`}] (até 4; x/y em % do desenho) | desenho com partes explicadas (ex.: campos da NF) |
| `atividade` | `olho`, `titulo`, `passos`, `formato`, `tempo`, `entrega` | atividade do plano |
| `avaliacao` | `titulo`, `criterios`: [{`criterio`, `evidencia`, `tipo`: "Crítico"/"Desejável"}] | critérios MSEP |
| `resumo` | `titulo`, `itens`: [texto] (até 6) | síntese |
| `encerramento` | `titulo`, `proxima`, `tarefa`, `desenho` | fechamento |

## Desenhos (`desenho`)
Ilustrações flat nas cores do tema, feitas pelo próprio gerador (sem internet):
`caminhao`, `caixas`, `notaFiscal`, `checklist`, `empilhadeira`, `almoxarifado`, `computador`, `seguranca`,
`equipe`, `instrutor`, `lupa`, `fluxo`, `alvo`, `ideia`, `relogio`, `trofeu`.

## Ícones (`icone`)
Em cards, agenda, pontos e passos (no lugar do número):
`caminhao`, `caixa`, `documento`, `check`, `alerta`, `lupa`, `computador`, `pessoas`, `relogio`, `escudo`, `capacete`,
`setas`, `grafico`, `alvo`, `ideia`, `balanca`, `estoque`, `codigo`, `pergunta`, `livro`.

Limites de texto para caber: títulos até ~60 caracteres; itens até ~70; `definicao` até ~200; textos de card até ~90.
