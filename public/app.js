import { montarCronograma, cronogramaDaUc, lerDiasSemAula, dataBr } from "./cronograma.js";
import { $, esc, iniciarPagina } from "./comum.js";

// Sequência padrão: cada etapa usa o resultado das anteriores.
const ETAPAS = [
  { id: "per", nome: "PER – Plano de Ensino e Recursos", formato: "Excel",
    downloads: (r) => [["Baixar PER", "per", r, "PER"]] },
  { id: "plano", nome: "Plano de Aula", formato: "Word",
    // Sequências antigas guardavam aqui o EP-190 (planilha); as novas, o plano de aula encontro por encontro.
    downloads: (r, it) => (r.dias ? [["Plano de Aula · Word", "planoaula", { ...r, instrutor: r.instrutor || it?.dados?.instrutor, turma: r.turma || it?.dados?.turma }, "Plano de Aula"]]
      : [["Baixar EP-190", "ep190", r, "EP-190"]]) },
  { id: "avaliacao", nome: "Avaliações 30 e 60 pontos e gabarito", formato: "Word e PDF",
    downloads: (r, it) => {
      const cab = (pts) => cabecalhoProva(it, pts);
      const a30 = { ...r.avaliacao30, cabecalho: cab(30) }, a60 = { ...r.avaliacao60, cabecalho: cab(60) };
      return [
        ["Avaliação 30 · Word", "docx", a30, "Avaliacao 30 pontos"],
        ["Avaliação 60 · Word", "docx", a60, "Avaliacao 60 pontos"],
        ...(r.gabarito ? [["Gabarito do professor · Word", "docx", r.gabarito, "Gabarito"]] : []),
        ["30 · PDF", "pdf", a30, "Avaliacao 30 pontos", true],
        ["60 · PDF", "pdf", a60, "Avaliacao 60 pontos", true],
      ];
    } },
  { id: "atividade", nome: "Atividade do educador (EP-190)", formato: "Excel e Word",
    // Antes: atividades teórica e prática em Word. Agora: EP-190 (situação de aprendizagem) + roteiro detalhado.
    downloads: (r) => (r.teorica || r.pratica ? [
      ["Teórica · Word", "docx", r.teorica, "Atividade teorica"],
      ["Prática · Word", "docx", r.pratica, "Atividade pratica"],
    ] : [
      ["EP-190 · Excel", "ep190", r, "EP-190 Situacao de Aprendizagem"],
      ...(r.roteiro ? [["Roteiro da atividade · Word", "docx", r.roteiro, "Roteiro da atividade"]] : []),
    ]) },
];

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
let usuarioLogado = null;
const item = () => fila[atual];

// Cabeçalho da prova: o que o sistema sabe vem preenchido; aluno, data e nota ficam para preencher.
function cabecalhoProva(it, pontos) {
  const f = $("#form").elements;
  const d = it?.dados || {};
  return {
    curso: d.curso || f.curso?.value || "",
    uc: d.uc || it?.uc?.nome || f.uc?.value || "",
    turma: d.turma || f.turma?.value || "",
    turno: d.turno || f.turno?.value || "",
    instrutor: d.instrutor || f.instrutor?.value || usuarioLogado?.nome || "",
    pontos,
  };
}

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
      const ver = document.createElement("button");
      ver.type = "button";
      ver.textContent = "Ver prévia";
      ver.className = "ver";
      ver.onclick = () => abrirPrevia(et, it.resultados[et.id], et.id);
      acoes.append(ver);
      for (const [rotulo, fmt, dados, nome, alt] of et.downloads(it.resultados[et.id], it)) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = rotulo;
        if (alt) b.className = "alt";
        b.onclick = () => baixar(fmt, dados, nome + sufixo);
        acoes.append(b);
      }
      corpo.append(acoes);
      const cf = et.id === "plano" && it.resultados.plano?.conferencia;
      if (cf && cf.total) {
        const ok = !cf.faltando.length && cf.horasOk;
        const box = document.createElement("div");
        box.className = `conferencia ${ok ? "ok" : "alerta"}`;
        box.innerHTML = ok
          ? `<strong>✓ Conferido:</strong> ${cf.total} de ${cf.total} tópicos oficiais da UC${cf.horasUC ? ` · ${cf.horasPlano}h de ${cf.horasUC}h` : ""}`
          : `<strong>Atenção na conferência:</strong> ${cf.cobertos} de ${cf.total} tópicos oficiais encontrados${cf.horasOk ? "" : ` · horas: ${cf.horasPlano}h no plano, ${cf.horasUC}h na UC`}
             ${cf.faltando.length ? `<details><summary>Ver o que faltou (${cf.faltando.length})</summary><ul>${cf.faltando.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></details>` : ""}`;
        corpo.append(box);
      }
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
  renderSlides(it);
  renderPacote(it);
}

