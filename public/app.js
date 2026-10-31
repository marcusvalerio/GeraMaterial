import { montarCronograma, cronogramaDaUc, lerDiasSemAula, dataBr, noPeriodo } from "./cronograma.js";
import { iniciarPagina } from "./comum.js";

// Sequência padrão: cada etapa usa o resultado das anteriores.
const ETAPAS = [
  { id: "per", nome: "PER – Plano de Ensino e Recursos", formato: "Excel",
    downloads: (r) => [["Baixar PER", "per", r, "PER"]] },
  { id: "plano", nome: "Plano de Aula (EP-190)", formato: "Excel",
    downloads: (r) => [["Baixar EP-190", "ep190", r, "EP-190"]] },
  { id: "slides", nome: "Slides da aula", formato: "PowerPoint",
    downloads: (r) => [["Baixar slides", "pptx", r, r.titulo || "Slides"]] },
  { id: "avaliacao", nome: "Avaliações 30 e 60 pontos", formato: "Word e PDF",
    downloads: (r) => [
      ["Avaliação 30 · Word", "docx", r.avaliacao30, "Avaliacao 30 pontos"],
      ["Avaliação 60 · Word", "docx", r.avaliacao60, "Avaliacao 60 pontos"],
      ["30 · PDF", "pdf", r.avaliacao30, "Avaliacao 30 pontos", true],
      ["60 · PDF", "pdf", r.avaliacao60, "Avaliacao 60 pontos", true],
    ] },
  { id: "atividade", nome: "Atividade do educador", formato: "Word",
    downloads: (r) => [
      ["Teórica · Word", "docx", r.teorica, "Atividade teorica"],
      ["Prática · Word", "docx", r.pratica, "Atividade pratica"],
    ] },
];

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const nomeArquivo = (t) => String(t || "").replace(/[\\/:*?"<>|]/g, "").slice(0, 60).trim();

// Estado: o plano de curso lido e a fila de UCs a gerar (cada UC tem sua própria sequência).
let analise = null; // { curso, cargaHoraria, modalidade, ucs: [...] }
let crono = null; // cronograma calculado a partir das cargas horárias
let turmaAtual = null; // turma salva: { id, nome }
let fila = [novoItem()];
let atual = 0;
let gerando = false;

function novoItem(uc = null) {
  return { uc, resultados: {}, estados: {}, sequenciaId: null };
}
const item = () => fila[atual];

// ---------- Sequência (painel da direita) ----------
function render() {
  const it = item();
  const ol = $("#etapas");
  ol.innerHTML = "";
  ETAPAS.forEach((et, i) => {
    const st = it.estados[et.id] || (it.resultados[et.id] ? { tipo: "ok", msg: "Pronto para baixar" } : { tipo: "", msg: "Na fila" });
    const li = document.createElement("li");
    li.className = `etapa ${st.tipo}`;
    li.innerHTML = `<div class="icone">${st.tipo === "ok" ? "✓" : st.tipo === "erro" ? "!" : i + 1}</div>
      <div><h3>${et.nome}<span class="formato">${et.formato}</span></h3><p class="estado">${esc(st.msg)}</p></div>`;
    const corpo = li.lastElementChild;
    if (it.resultados[et.id] && st.tipo === "ok") {
      const acoes = document.createElement("div");
      acoes.className = "acoes";
      const sufixo = it.uc ? ` - ${nomeArquivo(it.uc.nome)}` : "";
      for (const [rotulo, fmt, dados, nome, alt] of et.downloads(it.resultados[et.id])) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = rotulo;
        if (alt) b.className = "alt";
        b.onclick = () => baixar(fmt, dados, nome + sufixo);
        acoes.append(b);
      }
      corpo.append(acoes);
    }
    if (st.tipo === "erro" && !gerando) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Tentar de novo a partir daqui";
      b.className = "btn-retentar";
      b.onclick = () => gerarFila(atual, i, true);
      corpo.append(b);
    }
    // Sequência salva e incompleta: continua da primeira etapa que falta, sem refazer as prontas.
    const primeiraFalta = ETAPAS.findIndex((e) => !it.resultados[e.id]);
    if (i === primeiraFalta && it.dados && !gerando && st.tipo !== "erro" && st.tipo !== "gerando") {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Continuar gerando daqui";
      b.className = "btn-retentar btn-continuar";
      b.onclick = () => gerarFila(atual, i, true);
      corpo.append(b);
    }
    ol.append(li);
  });
  const feitas = ETAPAS.filter((e) => it.resultados[e.id]).length;
  $("#barra").style.width = `${(feitas / ETAPAS.length) * 100}%`;
  $("#contagem").textContent = `${feitas} de ${ETAPAS.length}`;
  renderAbas();
}

function renderAbas() {
  const abas = $("#filaUcs");
  abas.hidden = fila.length < 2;
  if (abas.hidden) return;
  abas.innerHTML = "";
  fila.forEach((it, k) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(k === atual));
    b.textContent = it.uc?.nome || `UC ${k + 1}`;
    b.title = it.uc?.nome || "";
    if (ETAPAS.every((e) => it.resultados[e.id])) b.classList.add("pronta");
    b.onclick = () => { atual = k; render(); };
    abas.append(b);
  });
}

