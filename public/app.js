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
      b.onclick = () => gerarFila(atual, i);
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
  const ext = { per: "xlsx", ep190: "xlsm" }[fmt] || fmt;
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
  if (faltando.length) {
    avisar(analise ? "Preencha o curso e o nome do(a) instrutor(a) para continuar." : "Preencha curso, unidade curricular e instrutor(a) para continuar.", true);
    faltando[0].focus();
    return false;
  }
  return true;
}

function dadosDaUc(base, uc) {
  if (!uc) return base;
  return { ...base, uc: uc.nome, cargaHorariaUC: uc.cargaHoraria || "", modulo: uc.modulo || "",
    cargaHorariaCurso: analise?.cargaHoraria || "" };
}

// Gera a fila a partir da UC `inicioUc`, começando na etapa `inicioEtapa` dela.
async function gerarFila(inicioUc = 0, inicioEtapa = 0) {
  if (gerando || !validar()) return;
  if (!inputArq.files.length) avisar("Sem plano de curso, a IA usa só os dados da turma. Funciona, mas fica menos preciso.");
  else avisar("");
  const fd = new FormData($("#form"));
  const arquivos = fd.getAll("referencias").filter((f) => f.size);
  fd.delete("referencias");
  fd.delete("ucEscolhida");
  const base = Object.fromEntries(fd);

  gerando = true;
  $("#btnGerar").disabled = true;
  $("#btnGerar").textContent = "Gerando os materiais…";
  if (window.innerWidth < 920) $(".pilha").scrollIntoView({ behavior: "smooth", block: "start" });

  let parou = false;
  for (let k = inicioUc; k < fila.length && !parou; k++) {
    atual = k;
    const it = fila[k];
    const dados = dadosDaUc(base, it.uc);
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
      arquivos.forEach((f) => corpo.append("referencias", f));
      try {
        const r = await fetch(`/api/gerar/${etapa.id}`, { method: "POST", body: corpo });
        const j = await r.json();
        if (!r.ok) throw new Error(j.erro || "Falha ao gerar");
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
  fila = [{ ...novoItem(), resultados: s.resultados || {}, sequenciaId: s.id }];
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
  $("#passo1").classList.toggle("feito", inputArq.files.length > 0 && (!analise || ucsEscolhidas().length > 0));
  const campos = analise ? ["curso", "instrutor"] : ["curso", "uc", "instrutor"];
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
const aoTrocarArquivo = () => { mostrarArquivos(); marcarPassos(); analisarPlano(); };
inputArq.onchange = aoTrocarArquivo;
const up = $("#upload");
up.ondragover = (e) => { e.preventDefault(); up.classList.add("arrastando"); };
up.ondragleave = () => up.classList.remove("arrastando");
up.ondrop = (e) => { e.preventDefault(); up.classList.remove("arrastando"); inputArq.files = e.dataTransfer.files; aoTrocarArquivo(); };

aplicarModoUc();
render();
carregarHistorico();