// "Baixar tudo": todos os arquivos prontos da sequência (e os slides gerados) num .zip.
function renderPacote(it) {
  let caixa = $("#pacote");
  if (!caixa) {
    caixa = Object.assign(document.createElement("div"), { id: "pacote", className: "pacote" });
    $("#etapas").after(caixa);
  }
  const itens = itensDoPacote(it);
  caixa.hidden = itens.length < 2;
  if (caixa.hidden) return;
  caixa.innerHTML = `<button type="button" class="btn-secundario">Baixar tudo (.zip) · ${itens.length} arquivos</button>`;
  caixa.firstElementChild.onclick = async (ev) => {
    const b = ev.currentTarget;
    b.disabled = true; b.textContent = "Montando o pacote…";
    try {
      const nome = `Materiais${it.uc ? ` - ${nomeArquivo(it.uc.nome)}` : ""}`;
      const r = await fetch(`/api/exportar-pacote?nome=${encodeURIComponent(nome)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itens }) });
      if (!r.ok) throw new Error();
      const url = URL.createObjectURL(await r.blob());
      Object.assign(document.createElement("a"), { href: url, download: `${nome}.zip` }).click();
      URL.revokeObjectURL(url);
    } catch { avisar("Não foi possível montar o pacote. Tente de novo.", true); }
    renderPacote(it);
  };
}
function itensDoPacote(it) {
  const itens = [];
  for (const et of ETAPAS) {
    const r = it.resultados[et.id];
    if (!r) continue;
    for (const [, formato, dados, nome] of et.downloads(r, it)) itens.push({ formato, dados, nome });
  }
  for (const [k, r] of Object.entries(it.resultados)) if (k.startsWith("slides:") && r?.slides) itens.push({ formato: "pptx", dados: r, nome: `Slides Encontro ${k.split(":")[1]}` });
  return itens;
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
  caixa.textContent = "Lendo o plano de curso e identificando as unidades curriculares. Leva alguns segundos…";
  const corpo = new FormData();
  arquivos.forEach((f) => corpo.append("referencias", f));
  try {
    let r, j;
    try {
      r = await fetch("/api/analisar", { method: "POST", body: corpo });
      // Resposta que não é JSON = o servidor caiu ou a conexão foi cortada (ex.: app em segundo plano).
      j = await r.json().catch(() => { throw new Error("O servidor não respondeu direito desta vez. Toque em Tentar de novo."); });
    } catch (e) {
      throw new Error(/Toque/.test(e.message) ? e.message : "A conexão caiu durante a leitura. Confira a internet e toque em Tentar de novo.");
    }
    if (r.status === 401) { location.href = "entrar.html?voltar=index.html"; return; }
    if (!r.ok) throw new Error(j.erro || "Não foi possível ler o plano de curso. Toque em Tentar de novo.");
    if (!j.ucs?.length) throw new Error("Não encontramos unidades curriculares neste arquivo. Confira se é o plano de curso ou preencha a UC manualmente no passo 2.");
    analise = j;
    mostrarAnalise();
    calcularCronograma();
  } catch (e) {
    caixa.className = "analise erro";
    caixa.innerHTML = `<p>${esc(e.message)}</p><button type="button" class="btn-secundario" id="btnReler">Tentar de novo</button>`;
    $("#btnReler").onclick = analisarPlano;
  }
  aplicarModoUc();
  if (passo === 0) {
    $("#contaPasso").textContent = `Passo 1 de ${passos().length}`;
    $("#barraPasso").style.width = `${100 / passos().length}%`;
  }
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
      <span class="uc-nome">${esc(u.nome)}<span class="uc-modulo">${esc(!u.modulo ? "" : /^m[óo]dulo/i.test(u.modulo) ? u.modulo : `Módulo ${u.modulo}`)}</span></span>
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
  $("#btnGerar").textContent = n > 1 ? `Gerar materiais de ${n} unidades curriculares` : "Gerar os quatro materiais";
}

// ---------- Calendário da turma ----------
// Padrão: "quando é a sua UC" (primeira e última aula, como no mapão).
// Opcional: informando o início do curso, calcula todas as UCs em sequência.
const dataInput = (v) => { if (!v) return null; const [a, m, d] = v.split("-").map(Number); return new Date(a, m - 1, d); };
const modoCurso = () => Boolean($("#inicioCurso").value);

// Período em que o instrutor dá aula (null = a UC inteira a partir da primeira aula).
function periodo() {
  const de = dataInput($("#periodoDe").value), ate = dataInput($("#periodoAte").value);
  if (modoCurso()) return de || ate ? { de, ate } : null;
  return ate ? { de, ate } : null;
}

function diasEscolhidos() {
  return [...document.querySelectorAll("#diasSemana input:checked")].map((c) => Number(c.value));
}

function resumoPeriodo() {
  const escolhidas = ucsEscolhidas();
  if (!crono || !escolhidas.length) return "";
  const per = periodo();
  const linhas = escolhidas.map((u) => {
    const d = cronogramaDaUc(crono, u.nome, per);
    if (!d) return "";
    if (d.vazio) return `<li><strong>${esc(u.nome)}</strong>: nenhuma aula neste período. Confira se a primeira aula cai num dia de aula.</li>`;
    const falta = d.incompleta ? ` <em>As datas não cobrem a UC toda: faltam ${d.total - d.ultima} aula(s). Se ela continua depois, aumente a última aula.</em>` : "";
    const quais = d.primeira === 1 && !d.incompleta ? `${d.total} aulas` : `aulas ${d.primeira} a ${d.ultima} de ${d.total}`;
    return `<li><strong>${esc(u.nome)}</strong>: ${quais}, de ${d.dataInicio} a ${d.dataTermino}.${falta}</li>`;
  }).join("");
  return `<div class="crono-minhas"><strong>Suas aulas</strong><ul>${linhas}</ul></div>`;
}

function calcularCronograma() {
  const caixa = $("#cronograma");
  crono = null;
  if (!analise) { caixa.innerHTML = ""; return; }
  const horasAula = Number(String($("#horasAula").value).replace(",", "."));
  const dias = diasEscolhidos();
  const inicio = modoCurso() ? dataInput($("#inicioCurso").value) : dataInput($("#periodoDe").value);
  if (!inicio || !(horasAula > 0) || !dias.length) {
    caixa.innerHTML = !dias.length ? `<p class="crono-periodo">Escolha pelo menos um dia de aula.</p>`
      : !(horasAula > 0) ? `<p class="crono-periodo">Informe quantas horas tem cada aula.</p>` : "";
    return;
  }
  const escolhidas = ucsEscolhidas();
  const ucs = modoCurso() || !escolhidas.length ? analise.ucs : escolhidas;
  crono = montarCronograma(ucs, { inicio, horasAula, dias, semAula: lerDiasSemAula($("#semAula").value) });
  if (!crono) { caixa.innerHTML = ""; return; }
  const nomes = new Set(escolhidas.map((u) => u.nome));
  const tabela = modoCurso() ? `
    <p class="crono-periodo">O curso vai de <strong>${dataBr(crono.inicio)}</strong> a <strong>${dataBr(crono.termino)}</strong>: ${crono.totalAulas} aulas em ${crono.semanas} semanas.</p>
    <div class="tabela-rolagem"><table class="crono-tabela">
      <thead><tr><th>Unidade curricular</th><th class="num">Horas</th><th class="num">Aulas</th><th class="num">Início</th><th class="num">Término</th></tr></thead>
      <tbody>${crono.ucs.map((u) => `<tr class="${nomes.has(u.nome) ? "escolhida" : nomes.size ? "fora" : ""}">
        <td>${esc(u.nome)}</td><td class="num">${u.horas}h</td><td class="num">${u.aulas.length}</td>
        <td class="num">${u.inicio ? dataBr(u.inicio) : "-"}</td><td class="num">${u.termino ? dataBr(u.termino) : "-"}</td></tr>`).join("")}</tbody>
    </table></div>` : "";
  caixa.innerHTML = `${resumoPeriodo()}${tabela}
    ${crono.pulados.length ? `<details class="crono-pulados"><summary>${crono.pulados.length} ${crono.pulados.length === 1 ? "dia pulado" : "dias pulados"} (feriados e dias sem aula)</summary>
      <ul>${crono.pulados.map((p) => `<li>${dataBr(p.data)}: ${esc(p.motivo)}</li>`).join("")}</ul></details>` : ""}
    <div class="crono-acoes"><button type="button" id="btnCrono">Baixar calendário (Excel)</button>
      ${turmaAtual ? `<a class="link-turma" href="turmas.html?id=${turmaAtual.id}">Abrir a turma ${esc(turmaAtual.nome)}</a>`
        : `<button type="button" id="btnSalvarTurma" class="primario">Salvar como turma</button>`}</div>
    ${turmaAtual ? "" : `<p class="crono-dica">Salvando a turma, você acompanha o diário, a frequência e as notas da turma.</p>`}`;
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
  let aulas;
  if (!per) aulas = crono.ucs.flatMap((u) => u.aulas.map((a, i) => ({ uc: u.nome, numero: ++n, numero_uc: i + 1, data: dataBr(a.data), ch: a.ch })));
  else {
    // Com período: as aulas de cada UC escolhida (pela sequência ou pelas datas do período, como no mapão).
    const alvo = ucsEscolhidas().length ? ucsEscolhidas() : crono.ucs;
    aulas = alvo.flatMap((u) => {
      const d = cronogramaDaUc(crono, u.nome, per);
      if (!d || d.vazio) return [];
      return d.aulas.map((a, i) => ({ uc: u.nome, numero: ++n, numero_uc: d.primeira + i, data: a.data, ch: Number(String(a.ch).replace(",", ".").replace("h", "")) }));
    });
  }
  if (!aulas.length) { avisar("Nenhuma aula sua no período informado. Confira as datas de participação.", true); return; }
  const dados = {
    analise: { ...analise, referencia: undefined }, referencia: analise.referencia || "",
    calendario: { inicio: $("#inicioCurso").value, horasAula: $("#horasAula").value, dias: diasEscolhidos(), semAula: $("#semAula").value,
      de: $("#periodoDe").value, ate: $("#periodoAte").value },
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
    // Turmas antigas guardavam o período em "participacao".
    const part = d.calendario.participacao || {};
    $("#periodoDe").value = d.calendario.de || part.de || "";
    $("#periodoAte").value = d.calendario.ate || part.ate || "";
    $("#modoCurso").open = Boolean(d.calendario.inicio);
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

// ---------- Assistente: um passo por tela ----------
let passo = 0;
// Sem plano de curso (preenchimento manual), o passo das datas não se aplica. Até saber, conta os 5 passos.
const semPlano = () => passo > 0 && !analise;
const passos = () => ["passo1", "passo2", ...(analise || !semPlano() ? ["passoCal"] : []), "passoAval", "passo3"];

function mostrarPasso(n) {
  passo = Math.max(0, Math.min(n, passos().length - 1));
  const ps = passos(); // recalcula: sem plano de curso, o passo das datas sai da conta
  document.querySelectorAll("#form .passo").forEach((el) => { el.hidden = el.id !== ps[passo]; });
  $(`#${ps[passo]} .passo-n`).textContent = passo + 1;
  $("#contaPasso").textContent = `Passo ${passo + 1} de ${ps.length}`;
  $("#barraPasso").style.width = `${((passo + 1) / ps.length) * 100}%`;
  $("#btnVoltar").hidden = passo === 0;
  $("#telaForm .abertura").hidden = passo > 0;
  $("#btnAvancar").hidden = passo === ps.length - 1;
  if (ps[passo] === "passo3") mostrarRevisao();
  avisar("");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Confere um passo. Devolve a mensagem de erro ou "" se está tudo certo.
function errosDoPasso(id) {
  const form = $("#form");
  if (id === "passo1") {
    if ($("#analise").classList.contains("lendo")) return "Aguarde: ainda estamos lendo o plano de curso.";
    if (analise && !ucsEscolhidas().length) return "Escolha pelo menos uma unidade curricular.";
    if (inputArq.files.length && !analise) return "Não conseguimos ler o plano de curso. Toque em Tentar de novo, logo acima.";
  }
  if (id === "passo2") {
    const faltando = [...$("#passo2").querySelectorAll("[required]")].filter((el) => !el.closest("[hidden]") && !el.value.trim());
    form.querySelectorAll("[required]").forEach((el) => el.classList.toggle("invalido", faltando.includes(el)));
    if (faltando.length) { faltando[0].focus(); return analise ? "Preencha o curso e o nome do(a) instrutor(a)." : "Preencha curso, unidade curricular e instrutor(a)."; }
  }
  if (id === "passoAval" && !lerAvaliacoes()) return "Escolha o formato das duas avaliações (30 e 60 pontos), ou toque em Usar sugestão.";
  return "";
}

function avancar() {
  const erro = errosDoPasso(passos()[passo]);
  if (erro) return avisar(erro, true);
  mostrarPasso(passo + 1);
}

// Antes de gerar: confere todos os passos e leva para o primeiro com problema.
function validar() {
  const ps = passos();
  for (let i = 0; i < ps.length; i++) {
    const erro = errosDoPasso(ps[i]);
    if (erro) { mostrarPasso(i); avisar(erro, true); return false; }
  }
  return true;
}

function mostrarRevisao() {
  const f = $("#form").elements;
  const av = lerAvaliacoes() || {};
  const descAv = (a) => !a ? "-" : a.tipo === "prova" ? `Prova com ${a.questoes} questões (${a.objetivas} objetivas)`
    : a.tipo === "grupo" ? `Atividade em grupo (${a.porGrupo} por grupo, ${a.entrega.toLowerCase()})` : "Prática ou situação-problema";
  const ucs = analise ? ucsEscolhidas().map((u) => u.nome).join(", ") : f.uc.value;
  const datas = ucsEscolhidas().map((u) => cronogramaDaUc(crono, u.nome, periodo())).find((d) => d && !d.vazio);
  const linhas = [
    ["Curso", f.curso.value], ["Unidade curricular", ucs], ["Instrutor(a)", f.instrutor.value],
    ["Turma", [f.turma.value, f.turno.value].filter(Boolean).join(" · ") || "-"],
    ["Aulas", datas ? `${datas.aulas.length} aulas, de ${datas.dataInicio} a ${datas.dataTermino}` : "A IA sugere as datas"],
    ["Avaliação 30", descAv(av[30])], ["Avaliação 60", descAv(av[60])],
  ];
  $("#revisao").innerHTML = linhas.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v || "-")}</dd></div>`).join("");
}

// Formulário ou sequência (acompanhamento da geração).
function mostrarTela(seq) {
  $("#telaForm").hidden = seq;
  $("#telaSeq").hidden = !seq;
  window.scrollTo({ top: 0 });
}

function dadosDaUc(base, uc) {
  if (!uc) return base;
  const datas = cronogramaDaUc(crono, uc.nome, periodo());
  return { ...base, uc: uc.nome, cargaHorariaUC: uc.cargaHoraria || "", modulo: uc.modulo || "",
    // Lista oficial da UC lida do plano de curso: a IA tem que seguir exatamente esses tópicos.
    ...(uc.conhecimentos?.length ? { conhecimentosUC: uc.conhecimentos } : {}),
    ...(uc.capacidades?.length ? { capacidadesUC: uc.capacidades } : {}),
    cargaHorariaCurso: analise?.cargaHoraria || "",
    ...(datas?.parcial ? { participacao: `O instrutor assume apenas as aulas ${datas.primeira} a ${datas.ultima} de ${datas.total} desta UC (${datas.dataInicio} a ${datas.dataTermino}). As aulas anteriores foram dadas por outro instrutor: não repita o conteúdo inicial, parta do ponto em que a turma está e foque nas capacidades restantes.` } : {}),
    ...(datas && !datas.vazio ? { dataInicio: datas.dataInicio, dataTermino: datas.dataTermino, aulasCronograma: datas.aulas,
      horasAula: base.horasAula, diasAula: diasEscolhidos().map((d) => ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d]).join(", ") } : {}) };
}

// Gera a fila a partir da UC `inicioUc`, começando na etapa `inicioEtapa` dela.
// Acompanha o trabalho no servidor. Falhas de rede (app em segundo plano, sinal ruim) não
// interrompem: continua consultando até o servidor dizer que terminou.
const MSG_GERANDO = "Escrevendo agora. Pode sair do app: a sequência continua sendo gerada.";

// Acompanha a sequência no servidor até a cadeia terminar. Falhas de rede (app em segundo plano, sinal ruim)
// não interrompem: continua consultando. Devolve true se tudo terminou sem erro.
async function acompanharSequencia(it) {
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
  for (;;) {
    await espera(document.hidden ? 8000 : 3000);
    let j;
    try {
      const r = await fetch(`/api/sequencias/${it.sequenciaId}/progresso`, { cache: "no-store" });
      if (r.status === 401) { location.href = "entrar.html?voltar=index.html"; return false; }
      if (!r.ok) continue;
      j = await r.json();
    } catch { continue; }
    aplicarProgresso(it, j);
    render();
    if (!j.ativo) {
      const ok = !Object.values(j.estados).some((e) => e.tipo === "erro");
      avisarPronto(ok ? "Seus materiais ficaram prontos." : "A geração parou com um erro. Toque para ver.");
      return ok;
    }
  }
}

// Aviso do sistema quando a geração termina com o app em segundo plano.
function pedirPermissaoAviso() {
  try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch { /* sem suporte */ }
}
function avisarPronto(texto) {
  try {
    if (!document.hidden || !("Notification" in window) || Notification.permission !== "granted") return;
    const n = new Notification("gera.documento", { body: texto, icon: "icones/favicon-32.png", tag: "geracao" });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* sem suporte */ }
}

function aplicarProgresso(it, j) {
  Object.assign(it.resultados, j.resultados);
  it.slidesEstados = j.estados;
  for (const e of ETAPAS) {
    const st = j.estados[e.id];
    if (st?.tipo === "gerando") it.estados[e.id] = { tipo: "gerando", msg: MSG_GERANDO };
    else if (st?.tipo === "fila") it.estados[e.id] = { tipo: "", msg: "Na fila" };
    else if (st?.tipo === "erro") it.estados[e.id] = { tipo: "erro", msg: st.msg };
    else if (it.resultados[e.id]) it.estados[e.id] = { tipo: "ok", msg: "Pronto para baixar" };
    else delete it.estados[e.id];
  }
}

async function gerarFila(inicioUc = 0, inicioEtapa = 0, continuar = false) {
  pedirPermissaoAviso();
  const salva = continuar && fila[inicioUc]?.dados;
  if (gerando || (!salva && !validar())) return;
  if (salva) avisar("");
  else if (analise && !crono) avisar("Sem calendário preenchido, as datas das aulas ficam a cargo da IA. Para datas exatas, preencha o passo Calendário.");
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
  mostrarTela(true);

  let parou = false;
  for (let k = inicioUc; k < fila.length && !parou; k++) {
    atual = k;
    const it = fila[k];
    const dados = (continuar && it.dados) || dadosDaUc(base, it.uc);
    it.dados = dados;
    // Etapas a gerar nesta UC: a pedida e as que ainda faltam depois dela. O servidor encadeia todas sozinho.
    const ini = k === inicioUc ? inicioEtapa : 0;
    const etapas = ETAPAS.slice(ini).filter((e, j) => j === 0 ? true : !it.resultados[e.id]).map((e) => e.id);
    if (!etapas.length) continue;
    etapas.forEach((id, j) => { it.estados[id] = j === 0 ? { tipo: "gerando", msg: MSG_GERANDO } : { tipo: "", msg: "Na fila" }; });
    render();
    const corpo = new FormData();
    corpo.append("dados", JSON.stringify(dados));
    corpo.append("anteriores", JSON.stringify(it.resultados));
    corpo.append("seguir", JSON.stringify(etapas.slice(1)));
    if (it.sequenciaId) corpo.append("sequenciaId", it.sequenciaId);
    if (turmaAtual || it.turmaId) corpo.append("turmaId", turmaAtual?.id || it.turmaId);
    arquivos.forEach((f) => corpo.append("referencias", f));
    try {
      const r = await fetch(`/api/gerar/${etapas[0]}`, { method: "POST", body: corpo });
      const j = await r.json();
      if (r.status === 401) { location.href = "entrar.html?voltar=index.html"; return; }
      if (!r.ok) throw new Error(j.erro || "Falha ao gerar");
      it.sequenciaId = j.sequenciaId || it.sequenciaId;
      if (j.resultado) { it.resultados[etapas[0]] = j.resultado; it.estados[etapas[0]] = { tipo: "ok", msg: "Pronto para baixar" }; }
      else if (!(await acompanharSequencia(it))) parou = true;
    } catch (e) {
      it.estados[etapas[0]] = { tipo: "erro", msg: e.message };
      parou = true;
    }
    render();
  }
  gerando = false;
  $("#btnGerar").disabled = false;
  aplicarModoUc();
  render();
  const completas = fila.filter((it) => ETAPAS.every((e) => it.resultados[e.id])).length;
  if (!parou && completas === fila.length) {
    avisar(fila.length > 1 ? `${completas} unidades curriculares prontas. Use as abas acima para baixar cada uma.`
      : "Sequência completa. Os materiais também ficam salvos em Materiais.");
  }
}

// ---------- Slides por encontro (sob demanda) ----------
function renderSlides(it) {
  const caixa = $("#slidesEnc");
  const dias = it.resultados.plano?.dias || [];
  caixa.hidden = !dias.length || !it.sequenciaId;
  if (caixa.hidden) return;
  const est = it.slidesEstados || {};
  caixa.innerHTML = `<h3>Slides por encontro</h3>
    <p class="passo-ajuda">Gere os slides de cada aula quando precisar. A quantidade acompanha as horas do encontro e cada slide traz notas para o professor.</p>
    <ol class="lista-slides">${dias.map((d, i) => {
      const n = Number(d.numero || i + 1), k = `slides:${n}`, r = it.resultados[k], st = est[k];
      const estado = st?.tipo === "gerando" ? '<span class="sl-estado gerando">Gerando… pode sair do app</span>'
        : st?.tipo === "erro" ? `<span class="sl-estado erro">${esc(st.msg)}</span>`
        : r ? `<span class="sl-estado ok">${(r.slides || []).length} slides prontos</span>` : "";
      const botoes = st?.tipo === "gerando" ? ""
        : r ? `<button type="button" class="ver" data-sl-ver="${n}">Ver prévia</button>
               <button type="button" data-sl-baixar="${n}">Baixar · PowerPoint</button>
               <button type="button" class="alt" data-sl-gerar="${n}">Gerar de novo</button>`
        : `<button type="button" data-sl-gerar="${n}">${st?.tipo === "erro" ? "Tentar de novo" : "Gerar slides"}</button>`;
      return `<li><div><strong>Encontro ${n} – ${esc(d.titulo || "")}</strong><small>${esc([d.data, d.horas].filter((v) => v && !/dd\/mm/i.test(v)).join(" · "))}</small>${estado}</div>
        <div class="acoes">${botoes}</div></li>`;
    }).join("")}</ol>`;
  caixa.querySelectorAll("[data-sl-gerar]").forEach((b) => { b.onclick = () => gerarSlidesEncontro(it, Number(b.dataset.slGerar)); });
  caixa.querySelectorAll("[data-sl-baixar]").forEach((b) => {
    b.onclick = () => { const n = b.dataset.slBaixar; baixar("pptx", it.resultados[`slides:${n}`], `Slides Encontro ${n}${it.uc ? ` - ${nomeArquivo(it.uc.nome)}` : ""}`); };
  });
  caixa.querySelectorAll("[data-sl-ver]").forEach((b) => {
    b.onclick = () => abrirPrevia({ id: "slides", nome: `Slides do Encontro ${b.dataset.slVer}` }, it.resultados[`slides:${b.dataset.slVer}`], `slides:${b.dataset.slVer}`);
  });
}

let acompanhandoSlides = false;
async function gerarSlidesEncontro(it, n) {
  try {
    const r = await fetch(`/api/sequencias/${it.sequenciaId}/slides/${n}`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || "Não foi possível gerar os slides.");
    it.slidesEstados = { ...(it.slidesEstados || {}), [`slides:${n}`]: { tipo: "gerando" } };
    delete it.resultados[`slides:${n}`];
    render();
    if (acompanhandoSlides || gerando) return;
    acompanhandoSlides = true;
    await acompanharSequencia(it);
  } catch (e) {
    avisar(e.message, true);
  }
  acompanhandoSlides = false;
  render();
}

// ---------- Prévia ----------
const ROTULOS = { uc: "Unidade curricular", cargaHorariaUC: "Carga horária", dataInicio: "Início", dataTermino: "Término", ch: "Horas", data: "Data" };
const rotulo = (k) => ROTULOS[k] || k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

function htmlDoc(d) {
  if (!d) return "";
  return `<h3>${esc(d.titulo)}</h3>` + (d.secoes || []).map((s) => `<h4>${esc(s.titulo)}</h4>
    ${(s.paragrafos || []).map((p) => `<p>${esc(p)}</p>`).join("")}
    ${(s.itens || []).length ? `<ul>${s.itens.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}
    ${s.tabela?.cabecalho ? htmlTabela(s.tabela.cabecalho, s.tabela.linhas || []) : ""}`).join("");
}
const htmlTabela = (cab, linhas) => `<div class="tabela-rolagem"><table class="tabela"><thead><tr>${cab.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
  <tbody>${linhas.map((l) => `<tr>${l.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

// Textos de um slide, de qualquer layout (títulos, itens, cartões...).
function textosDe(v, fora = new Set(["layout", "icone", "titulo", "olho", "destaque"])) {
  if (v == null) return [];
  if (typeof v !== "object") return [String(v)];
  if (Array.isArray(v)) return v.flatMap((x) => textosDe(x, fora));
  return Object.entries(v).filter(([k]) => !fora.has(k)).flatMap(([k, x]) => (k === "titulo" ? [] : textosDe(x, new Set(["layout", "icone"]))));
}

function htmlGenerico(o) {
  return Object.entries(o || {}).map(([k, v]) => {
    if (v == null || v === "") return "";
    if (typeof v !== "object") return `<p><strong>${esc(rotulo(k))}:</strong> ${esc(v)}</p>`;
    if (Array.isArray(v) && v.every((x) => typeof x !== "object")) return `<h4>${esc(rotulo(k))}</h4><ul>${v.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    if (Array.isArray(v)) {
      const cols = [...new Set(v.flatMap((x) => Object.keys(x || {})))].slice(0, 6);
      return `<h4>${esc(rotulo(k))}</h4>${htmlTabela(cols.map(rotulo), v.map((x) => cols.map((c) => (typeof x?.[c] === "object" ? textosDe(x[c]).join("; ") : x?.[c] ?? ""))))}`;
    }
    return `<h4>${esc(rotulo(k))}</h4>${htmlGenerico(v)}`;
  }).join("");
}

function htmlPlano(r) {
  return `<h3>${esc(r.titulo || "Plano de Aula")}</h3><p><strong>${esc(r.uc)}</strong> · ${esc(r.cargaHoraria)} · ${esc(r.organizacao)}</p>
    ${r.objetivoGeral ? `<h4>Objetivo geral</h4><p>${esc(r.objetivoGeral)}</p>` : ""}
    ${(r.dias || []).map((d, i) => `<h4 class="enc-titulo">Encontro ${d.numero || i + 1} – ${esc(d.titulo)} ${d.data && !/dd\/mm/i.test(d.data) ? `· ${esc(d.data)}` : ""}
        <button type="button" class="mini" data-refazer-enc="${d.numero || i + 1}">Refazer este encontro</button></h4>
      <ul>${(d.conhecimentos || []).map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
      <p><strong>Objetivo:</strong> ${esc(d.objetivo)}</p><p><strong>Estratégia MSEP:</strong> ${esc(d.estrategia)}</p>
      <p><strong>Atividade:</strong> ${esc(d.atividade)}</p><p><strong>Avaliação:</strong> ${esc(d.avaliacao)}</p>`).join("")}`;
}

let previaAtual = null;
function abrirPrevia(et, r, chave = et.id) {
  previaAtual = { et, chave };
  let html;
  if (et.id === "avaliacao") html = htmlDoc(r.avaliacao30) + htmlDoc(r.avaliacao60) + htmlDoc(r.gabarito);
  else if (et.id === "atividade") html = r.teorica ? htmlDoc(r.teorica) + htmlDoc(r.pratica) : htmlGenerico({ ...r, roteiro: undefined }) + htmlDoc(r.roteiro);
  else if (et.id === "plano" && r.dias) html = htmlPlano(r);
  else if (et.id === "slides") html = (r.slides || []).map((sl, i) => `<div class="previa-slide"><small>${i + 1}${sl.olho ? ` · ${esc(sl.olho)}` : ""}</small>
      <strong>${esc(sl.titulo || "")}</strong>${textosDe({ ...sl, notas: undefined }).slice(0, 8).map((t) => `<p>${esc(t)}</p>`).join("")}
      ${sl.notas ? `<p class="previa-notas"><strong>Notas do professor:</strong> ${esc(Array.isArray(sl.notas) ? sl.notas.join(" ") : sl.notas)}</p>` : ""}</div>`).join("");
  else html = htmlGenerico(r);
  $("#previaTitulo").textContent = et.nome;
  $("#previaCorpo").innerHTML = html || "<p>Sem conteúdo para mostrar.</p>";
  const editar = $("#editarPrevia");
  editar.hidden = !item().sequenciaId;
  editar.textContent = "Editar texto";
  editar.onclick = () => abrirEditor(et, r, chave);
  $("#previaCorpo").querySelectorAll("[data-refazer-enc]").forEach((b) => { b.onclick = () => refazerEncontro(Number(b.dataset.refazerEnc), b); });
  if (!$("#previa").open) $("#previa").showModal();
  $("#previaCorpo").scrollTop = 0;
}

// Editor da prévia: cada texto do material vira um campo. Salvar grava no servidor e os downloads já saem com a edição.
const ROTULOS_EDITOR = { titulo: "Título", texto: "Texto", paragrafos: "Parágrafo", itens: "Item", objetivo: "Objetivo", estrategia: "Estratégia", uc: "Unidade curricular", curso: "Curso", data: "Data", horas: "Horas", cargaHoraria: "Carga horária", organizacao: "Organização", objetivoGeral: "Objetivo geral", recursos: "Recursos", instrumentos: "Instrumentos", resultadoEsperado: "Resultado esperado", olho: "Rótulo", situacao: "Situação", perguntas: "Pergunta", instrucoes: "Instrução", entrega: "Entrega", frase: "Frase", nota: "Nota", rotulo: "Rótulo",
  atividade: "Atividade", avaliacao: "Avaliação", notas: "Notas do professor", conhecimentos: "Conhecimento", subtitulo: "Subtítulo" };
function folhasTexto(obj, caminho = [], out = []) {
  if (typeof obj === "string") { if (!["conferencia", "layout", "icone"].includes(caminho.at(-1))) out.push({ caminho, valor: obj }); }
  else if (Array.isArray(obj)) obj.forEach((v, i) => folhasTexto(v, [...caminho, i], out));
  else if (obj && typeof obj === "object") for (const [k, v] of Object.entries(obj)) if (k !== "conferencia") folhasTexto(v, [...caminho, k], out);
  return out;
}
function rotuloCaminho(c) {
  const partes = [];
  for (let i = 0; i < c.length; i++) {
    const k = c[i];
    if (k === "dias") { partes.push(`Encontro ${Number(c[i + 1]) + 1}`); i++; }
    else if (k === "slides") { partes.push(`Slide ${Number(c[i + 1]) + 1}`); i++; }
    else if (k === "secoes") { partes.push(`Seção ${Number(c[i + 1]) + 1}`); i++; }
    else if (typeof k === "number") partes.push(String(k + 1));
    else partes.push(ROTULOS_EDITOR[k] || k);
  }
  return partes.join(" · ");
}
function abrirEditor(et, r, chave) {
  const campos = folhasTexto(r);
  $("#previaCorpo").innerHTML = `<p class="passo-ajuda">Ajuste o texto e toque em Salvar. Os arquivos baixados depois já saem com as suas mudanças.</p>
    <div class="editor-campos">${campos.map((c, i) => `<label>${esc(rotuloCaminho(c.caminho))}
      <textarea data-campo="${i}" rows="${Math.min(8, Math.max(1, Math.ceil(c.valor.length / 60)))}">${esc(c.valor)}</textarea></label>`).join("")}</div>
    <div class="editor-acoes"><button type="button" class="alt" id="cancelarEdicao">Cancelar</button><button type="button" id="salvarEdicao">Salvar</button></div>`;
  $("#editarPrevia").hidden = true;
  $("#cancelarEdicao").onclick = () => abrirPrevia(et, r, chave);
  $("#salvarEdicao").onclick = async (ev) => {
    const novo = structuredClone(r);
    $("#previaCorpo").querySelectorAll("[data-campo]").forEach((t) => {
      const { caminho } = campos[Number(t.dataset.campo)];
      let alvo = novo;
      for (const k of caminho.slice(0, -1)) alvo = alvo[k];
      alvo[caminho.at(-1)] = t.value;
    });
    ev.currentTarget.disabled = true;
    ev.currentTarget.textContent = "Salvando…";
    try {
      const it = item();
      const resp = await fetch(`/api/sequencias/${it.sequenciaId}/entregas/${encodeURIComponent(chave)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conteudo: novo }) });
      if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).erro || "Não foi possível salvar.");
      it.resultados[chave] = novo;
      render();
      avisar("Alterações salvas.");
      abrirPrevia(et, novo, chave);
    } catch (e) {
      avisar(e.message, true);
      ev.currentTarget.disabled = false;
      ev.currentTarget.textContent = "Salvar";
    }
  };
  $("#previaCorpo").scrollTop = 0;
}

