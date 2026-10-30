// Sequência padrão: cada etapa usa o resultado das anteriores.
const ETAPAS = [
  { id: "per", nome: "PER – Plano de Ensino e Recursos", formato: "XLSX",
    downloads: (r) => [["Baixar PER", "per", r, "PER"]] },
  { id: "plano", nome: "Plano de Aula (EP-190)", formato: "XLSM",
    downloads: (r) => [["Baixar EP-190", "ep190", r, "EP-190"]] },
  { id: "slides", nome: "Slides da aula", formato: "PPTX",
    downloads: (r) => [["Baixar slides", "pptx", r, r.titulo || "Slides"]] },
  { id: "avaliacao", nome: "Avaliações 30 e 60 pontos", formato: "DOCX/PDF",
    downloads: (r) => [
      ["Avaliação 30 · Word", "docx", r.avaliacao30, "Avaliacao 30 pontos"],
      ["Avaliação 60 · Word", "docx", r.avaliacao60, "Avaliacao 60 pontos"],
      ["30 · PDF", "pdf", r.avaliacao30, "Avaliacao 30 pontos", true],
      ["60 · PDF", "pdf", r.avaliacao60, "Avaliacao 60 pontos", true],
    ] },
  { id: "atividade", nome: "Atividade do educador", formato: "DOCX",
    downloads: (r) => [
      ["Teórica · Word", "docx", r.teorica, "Atividade teorica"],
      ["Prática · Word", "docx", r.pratica, "Atividade pratica"],
    ] },
];

const $ = (s) => document.querySelector(s);
let resultados = {};
let sequenciaId = null;
let gerando = false;

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function render(estados = {}) {
  const ol = $("#etapas");
  ol.innerHTML = "";
  ETAPAS.forEach((et, i) => {
    const st = estados[et.id] || (resultados[et.id] ? { tipo: "ok", msg: "Pronto" } : { tipo: "", msg: "Aguardando" });
    const li = document.createElement("li");
    li.className = `etapa ${st.tipo}`;
    li.innerHTML = `<div class="icone">${st.tipo === "ok" ? "✓" : st.tipo === "erro" ? "!" : i + 1}</div>
      <div><h3>${et.nome}<span class="formato">${et.formato}</span></h3><p class="estado">${esc(st.msg)}</p></div>`;
    const corpo = li.lastElementChild;
    if (resultados[et.id] && st.tipo === "ok") {
      const acoes = document.createElement("div");
      acoes.className = "acoes";
      for (const [rotulo, fmt, dados, nome, alt] of et.downloads(resultados[et.id])) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = "⬇ " + rotulo;
        if (alt) b.className = "alt";
        b.onclick = () => baixar(fmt, dados, nome);
        acoes.append(b);
      }
      corpo.append(acoes);
    }
    if (st.tipo === "erro") {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Tentar novamente desta etapa";
      b.className = "btn-novo";
      b.style.cssText = "color:var(--vermelho);border-color:var(--vermelho);margin-top:8px;width:auto;padding:6px 12px";
      b.onclick = () => executar(i);
      corpo.append(b);
    }
    ol.append(li);
  });
  const feitas = ETAPAS.filter((e) => resultados[e.id]).length;
  $("#barra").style.width = `${(feitas / ETAPAS.length) * 100}%`;
}

