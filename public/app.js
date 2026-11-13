import { montarCronograma, cronogramaDaUc, lerDiasSemAula, dataBr } from "./cronograma.js";
import { $, esc, iniciarPagina } from "./comum.js";

// Sequência padrão: cada etapa usa o resultado das anteriores.
const ETAPAS = [
  { id: "per", nome: "PER – Plano de Ensino e Recursos", formato: "Excel",
    downloads: (r) => [["Baixar PER", "per", r, "PER"]] },
  { id: "plano", nome: "Plano de Aula", formato: "Word e PDF",
    // Materiais antigos: o Plano de Aula era o próprio EP-190.
    downloads: (r) => (r.secoes || r.aulas) ? [["Plano de Aula · Word", "docx", r, "Plano de Aula"], ["PDF", "pdf", r, "Plano de Aula", true]]
      : [["Baixar EP-190", "ep190", r, "EP-190"]] },
  { id: "avaliacao", nome: "Avaliações 30 e 60 pontos", formato: "Word e PDF",
    downloads: (r, it) => {
      const cab = (pts) => cabecalhoProva(it, pts);
      const a30 = { ...r.avaliacao30, cabecalho: cab(30) }, a60 = { ...r.avaliacao60, cabecalho: cab(60) };
      return [
        ["Avaliação 30 · Word", "docx", a30, "Avaliação 30 pontos"],
        ["Avaliação 60 · Word", "docx", a60, "Avaliação 60 pontos"],
        ["30 · PDF", "pdf", a30, "Avaliação 30 pontos", true],
        ["60 · PDF", "pdf", a60, "Avaliação 60 pontos", true],
      ];
    } },
  { id: "atividade", nome: "Atividade do educador (EP-190)", formato: "Excel e Word",
    downloads: (r) => [
      ...(r.ep190 ? [["Baixar EP-190", "ep190", r.ep190, "EP-190"]] : []),
      ["Teórica · Word", "docx", r.teorica, "Atividade teórica"],
      ["Prática · Word", "docx", r.pratica, "Atividade prática"],
    ] },
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
      // Nome do arquivo: "Documento - Nome da UC" (UC do plano de curso, do formulário ou do material salvo).
      const nomeUc = nomeArquivo(it.uc?.nome || it.dados?.uc || it.resultados?.per?.uc || it.resultados?.plano?.uc || "");
      const sufixo = nomeUc ? ` - ${nomeUc}` : "";
      const ver = document.createElement("button");
      ver.type = "button";
      ver.textContent = "Ver prévia";
      ver.className = "ver";
      ver.onclick = () => abrirPrevia(et, it.resultados[et.id]);
      acoes.append(ver);
      for (const [rotulo, fmt, dados, nome, alt] of et.downloads(it.resultados[et.id], it)) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = rotulo;
        if (alt) b.className = "alt";
        b.onclick = () => baixar(fmt, dados, nome + sufixo);
        acoes.append(b);
      }
      // Refaz só esta etapa (as outras prontas ficam como estão).
      if (it.dados && !gerando) {
        const r = document.createElement("button");
        r.type = "button";
        r.textContent = "Refazer";
        r.className = "alt btn-refazer";
        r.onclick = () => {
          if (confirm(`Gerar de novo "${et.nome}"? O material atual desta etapa será substituído.`)) gerarFila(atual, i, true);
        };
        acoes.append(r);
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
  await baixar("cronograma", corpo, `Calendário - ${nomeArquivo(analise.curso)}`);
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
    avisar(fila.length > 1 ? `${completas} unidades curriculares prontas. Use as abas acima para baixar cada uma.`
      : "Sequência completa. Os materiais também ficam salvos em Materiais.");
  }
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

// Prévia do Plano de Aula no mesmo formato do Word/PDF.
function htmlPlano(p) {
  const t = (v) => esc(Array.isArray(v) ? v.join("; ") : v ?? "");
  const ident = [["Curso", p.curso], ["Carga horária", p.cargaHoraria], ["Organização", p.organizacao], ["Instrutor(a)", p.instrutor], ["Referência", p.referencia]]
    .filter(([, v]) => v).map(([r, v]) => `<p><strong>${r}:</strong> ${t(v)}</p>`).join("");
  const dist = (p.distribuicao || []).length ? `<h4>Distribuição da carga horária</h4>${htmlTabela(["Grupos de conhecimentos", "CH"], p.distribuicao.map((d) => [d.grupo, d.ch]))}${p.observacaoCargaHoraria ? `<p>${t(p.observacaoCargaHoraria)}</p>` : ""}` : "";
  const aulas = (p.aulas || []).map((a, i) => `<h4>Dia ${a.dia || i + 1} · ${t(a.titulo)}${a.data ? ` · ${t(a.data)}` : ""}</h4>
    ${[["Conhecimentos", a.conhecimentos], ["Objetivo", a.objetivo], ["Estratégia MSEP", a.estrategia], ["Atividade", a.atividade], ["Avaliação", a.avaliacao]]
      .filter(([, v]) => v).map(([r, v]) => `<p><strong>${r}:</strong> ${t(v)}</p>`).join("")}`).join("");
  const org = (p.organizacaoDiaria || []).length ? `<h4>Organização das quatro horas</h4>${htmlTabela(["Etapa", "Tempo", "Desenvolvimento"], p.organizacaoDiaria.map((o) => [o.etapa, o.tempo, o.desenvolvimento]))}` : "";
  const inst = (p.instrumentos || []).length ? `<h4>Instrumentos de avaliação</h4><ul>${p.instrumentos.map((x) => `<li>${typeof x === "string" ? t(x) : `<strong>${t(x.tipo)}:</strong> ${t(x.descricao)}`}</li>`).join("")}</ul>` : "";
  const fim = [["Recursos didáticos", p.recursos], ["Segurança", p.observacaoRecursos], ["Resultado esperado", p.resultadoEsperado], ["Observação pedagógica", p.observacaoPedagogica]]
    .filter(([, v]) => v).map(([r, v]) => `<h4>${r}</h4><p>${t(v)}</p>`).join("");
  return `<h3>Plano de Aula${p.uc ? ` · ${t(p.uc)}` : ""}</h3>${ident}${p.objetivoGeral ? `<h4>Objetivo geral</h4><p>${t(p.objetivoGeral)}</p>` : ""}${dist}<h4>Plano detalhado</h4>${aulas}${org}${inst}${fim}`;
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

function abrirPrevia(et, r) {
  let html;
  if (et.id === "avaliacao") html = htmlDoc(r.avaliacao30) + htmlDoc(r.avaliacao60);
  else if (et.id === "atividade") html = (r.ep190 ? `<h3>EP-190</h3>${htmlGenerico(r.ep190)}` : "") + htmlDoc(r.teorica) + htmlDoc(r.pratica);
  else if (et.id === "plano" && r.aulas) html = htmlPlano(r);
  else if (et.id === "plano" && r.secoes) html = htmlDoc(r);
  else html = htmlGenerico(r);
  $("#previaTitulo").textContent = et.nome;
  $("#previaCorpo").innerHTML = html || "<p>Sem conteúdo para mostrar.</p>";
  $("#previa").showModal();
  $("#previaCorpo").scrollTop = 0;
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