// Refazer só um encontro do plano (opcionalmente com um pedido do professor).
async function refazerEncontro(n, botao) {
  const it = item();
  if (!it.sequenciaId) return;
  const pedido = prompt(`Refazer o Encontro ${n}. Quer pedir algo específico? (opcional)`, "");
  if (pedido === null) return;
  botao.disabled = true;
  botao.textContent = "Refazendo…";
  try {
    const r = await fetch(`/api/sequencias/${it.sequenciaId}/plano/encontro/${n}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedido }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || "Não foi possível refazer o encontro.");
    it.resultados.plano = j.plano;
    render();
    abrirPrevia(ETAPAS.find((e) => e.id === "plano"), j.plano, "plano");
    avisar(`Encontro ${n} refeito.`);
  } catch (e) {
    avisar(e.message, true);
    botao.disabled = false;
    botao.textContent = "Refazer este encontro";
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
  render();
  mostrarTela(true);
  retomarSeAtiva(fila[0]);
}

async function retomarSeAtiva(it) {
  try {
    const j = await (await fetch(`/api/sequencias/${it.sequenciaId}/progresso`, { cache: "no-store" })).json();
    aplicarProgresso(it, j);
    render();
    if (!j.ativo || gerando) return;
    gerando = true;
    render();
    await acompanharSequencia(it);
  } catch { /* sem conexão: fica o que já carregou */ }
  gerando = false;
  render();
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
  render();
  mostrarPasso(0);
  mostrarTela(false);
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
$("#btnEditar").onclick = () => { mostrarTela(false); mostrarPasso(passos().length - 1); };
$("#btnVoltar").onclick = () => mostrarPasso(passo - 1);
$("#btnAvancar").onclick = avancar;
$("#fecharPrevia").onclick = () => $("#previa").close();
$("#previa").addEventListener("click", (e) => { if (e.target === $("#previa")) $("#previa").close(); });
// Enter num campo avança o passo (em vez de enviar o formulário inteiro).
$("#form").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.tagName === "INPUT" && passos()[passo] !== "passo3") { e.preventDefault(); avancar(); }
});
function avisar(msg, erro = false) {
  const el = $("#telaSeq").hidden ? $("#aviso") : $("#avisoSeq");
  el.textContent = msg;
  el.classList.toggle("erro", erro);
}
$("#form").addEventListener("input", (e) => e.target.classList.remove("invalido"));
const inputArq = $("#arquivos");
const mostrarArquivos = () => {
  $("#listaArquivos").innerHTML = [...inputArq.files].map((f) => `<li>${esc(f.name)}</li>`).join("");
};
const aoTrocarArquivo = () => {
  if (turmaAtual) { turmaAtual = null; history.replaceState(null, "", location.pathname); mostrarFaixaTurma(); }
  mostrarArquivos(); analisarPlano();
};
inputArq.onchange = aoTrocarArquivo;
const up = $("#upload");
up.ondragover = (e) => { e.preventDefault(); up.classList.add("arrastando"); };
up.ondragleave = () => up.classList.remove("arrastando");
up.ondrop = (e) => { e.preventDefault(); up.classList.remove("arrastando"); inputArq.files = e.dataTransfer.files; aoTrocarArquivo(); };

["#inicioCurso", "#horasAula", "#semAula", "#periodoDe", "#periodoAte"].forEach((sel) => $(sel).addEventListener("input", calcularCronograma));
montarAvaliacoes();
$("#diasSemana").addEventListener("change", calcularCronograma);

const usuario = await iniciarPagina("gerar");
usuarioLogado = usuario;
if (usuario) {
  if (!$("#form").elements.instrutor.value) $("#form").elements.instrutor.value = usuario.nome;
  aplicarModoUc();
  render();
  mostrarPasso(0);
  const idTurma = new URLSearchParams(location.search).get("turma");
  if (idTurma) await carregarTurma(Number(idTurma));
  const idSeq = new URLSearchParams(location.search).get("sequencia");
  if (idSeq) await abrir(Number(idSeq));
}
