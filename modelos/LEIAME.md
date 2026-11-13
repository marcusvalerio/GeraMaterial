# Modelos oficiais de planilha

Estes arquivos são a **estrutura vazia** dos formulários oficiais. Eles não devem conter dados de nenhuma turma ou curso: todo conteúdo é gravado pelo `src/planilhas.js` a partir do JSON gerado pela IA. O código grava todas as células mapeadas, mesmo quando o campo vem vazio, para que nada do modelo sobre no arquivo baixado.

Ao substituir um modelo, mantenha apenas rótulos, logos, mesclagens, estilos, comentários de orientação e configurações de impressão. Apague textos de exemplo, datas, nomes, marcações "X" e fotos.

## PER_MODELO.xlsx (Plano de Ensino Referencial) · aba `Planilha1`

| Célula | Campo do JSON | Observação |
| --- | --- | --- |
| A5 | curso | "Curso: …" |
| F5 | cargaHorariaCurso | "Carga horário do curso: …" (rótulo do modelo oficial) |
| J5 | modalidade | |
| D6 | competenciaGeral | |
| A10 / G10 / K10 | uc / cargaHorariaUC / modulo | |
| A11 / F11 / K11 | dataInicio / dataTermino / turma | |
| D12 | objetivoUC | |
| A16, A19, A21, A26, A30, A34, A38, A43, A48, A51, A55, A61, A64, A68 | aulas[].data | 14 linhas; com mais aulas, datas são agrupadas |
| B16, B21, B26, B30, B38, B48, B51, B55, B61, B64 | soma de aulas[].ch | cada CH cobre uma ou duas linhas de data |
| C16 | capacidadesTecnicas | uma por linha |
| F16, F21, F26, F30, F38, F48, F51, F54, F55, F60, F64, F68, F72 | conhecimentos | até 13 blocos; o último recebe o restante |
| I16 / L16 | estrategias / criterios | |
| A78, C78, I78 | avaliacao30.data / instrumento / criterios | |
| A82, C82, I82 | avaliacao60.data / instrumento / criterios | |
| A85 | instrutor | "Nome do instrutor: …" |

## EP-190_MODELO.xlsm (Plano da Situação de Aprendizagem)

Os comentários das células (orientações "Apresente o contexto…", "Redija o desafio…") são do formulário oficial e devem ser mantidos.

**Aba `FL_1`**

| Célula | Campo do JSON |
| --- | --- |
| F7 / F8 / F9 / F10 | segmento / uc / curso / instrutor |
| L12 | numero |
| C14, E14, G14, I14 | estrategia: recebe "X" na opção escolhida (Situação-problema, Estudo de Caso, Projeto, Pesquisa Aplicada) |
| B18 | contextualizacaoTitulo ("Contextualização: data (tema)") |
| B19 | contextualizacao |
| B22 | desafio (lista) |
| B25 | resultados (lista) |

**Aba `FL_2`**

| Célula | Campo do JSON |
| --- | --- |
| B9 / C9 | capacidades / conhecimentos (listas) |
| D9 | criterio (padrão "Qualitativo e Quantitativo") |
| E9 / F9 | critico / desejavel ("X" quando true) |
| C39 a C44 | materialConsumo, ferramentas, epis, epcs, equipamentos, instrumentos |
| C45 | bibliografia (lista) |
| C48 / C49 | data / responsavel |

**Aba `Anexos`**

| Célula | Campo do JSON |
| --- | --- |
| B33 | rótulo fixo "1 PASSO:" |
| B34 em diante | passos (até 25) |