async function baixar(fmt, dados, nome) {
  const r = await fetch(`/api/exportar/${fmt}?nome=${encodeURIComponent(nome)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados),
  });
  if (!r.ok) return alert("Erro ao exportar");
  const ext = { per: "xlsx", ep190: "xlsm" }[fmt] || fmt;
  const url = URL.createObjectURL(await r.blob());
  Object.assign(document.createElement("a"), { href: url, download: `${nome}.${ext}` }).click();
  URL.revokeObjectURL(url);
}

async function executar(inicio = 0) {
  if (gerando) return;
  const form = $("#form");
  if (!form.reportValidity()) return;
  const fd = new FormData(form);
  const arquivos = fd.getAll("referencias").filter((f) => f.size);
  fd.delete("referencias");
  const dados = Object.fromEntries(fd);
  gerando = true;
  $("#btnGerar").disabled = true;
  $("#btnGerar").textContent = "Gerando…";
  const estados = {};

  for (let i = inicio; i < ETAPAS.length; i++) {
    const etapa = ETAPAS[i];
    estados[etapa.id] = { tipo: "gerando", msg: "Gerando com IA… (1 a 3 min)" };
    render(estados);
    const corpo = new FormData();
    corpo.append("dados", JSON.stringify(dados));
    corpo.append("anteriores", JSON.stringify(resultados));
    if (sequenciaId) corpo.append("sequenciaId", sequenciaId);
    arquivos.forEach((f) => corpo.append("referencias", f));
    try {
      const r = await fetch(`/api/gerar/${etapa.id}`, { method: "POST", body: corpo });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || "Falha ao gerar");
      resultados[etapa.id] = j.resultado;
      sequenciaId = j.sequenciaId || sequenciaId;
      estados[etapa.id] = { tipo: "ok", msg: "Pronto" };
      carregarHistorico();
    } catch (e) {
      estados[etapa.id] = { tipo: "erro", msg: e.message };
      render(estados);
      break;
    }
    render(estados);
  }
  gerando = false;
  $("#btnGerar").disabled = false;
  $("#btnGerar").textContent = "Gerar sequência completa";
}

// ---------- Histórico ----------
async function carregarHistorico() {
  const ul = $("#historico");
  try {
    const r = await fetch(`/api/sequencias?busca=${encodeURIComponent($("#busca").value)}`);
    const { banco, itens } = await r.json();
    if (!banco) { ul.innerHTML = `<li class="vazio">Banco de dados não configurado.</li>`; return; }
    if (!itens.length) { ul.innerHTML = `<li class="vazio">Nenhuma sequência ainda.</li>`; return; }
    ul.innerHTML = "";
    for (const s of itens) {
      const li = document.createElement("li");
      if (s.id == sequenciaId) li.className = "ativo";
      const data = new Date(s.criado_em).toLocaleDateString("pt-BR");
      li.innerHTML = `<strong>${esc(s.uc)}</strong><small>${esc(s.curso)}${s.turma ? " · " + esc(s.turma) : ""} · ${data}</small>
        <div class="pontos">${ETAPAS.map((e) => `<i class="${s.etapas.includes(e.id) ? "ok" : ""}"></i>`).join("")}</div>
        <button class="excluir" title="Excluir">✕</button>`;
      li.onclick = () => abrir(s.id);
      li.querySelector(".excluir").onclick = async (ev) => {
        ev.stopPropagation();
        if (!confirm("Excluir esta sequência do histórico?")) return;
        await fetch(`/api/sequencias/${s.id}`, { method: "DELETE" });
        if (s.id == sequenciaId) novo();
        carregarHistorico();
      };
      ul.append(li);
    }
  } catch {
    ul.innerHTML = `<li class="vazio">Não foi possível carregar.</li>`;
  }
}

async function abrir(id) {
  if (gerando) return;
  const r = await fetch(`/api/sequencias/${id}`);
  if (!r.ok) return;
  const s = await r.json();
  sequenciaId = s.id;
  resultados = s.resultados || {};
  const form = $("#form");
  for (const [k, v] of Object.entries(s.dados || {})) if (form.elements[k]) form.elements[k].value = v;
  render();
  carregarHistorico();
  $("#lateral").classList.remove("aberta");
}

function novo() {
  if (gerando) return;
  sequenciaId = null;
  resultados = {};
  $("#form").reset();
  $("#listaArquivos").innerHTML = "";
  render();
  carregarHistorico();
}

// ---------- Eventos ----------
$("#form").addEventListener("submit", (e) => {
  e.preventDefault();
  sequenciaId = null;
  resultados = {};
  executar(0);
});
$("#btnNovo").onclick = novo;
$("#btnMenu").onclick = () => $("#lateral").classList.toggle("aberta");
let t;
$("#busca").oninput = () => { clearTimeout(t); t = setTimeout(carregarHistorico, 250); };

const inputArq = $("#arquivos");
const mostrarArquivos = () => {
  $("#listaArquivos").innerHTML = [...inputArq.files].map((f) => `<li>📄 ${esc(f.name)}</li>`).join("");
};
inputArq.onchange = mostrarArquivos;
const up = $("#upload");
up.ondragover = (e) => { e.preventDefault(); up.classList.add("arrastando"); };
up.ondragleave = () => up.classList.remove("arrastando");
up.ondrop = (e) => { e.preventDefault(); up.classList.remove("arrastando"); inputArq.files = e.dataTransfer.files; mostrarArquivos(); };

render();
carregarHistorico();