async function baixar(fmt, dados, nome) {
  const r = await fetch(`/api/exportar/${fmt}?nome=${encodeURIComponent(nome)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados),
  });
  if (!r.ok) return avisar("Não foi possível baixar o arquivo. Tente de novo em instantes.", true);
  const ext = { per: "xlsx", ep190: "xlsm", cronograma: "xlsx" }[fmt] || fmt;
  const url = URL.createObjectURL(await r.blob());
  Object.assign(document.createElement("a"), { href: url, download: `${nome}.${ext}` }).click();
  URL.revokeObjectURL(url);
}

// ---------- Leitura do plano de curso ----------
async function analisarPlano() {
  const caixa = $("#analise");
  const arquivos = [...inputArq.files];
  analise = null;
  aplicarModoUc();
  if (!arquivos.length) { caixa.hidden = true; return; }
  caixa.hidden = false;
  caixa.className = "analise lendo";
  caixa.textContent = "Lendo o plano de curso e identificando as unidades curriculares…";
  const corpo = new FormData();
  arquivos.forEach((f) => corpo.append("referencias", f));
  try {
    const r = await fetch("/api/analisar", { method: "POST", body: corpo });
    const j = await r.json();
    if (!r.ok) throw new Error(j.erro || "Falha ao ler o plano de curso");
    if (!j.ucs?.length) throw new Error("Não encontramos unidades curriculares neste arquivo. Confira se é o plano de curso ou preencha a UC manualmente no passo 2.");
    analise = j;
    mostrarAnalise();
    calcularCronograma();
  } catch (e) {
    caixa.className = "analise erro";
    caixa.textContent = e.message;
  }
  aplicarModoUc();
  marcarPassos();
}

function mostrarAnalise() {
  const caixa = $("#analise");
  caixa.className = "analise";
  const meta = [analise.modalidade, analise.cargaHoraria, `${analise.ucs.length} unidades curriculares`].filter(Boolean).join(" · ");
  caixa.innerHTML = `<div class="analise-curso">${esc(analise.curso || "Curso identificado")}</div>
    <p class="analise-meta">${esc(meta)}</p>
    <div class="analise-cab"><span>Quais unidades curriculares você vai gerar?</span>
      <button type="button" class="link-todas" id="btnTodas">Marcar todas</button></div>
    <ul class="lista-ucs">${analise.ucs.map((u, k) => `<li><label>
      <input type="checkbox" name="ucEscolhida" value="${k}">
      <span class="uc-nome">${esc(u.nome)}<span class="uc-modulo">${esc(u.modulo ? `Módulo ${u.modulo}` : "")}</span></span>
      <span class="uc-ch">${esc(u.cargaHoraria || "")}</span></label></li>`).join("")}</ul>`;
  const form = $("#form");
  if (analise.curso) form.elements.curso.value = analise.curso;
  if (analise.modalidade && !form.elements.modalidade.value) form.elements.modalidade.value = analise.modalidade;
  $("#btnTodas").onclick = () => {
    const caixas = [...caixa.querySelectorAll("input[name=ucEscolhida]")];
    const marcar = caixas.some((c) => !c.checked);
    caixas.forEach((c) => { c.checked = marcar; });
    $("#btnTodas").textContent = marcar ? "Desmarcar todas" : "Marcar todas";
    aoEscolherUc();
  };
  caixa.querySelectorAll("input[name=ucEscolhida]").forEach((c) => { c.onchange = aoEscolherUc; });
}

function ucsEscolhidas() {
  if (!analise) return [];
  return [...document.querySelectorAll("input[name=ucEscolhida]:checked")].map((c) => analise.ucs[Number(c.value)]);
}

function aoEscolherUc() {
  aplicarModoUc();
  calcularCronograma();
  marcarPassos();
  if (gerando) return;
  // Monta a fila de UCs escolhidas, mantendo o que já foi gerado.
  const escolhidas = ucsEscolhidas();
  if (!escolhidas.length) { fila = [novoItem()]; atual = 0; render(); return; }
  fila = escolhidas.map((u) => fila.find((it) => it.uc?.nome === u.nome) || novoItem(u));
  atual = Math.min(atual, fila.length - 1);
  render();
}

// Com o plano lido, a UC vem da lista; sem ele, o instrutor digita no passo 2.
function aplicarModoUc() {
  const comLista = Boolean(analise);
  const n = ucsEscolhidas().length;
  $("#campoUc").hidden = comLista;
  $("#passoCal").hidden = !comLista;
  $("#numAval").textContent = comLista ? "4" : "3";
  $("#numGerar").textContent = comLista ? "5" : "4";
  document.querySelectorAll(".so-manual").forEach((el) => { el.hidden = comLista; });
  $("#campoUc input").required = !comLista;
  $("#ajudaTurma").textContent = comLista
    ? "Confira o curso e informe quem dá a aula. O resto deixa o material mais certeiro."
    : "Só os três primeiros campos são obrigatórios. O resto deixa o material mais certeiro.";
  let resumo = $("#ucEscolhidas");
  if (comLista && !resumo) {
    resumo = document.createElement("p");
    resumo.id = "ucEscolhidas";
    resumo.className = "uc-escolhidas";
    $("#passo2 .grade").before(resumo);
  }
  if (resumo) {
    resumo.hidden = !comLista;
    resumo.textContent = n ? `Unidades escolhidas: ${ucsEscolhidas().map((u) => u.nome).join(", ")}` : "Escolha as unidades curriculares no passo 1.";
  }
  $("#btnGerar").textContent = n > 1 ? `Gerar materiais de ${n} unidades curriculares` : "Gerar os cinco materiais";
}

// ---------- Calendário da turma ----------
// Período em que o instrutor dá aula (null = turma inteira).
function periodo() {
  if (document.querySelector("input[name=participacao]:checked")?.value !== "periodo") return null;
  const data = (v) => { if (!v) return null; const [a, m, d] = v.split("-").map(Number); return new Date(a, m - 1, d); };
  const de = data($("#periodoDe").value), ate = data($("#periodoAte").value);
  return de || ate ? { de, ate } : null;
}

function diasEscolhidos() {
  return [...document.querySelectorAll("#diasSemana input:checked")].map((c) => Number(c.value));
}

function resumoPeriodo() {
  const per = periodo();
  if (!per || !crono) return "";
  const escolhidas = ucsEscolhidas();
  const linhas = (escolhidas.length ? escolhidas : analise.ucs).map((u) => {
    const d = cronogramaDaUc(crono, u.nome, per);
    if (!d) return "";
    return d.vazio ? `<li><strong>${esc(u.nome)}</strong>: nenhuma aula sua neste período</li>`
      : `<li><strong>${esc(u.nome)}</strong>: aulas ${d.primeira} a ${d.ultima} de ${d.total} (${d.dataInicio} a ${d.dataTermino})</li>`;
  }).join("");
  return `<div class="crono-minhas"><strong>Suas aulas</strong><ul>${linhas}</ul></div>`;
}

function calcularCronograma() {
  const caixa = $("#cronograma");
  crono = null;
  if (!analise) { caixa.innerHTML = ""; return; }
  const valorInicio = $("#inicioCurso").value;
  const horasAula = Number(String($("#horasAula").value).replace(",", "."));
  const dias = diasEscolhidos();
  if (!valorInicio || !(horasAula > 0) || !dias.length) {
    caixa.innerHTML = `<p class="crono-periodo">${!valorInicio ? "Informe a data de início do curso para ver o calendário."
      : !dias.length ? "Escolha pelo menos um dia de aula." : "Informe quantas horas tem cada aula."}</p>`;
    return;
  }
  const [a, m, d] = valorInicio.split("-").map(Number);
  crono = montarCronograma(analise.ucs, { inicio: new Date(a, m - 1, d), horasAula, dias, semAula: lerDiasSemAula($("#semAula").value) });
  if (!crono) { caixa.innerHTML = ""; return; }
  const escolhidas = new Set(ucsEscolhidas().map((u) => u.nome));
  const maxAulas = Math.max(...crono.meses.map((x) => x.aulas));
  caixa.innerHTML = `
    <div class="crono-resumo">
      <div><strong>${crono.totalAulas}</strong><span>aulas de ${String(horasAula).replace(".", ",")}h</span></div>
      <div><strong>${crono.semanas}</strong><span>semanas</span></div>
      <div><strong>${crono.meses.length}</strong><span>${crono.meses.length === 1 ? "mês" : "meses"}</span></div>
      <div><strong>${crono.totalHoras}h</strong><span>carga horária</span></div>
    </div>
    <p class="crono-periodo">O curso vai de <strong>${dataBr(crono.inicio)}</strong> a <strong>${dataBr(crono.termino)}</strong>.</p>
    ${resumoPeriodo()}
    <div class="tabela-rolagem"><table class="crono-tabela">
      <thead><tr><th>Unidade curricular</th><th class="num">Horas</th><th class="num">Aulas</th><th class="num">Início</th><th class="num">Término</th><th class="num">Semanas</th></tr></thead>
      <tbody>${crono.ucs.map((u) => `<tr class="${escolhidas.has(u.nome) ? "escolhida" : ""}${periodo() && !u.aulas.some((x) => noPeriodo(x.data, periodo())) ? " fora" : ""}">
        <td>${esc(u.nome)}</td><td class="num">${u.horas}h</td><td class="num">${u.aulas.length}</td>
        <td class="num">${u.inicio ? dataBr(u.inicio) : "-"}</td><td class="num">${u.termino ? dataBr(u.termino) : "-"}</td><td class="num">${u.semanas}</td></tr>`).join("")}</tbody>
    </table></div>
    <div class="crono-meses">${crono.meses.map((x) => `<div style="--peso:${Math.max(1, Math.round((x.aulas / maxAulas) * 10))}">
      <strong title="${esc(x.rotulo)}">${esc(x.rotulo)}</strong><span>${x.aulas} aulas · ${x.horas}h</span></div>`).join("")}</div>
    ${crono.pulados.length ? `<details class="crono-pulados"><summary>${crono.pulados.length} ${crono.pulados.length === 1 ? "dia pulado" : "dias pulados"} (feriados e dias sem aula)</summary>
      <ul>${crono.pulados.map((p) => `<li>${dataBr(p.data)} — ${esc(p.motivo)}</li>`).join("")}</ul></details>` : ""}
    <div class="crono-acoes"><button type="button" id="btnCrono">Baixar calendário (Excel)</button>
      ${turmaAtual ? `<a class="link-turma" href="turmas.html?id=${turmaAtual.id}">Abrir a turma ${esc(turmaAtual.nome)}</a>`
        : `<button type="button" id="btnSalvarTurma" class="primario">Salvar como turma</button>`}</div>
    ${turmaAtual ? "" : `<p class="crono-dica">Salvando a turma, você acompanha o diário, a frequência e as notas, e gera os materiais das próximas UCs sem reenviar o plano.</p>`}`;
  $("#btnCrono").onclick = baixarCronograma;
  if ($("#btnSalvarTurma")) $("#btnSalvarTurma").onclick = salvarTurma;
}

async function baixarCronograma() {
  if (!crono) return;
  const corpo = {
    curso: analise.curso, turma: $("#form").elements.turma.value, instrutor: $("#form").elements.instrutor.value,
    horasAula: $("#horasAula").value, dias: diasEscolhidos().map((d) => ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d]).join(", "),
    inicio: dataBr(crono.inicio), termino: dataBr(crono.termino), totalAulas: crono.totalAulas, totalHoras: crono.totalHoras, semanas: crono.semanas,
    ucs: crono.ucs.map((u) => ({ nome: u.nome, modulo: u.modulo || "", horas: u.horas, inicio: u.inicio ? dataBr(u.inicio) : "",
      termino: u.termino ? dataBr(u.termino) : "", semanas: u.semanas,
      aulas: u.aulas.map((a) => ({ data: dataBr(a.data), dia: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][a.data.getDay()], ch: a.ch })) })),
    meses: crono.meses, pulados: crono.pulados.map((p) => ({ data: dataBr(p.data), motivo: p.motivo })),
  };
  await baixar("cronograma", corpo, `Calendario - ${nomeArquivo(analise.curso)}`);
}

async function salvarTurma() {
  if (!crono) return;
  const form = $("#form");
  let nome = form.elements.turma.value.trim();
  if (!nome) {
    nome = (prompt("Nome da turma (ex.: QUA0250.02 - Noite)") || "").trim();
    if (!nome) return;
    form.elements.turma.value = nome;
  }
  let n = 0;
  const per = periodo();
  const aulas = crono.ucs.flatMap((u) => u.aulas.map((a, i) => ({ uc: u.nome, numero: ++n, numero_uc: i + 1, data: dataBr(a.data), ch: a.ch, d: a.data })))
    .filter((a) => noPeriodo(a.d, per)).map(({ d, ...a }) => a);
  if (!aulas.length) { avisar("Nenhuma aula sua no período informado. Confira as datas de participação.", true); return; }
  const dados = {
    analise: { ...analise, referencia: undefined }, referencia: analise.referencia || "",
    calendario: { inicio: $("#inicioCurso").value, horasAula: $("#horasAula").value, dias: diasEscolhidos(), semAula: $("#semAula").value,
      participacao: per ? { de: $("#periodoDe").value, ate: $("#periodoAte").value } : null },
    turma: { modalidade: form.elements.modalidade.value, segmento: form.elements.segmento.value, recursos: form.elements.recursos.value, dias: form.elements.dias.value },
  };
  $("#btnSalvarTurma").disabled = true;
  try {
    const r = await fetch("/api/turmas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome, curso: analise.curso, dados, aulas }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.erro || "Não foi possível salvar a turma.");
    turmaAtual = { id: j.id, nome };
    history.replaceState(null, "", `?turma=${j.id}`);
    mostrarFaixaTurma();
    calcularCronograma();
    avisar(`Turma ${nome} salva. Os materiais gerados agora ficam ligados a ela.`);
  } catch (e) {
    avisar(e.message, true);
    if ($("#btnSalvarTurma")) $("#btnSalvarTurma").disabled = false;
  }
}

function mostrarFaixaTurma() {
  const f = $("#faixaTurma");
  f.hidden = !turmaAtual;
  if (turmaAtual) f.innerHTML = `Gerando materiais da turma <strong>${esc(turmaAtual.nome)}</strong> · <a href="turmas.html?id=${turmaAtual.id}">abrir a turma</a>`;
}

// Abre o gerador já com o plano e o calendário de uma turma salva (?turma=ID).
async function carregarTurma(id) {
  const r = await fetch(`/api/turmas/${id}`);
  if (!r.ok) return;
  const { turma, sequencias } = await r.json();
  const d = turma.dados || {};
  if (!d.analise?.ucs?.length) return;
  turmaAtual = { id: turma.id, nome: turma.nome };
  analise = { ...d.analise, referencia: d.referencia };
  const form = $("#form");
  form.elements.curso.value = turma.curso;
  form.elements.turma.value = turma.nome;
  for (const [k, v] of Object.entries(d.turma || {})) if (form.elements[k] && v) form.elements[k].value = v;
  if (d.calendario) {
    $("#inicioCurso").value = d.calendario.inicio || "";
    $("#horasAula").value = d.calendario.horasAula || 4;
    $("#semAula").value = d.calendario.semAula || "";
    document.querySelectorAll("#diasSemana input").forEach((c) => { c.checked = (d.calendario.dias || []).includes(Number(c.value)); });
    const part = d.calendario.participacao;
    document.querySelector(`input[name=participacao][value="${part ? "periodo" : "tudo"}"]`).checked = true;
    $("#periodoCampos").hidden = !part;
    $("#periodoDe").value = part?.de || "";
    $("#periodoAte").value = part?.ate || "";
  }
  $("#listaArquivos").innerHTML = `<li>Plano de curso da turma ${esc(turma.nome)}</li>`;
  $("#analise").hidden = false;
  mostrarAnalise();
  // Sugere as UCs que ainda não têm materiais.
  const feitas = new Set(sequencias.map((s) => s.uc));
  const proxima = analise.ucs.findIndex((u) => !feitas.has(u.nome));
  if (proxima >= 0) document.querySelector(`input[name=ucEscolhida][value="${proxima}"]`).checked = true;
  mostrarFaixaTurma();
  aoEscolherUc();
}

// ---------- Avaliações: o instrutor sempre escolhe o formato ----------
const TIPOS_AV = {
  prova: ["Prova", "Questões objetivas e/ou discursivas"],
  grupo: ["Atividade em grupo", "Grupos preparam e apresentam algo"],
  pratica: ["Prática ou situação-problema", "Tarefa prática avaliada por critérios"],
};
const ENTREGAS = ["Apresentação oral", "Cartaz ou painel", "Relatório escrito", "Protótipo ou demonstração prática"];

function cartaoAvaliacao(pts) {
  return `<fieldset class="cartao-av" data-pts="${pts}">
    <legend><span class="pts">${pts} pontos</span> Avaliação de ${pts}</legend>
    <div class="tipos-av">${Object.entries(TIPOS_AV).map(([k, [t, d]]) => `<label class="opcao"><input type="radio" name="av${pts}" value="${k}"><span><strong>${t}</strong><small>${d}</small></span></label>`).join("")}</div>
    <div class="campos-av" data-tipo="prova" hidden>
      <div class="grade">
        <label>Quantas questões<input type="number" min="1" max="40" data-c="questoes" inputmode="numeric"></label>
        <label>Quantas objetivas (múltipla escolha)<input type="number" min="0" max="40" data-c="objetivas" inputmode="numeric"></label>
      </div>
      <p class="dica-av" data-dica></p>
    </div>
    <div class="campos-av" data-tipo="grupo" hidden>
      <div class="grade">
        <label>Alunos por grupo<input type="number" min="2" max="10" data-c="porGrupo" inputmode="numeric"></label>
        <label>O que os grupos entregam<select data-c="entrega">${ENTREGAS.map((e) => `<option>${e}</option>`).join("")}</select></label>
      </div>
    </div>
    <div class="campos-av" data-tipo="pratica" hidden></div>
    <label class="obs-av">Observação para a IA <span class="opcional">(opcional)</span><input data-c="obs" placeholder="Ex.: incluir cálculo da curva ABC; prova sem consulta"></label>
  </fieldset>`;
}

function montarAvaliacoes() {
  $("#avaliacoes").innerHTML = `<div class="sugestao-av"><span><strong>Sugestão:</strong> 30 pontos em prova (10 questões: 1 a 8 objetivas, 9 e 10 discursivas)
    e 60 pontos em atividade em grupo com apresentação.</span><button type="button" class="btn-secundario" id="btnSugestao">Usar sugestão</button></div>`
    + cartaoAvaliacao(30) + cartaoAvaliacao(60);
  $("#avaliacoes").addEventListener("change", atualizarAvaliacoes);
  $("#avaliacoes").addEventListener("input", atualizarAvaliacoes);
  $("#btnSugestao").onclick = () => {
    const set = (pts, tipo, campos) => {
      const c = document.querySelector(`.cartao-av[data-pts="${pts}"]`);
      c.querySelector(`input[value="${tipo}"]`).checked = true;
      for (const [k, v] of Object.entries(campos)) c.querySelector(`.campos-av[data-tipo="${tipo}"] [data-c="${k}"]`).value = v;
    };
    set(30, "prova", { questoes: 10, objetivas: 8 });
    set(60, "grupo", { porGrupo: 4, entrega: "Apresentação oral" });
    atualizarAvaliacoes();
  };
}

function atualizarAvaliacoes() {
  document.querySelectorAll(".cartao-av").forEach((c) => {
    const tipo = c.querySelector("input[type=radio]:checked")?.value;
    c.classList.toggle("escolhido", Boolean(tipo));
    c.querySelectorAll(".campos-av").forEach((b) => { b.hidden = b.dataset.tipo !== tipo; });
    const q = Number(c.querySelector('[data-c="questoes"]').value) || 0;
    const o = Math.min(Number(c.querySelector('[data-c="objetivas"]').value) || 0, q);
    c.querySelector("[data-dica]").textContent = !q ? "Informe o total de questões."
      : o === q ? `Todas as ${q} objetivas.` : o === 0 ? `Todas as ${q} discursivas.`
      : `Questões 1 a ${o} objetivas e ${o + 1 === q ? q : `${o + 1} a ${q}`} discursiva${q - o > 1 ? "s" : ""}.`;
  });
  marcarPassos();
}

// Lê as escolhas. Retorna null se alguma avaliação estiver sem formato.
function lerAvaliacoes() {
  const r = {};
  for (const c of document.querySelectorAll(".cartao-av")) {
    const tipo = c.querySelector("input[type=radio]:checked")?.value;
    if (!tipo) return null;
    const v = (k) => c.querySelector(`[data-c="${k}"]`)?.value?.trim();
    const item = { tipo, obs: v("obs") || "" };
    if (tipo === "prova") { item.questoes = Number(v("questoes")) || 10; item.objetivas = Math.min(Number(v("objetivas")) || 0, item.questoes); }
    if (tipo === "grupo") { item.porGrupo = Number(v("porGrupo")) || 4; item.entrega = v("entrega"); }
    r[c.dataset.pts] = item;
  }
  return r;
}

// ---------- Geração ----------
function validar() {
  const form = $("#form");
  const faltando = [...form.querySelectorAll("[required]")].filter((el) => !el.closest("[hidden]") && !el.value.trim());
  form.querySelectorAll("[required]").forEach((el) => el.classList.toggle("invalido", faltando.includes(el)));
  if (analise && !ucsEscolhidas().length) {
    avisar("Escolha pelo menos uma unidade curricular no passo 1.", true);
    $("#analise").scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }
  const av = lerAvaliacoes();
  if (!av) {
    avisar("Escolha o formato das duas avaliações (30 e 60 pontos) no passo Avaliações.", true);
    $("#passoAval").scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }
  if (analise && crono && periodo() && ucsEscolhidas().every((u) => cronogramaDaUc(crono, u.nome, periodo())?.vazio)) {
    avisar("Nenhuma das UCs escolhidas tem aula sua no período informado. Confira as datas.", true);
    $("#passoCal").scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }
  if (analise && !crono) {
    avisar("Preencha o calendário da turma (início do curso, horas por aula e dias de aula).", true);
    $("#passoCal").scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }
  if (faltando.length) {
    avisar(analise ? "Preencha o curso e o nome do(a) instrutor(a) para continuar." : "Preencha curso, unidade curricular e instrutor(a) para continuar.", true);
    faltando[0].focus();
    return false;
  }
  return true;
}

function dadosDaUc(base, uc) {
  if (!uc) return base;
  const datas = cronogramaDaUc(crono, uc.nome, periodo());
  return { ...base, uc: uc.nome, cargaHorariaUC: uc.cargaHoraria || "", modulo: uc.modulo || "",
    cargaHorariaCurso: analise?.cargaHoraria || "",
    ...(datas?.parcial ? { participacao: `O instrutor assume apenas as aulas ${datas.primeira} a ${datas.ultima} de ${datas.total} desta UC (${datas.dataInicio} a ${datas.dataTermino}). As aulas anteriores foram dadas por outro instrutor: não repita o conteúdo inicial, parta do ponto em que a turma está e foque nas capacidades restantes.` } : {}),
    ...(datas && !datas.vazio ? { dataInicio: datas.dataInicio, dataTermino: datas.dataTermino, aulasCronograma: datas.aulas,
      horasAula: base.horasAula, diasAula: diasEscolhidos().map((d) => ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d]).join(", ") } : {}) };
}

// Gera a fila a partir da UC `inicioUc`, começando na etapa `inicioEtapa` dela.
// Acompanha o trabalho no servidor. Falhas de rede (app em segundo plano, sinal ruim) não
// interrompem: continua consultando até o servidor dizer que terminou.
async function acompanhar(id) {
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
  for (;;) {
    await espera(document.hidden ? 8000 : 4000);
    let j;
    try {
      const r = await fetch(`/api/trabalhos/${id}`, { cache: "no-store" });
      if (r.status === 401) { location.href = "entrar.html?voltar=index.html"; throw new Error("Sessão expirada"); }
      if (r.status === 404) throw new Error("Trabalho não encontrado");
      if (!r.ok) continue;
      j = await r.json();
    } catch (e) {
      if (/Sessão|não encontrado/.test(e.message)) throw e;
      continue;
    }
    if (j.estado === "ok") return j;
    if (j.estado === "erro") throw new Error(j.erro || "Falha ao gerar");
  }
}

async function gerarFila(inicioUc = 0, inicioEtapa = 0, continuar = false) {
  const salva = continuar && fila[inicioUc]?.dados;
  if (gerando || (!salva && !validar())) return;
  if (salva) avisar("");
  else if (!inputArq.files.length && !turmaAtual) avisar("Sem plano de curso, a IA usa só os dados da turma. Funciona, mas fica menos preciso.");
  else avisar("");
  const fd = new FormData($("#form"));
  const arquivos = fd.getAll("referencias").filter((f) => f.size);
  fd.delete("referencias");
  fd.delete("ucEscolhida");
  const base = { ...Object.fromEntries(fd), avaliacoes: lerAvaliacoes() };

  gerando = true;
  $("#btnGerar").disabled = true;
  $("#btnGerar").textContent = "Gerando os materiais…";
  if (window.innerWidth < 920) $(".pilha").scrollIntoView({ behavior: "smooth", block: "start" });

  let parou = false;
  for (let k = inicioUc; k < fila.length && !parou; k++) {
    atual = k;
    const it = fila[k];
    const dados = (continuar && it.dados) || dadosDaUc(base, it.uc);
    it.dados = dados;
    for (let i = k === inicioUc ? inicioEtapa : 0; i < ETAPAS.length; i++) {
      const etapa = ETAPAS[i];
      // Na retomada, pula o que já está pronto (exceto a etapa pedida).
      if (it.resultados[etapa.id] && !(k === inicioUc && i === inicioEtapa)) continue;
      it.estados[etapa.id] = { tipo: "gerando", msg: "Escrevendo agora, leva de 1 a 4 minutos" };
      render();
      const corpo = new FormData();
      corpo.append("dados", JSON.stringify(dados));
      corpo.append("anteriores", JSON.stringify(it.resultados));
      if (it.sequenciaId) corpo.append("sequenciaId", it.sequenciaId);
      if (turmaAtual || it.turmaId) corpo.append("turmaId", turmaAtual?.id || it.turmaId);
      arquivos.forEach((f) => corpo.append("referencias", f));
      try {
        const r = await fetch(`/api/gerar/${etapa.id}`, { method: "POST", body: corpo });
        let j = await r.json();
        if (r.status === 401) { location.href = "entrar.html?voltar=index.html"; return; }
        if (!r.ok) throw new Error(j.erro || "Falha ao gerar");
        it.sequenciaId = j.sequenciaId || it.sequenciaId;
        if (j.trabalhoId) {
          it.estados[etapa.id].msg = "Escrevendo agora, leva de 1 a 4 minutos. Pode sair do app, continua gerando.";
          render();
          j = await acompanhar(j.trabalhoId);
        }
        it.resultados[etapa.id] = j.resultado;
        it.sequenciaId = j.sequenciaId || it.sequenciaId;
        it.estados[etapa.id] = { tipo: "ok", msg: "Pronto para baixar" };
      } catch (e) {
        it.estados[etapa.id] = { tipo: "erro", msg: e.message };
        parou = true;
        break;
      }
      render();
    }
  }
  gerando = false;
  $("#btnGerar").disabled = false;
  aplicarModoUc();
  render();
  const completas = fila.filter((it) => ETAPAS.every((e) => it.resultados[e.id])).length;
  if (!parou && completas === fila.length) {
    avisar(fila.length > 1 ? `${completas} unidades curriculares prontas. Use as abas da sequência para baixar cada uma.`
      : "Sequência completa. Os materiais também ficam salvos em Meus materiais.");
  }
}

// ---------- Histórico ----------
async function carregarHistorico() {
  const ul = $("#historico");
  try {
    const r = await fetch(`/api/sequencias?busca=${encodeURIComponent($("#busca").value)}`);
    const { banco, itens } = await r.json();
    if (!banco) { ul.innerHTML = `<li class="vazio">O histórico fica disponível quando o banco de dados estiver configurado.</li>`; return; }
    if (!itens.length) { ul.innerHTML = `<li class="vazio">Suas sequências geradas aparecem aqui.</li>`; return; }
    ul.innerHTML = "";
    for (const s of itens) {
      const li = document.createElement("li");
      if (s.id == item().sequenciaId) li.className = "ativo";
      const data = new Date(s.criado_em).toLocaleDateString("pt-BR");
      li.innerHTML = `<strong>${esc(s.uc)}</strong><small>${esc(s.curso)}${s.turma ? " · " + esc(s.turma) : ""} · ${data}</small>
        <div class="pontos">${ETAPAS.map((e) => `<i class="${s.etapas.includes(e.id) ? "ok" : ""}"></i>`).join("")}</div>
        <button class="excluir" type="button" aria-label="Excluir esta sequência">✕</button>`;
      li.onclick = () => abrir(s.id);
      li.querySelector(".excluir").onclick = async (ev) => {
        ev.stopPropagation();
        if (!confirm("Excluir esta sequência do histórico?")) return;
        await fetch(`/api/sequencias/${s.id}`, { method: "DELETE" });
        if (fila.some((it) => it.sequenciaId == s.id)) novo();
        carregarHistorico();
      };
      ul.append(li);
    }
  } catch {
    ul.innerHTML = `<li class="vazio">Não foi possível carregar o histórico. Verifique a conexão.</li>`;
  }
}

async function abrir(id) {
  if (gerando) return;
  const r = await fetch(`/api/sequencias/${id}`);
  if (!r.ok) return;
  const s = await r.json();
  limparPlano();
  fila = [{ ...novoItem(), resultados: s.resultados || {}, sequenciaId: s.id, dados: s.dados, turmaId: s.turma_id }];
  atual = 0;
  const form = $("#form");
  form.reset();
  for (const [k, v] of Object.entries(s.dados || {})) if (form.elements[k]) form.elements[k].value = v;
  form.querySelectorAll(".invalido").forEach((el) => el.classList.remove("invalido"));
  avisar("");
  aplicarModoUc();
  marcarPassos();
  render();
  carregarHistorico();
  gaveta(false);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function limparPlano() {
  analise = null;
  turmaAtual = null;
  history.replaceState(null, "", location.pathname);
  mostrarFaixaTurma();
  crono = null;
  $("#cronograma").innerHTML = "";
  inputArq.value = "";
  $("#listaArquivos").innerHTML = "";
  $("#analise").hidden = true;
}

function novo() {
  if (gerando) return;
  limparPlano();
  fila = [novoItem()];
  atual = 0;
  $("#form").reset();
  avisar("");
  aplicarModoUc();
  marcarPassos();
  render();
  gaveta(false);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Eventos ----------
$("#form").addEventListener("submit", (e) => {
  e.preventDefault();
  // Nova geração: zera o que havia e gera todas as UCs da fila.
  fila = analise && ucsEscolhidas().length ? ucsEscolhidas().map((u) => novoItem(u)) : [novoItem()];
  atual = 0;
  gerarFila(0, 0);
});
$("#btnNovo").onclick = novo;
function gaveta(abrir) {
  $("#lateral").classList.toggle("aberta", abrir);
  $("#veu").hidden = !abrir;
  $("#btnMenu").setAttribute("aria-expanded", String(abrir));
  if (abrir) { carregarHistorico(); $("#busca").focus(); }
}
function avisar(msg, erro = false) {
  $("#aviso").textContent = msg;
  $("#aviso").classList.toggle("erro", erro);
}
function marcarPassos() {
  const form = $("#form");
  $("#passo1").classList.toggle("feito", (inputArq.files.length > 0 || Boolean(turmaAtual)) && (!analise || ucsEscolhidas().length > 0));
  const campos = analise ? ["curso", "instrutor"] : ["curso", "uc", "instrutor"];
  $("#passoAval")?.classList.toggle("feito", Boolean(document.querySelector(".cartao-av") && lerAvaliacoes()));
  $("#passo2").classList.toggle("feito", campos.every((n) => form.elements[n].value.trim()));
}
$("#btnMenu").onclick = () => gaveta(true);
$("#btnFechar").onclick = () => gaveta(false);
$("#veu").onclick = () => gaveta(false);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") gaveta(false); });
$("#form").addEventListener("input", (e) => { e.target.classList.remove("invalido"); marcarPassos(); });
let t;
$("#busca").oninput = () => { clearTimeout(t); t = setTimeout(carregarHistorico, 250); };

const inputArq = $("#arquivos");
const mostrarArquivos = () => {
  $("#listaArquivos").innerHTML = [...inputArq.files].map((f) => `<li>${esc(f.name)}</li>`).join("");
};
const aoTrocarArquivo = () => {
  if (turmaAtual) { turmaAtual = null; history.replaceState(null, "", location.pathname); mostrarFaixaTurma(); }
  mostrarArquivos(); marcarPassos(); analisarPlano();
};
inputArq.onchange = aoTrocarArquivo;
const up = $("#upload");
up.ondragover = (e) => { e.preventDefault(); up.classList.add("arrastando"); };
up.ondragleave = () => up.classList.remove("arrastando");
up.ondrop = (e) => { e.preventDefault(); up.classList.remove("arrastando"); inputArq.files = e.dataTransfer.files; aoTrocarArquivo(); };

["#inicioCurso", "#horasAula", "#semAula", "#periodoDe", "#periodoAte"].forEach((sel) => $(sel).addEventListener("input", calcularCronograma));
$("#participacao").addEventListener("change", () => {
  const per = document.querySelector("input[name=participacao]:checked").value === "periodo";
  $("#periodoCampos").hidden = !per;
  if (per && !$("#periodoDe").value) $("#periodoDe").value = new Date().toLocaleDateString("en-CA");
  calcularCronograma();
});
montarAvaliacoes();
$("#diasSemana").addEventListener("change", calcularCronograma);

const usuario = await iniciarPagina("gerar");
if (usuario) {
  if (!$("#form").elements.instrutor.value) $("#form").elements.instrutor.value = usuario.nome;
  aplicarModoUc();
  render();
  carregarHistorico();
  const idTurma = new URLSearchParams(location.search).get("turma");
  if (idTurma) await carregarTurma(Number(idTurma));
  const idSeq = new URLSearchParams(location.search).get("sequencia");
  if (idSeq) await abrir(Number(idSeq));
}
