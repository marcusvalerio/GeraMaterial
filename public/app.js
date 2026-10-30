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
let resultados = {};
let sequenciaId = null;
let gerando = false;

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function render(estados = {}) {
  const ol = $("#etapas");
  ol.innerHTML = "";
  ETAPAS.forEach((et, i) => {
    const st = estados[et.id] || (resultados[et.id] ? { tipo: "ok", msg: "Pronto para baixar" } : { tipo: "", msg: "Na fila" });
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
        b.textContent = rotulo;
        if (alt) b.className = "alt";
        b.onclick = () => baixar(fmt, dados, nome);
        acoes.append(b);
      }
      corpo.append(acoes);
    }
    if (st.tipo === "erro") {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Tentar de novo a partir daqui";
      b.className = "btn-retentar";
      b.onclick = () => executar(i);
      corpo.append(b);
    }
    ol.append(li);
  });
  const feitas = ETAPAS.filter((e) => resultados[e.id]).length;
  $("#barra").style.width = `${(feitas / ETAPAS.length) * 100}%`;
  $("#contagem").textContent = `${feitas} de ${ETAPAS.length}`;
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

async function executar(inicio = 0) {
  if (gerando) return;
  const form = $("#form");
  const faltando = [...form.querySelectorAll("[required]")].filter((el) => !el.value.trim());
  form.querySelectorAll("[required]").forEach((el) => el.classList.toggle("invalido", !el.value.trim()));
  if (faltando.length) {
    avisar("Preencha curso, unidade curricular e instrutor(a) para continuar.", true);
    faltando[0].focus();
    return;
  }
  if (!form.querySelector("#arquivos").files.length) avisar("Sem plano de curso, a IA usa só os dados da turma. Funciona, mas fica menos preciso.");
  else avisar("");
  const fd = new FormData(form);
  const arquivos = fd.getAll("referencias").filter((f) => f.size);
  fd.delete("referencias");
  const dados = Object.fromEntries(fd);
  gerando = true;
  $("#btnGerar").disabled = true;
  $("#btnGerar").textContent = "Gerando os materiais…";
  if (window.innerWidth < 920) $(".pilha").scrollIntoView({ behavior: "smooth", block: "start" });
  const estados = {};

  for (let i = inicio; i < ETAPAS.length; i++) {
    const etapa = ETAPAS[i];
    estados[etapa.id] = { tipo: "gerando", msg: "Escrevendo agora, leva de 1 a 4 minutos" };
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
      estados[etapa.id] = { tipo: "ok", msg: "Pronto para baixar" };
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
  $("#btnGerar").textContent = ETAPAS.every((e) => resultados[e.id]) ? "Gerar de novo" : "Gerar os cinco materiais";
  if (ETAPAS.every((e) => resultados[e.id])) avisar("Sequência completa. Os materiais também ficam salvos em Meus materiais.");
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
      if (s.id == sequenciaId) li.className = "ativo";
      const data = new Date(s.criado_em).toLocaleDateString("pt-BR");
      li.innerHTML = `<strong>${esc(s.uc)}</strong><small>${esc(s.curso)}${s.turma ? " · " + esc(s.turma) : ""} · ${data}</small>
        <div class="pontos">${ETAPAS.map((e) => `<i class="${s.etapas.includes(e.id) ? "ok" : ""}"></i>`).join("")}</div>
        <button class="excluir" type="button" aria-label="Excluir esta sequência">✕</button>`;
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
    ul.innerHTML = `<li class="vazio">Não foi possível carregar o histórico. Verifique a conexão.</li>`;
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
  form.querySelectorAll(".invalido").forEach((el) => el.classList.remove("invalido"));
  avisar("");
  marcarPassos();
  render();
  carregarHistorico();
  gaveta(false);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function novo() {
  if (gerando) return;
  sequenciaId = null;
  resultados = {};
  $("#form").reset();
  $("#listaArquivos").innerHTML = "";
  avisar("");
  marcarPassos();
  render();
  gaveta(false);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Eventos ----------
$("#form").addEventListener("submit", (e) => {
  e.preventDefault();
  sequenciaId = null;
  resultados = {};
  executar(0);
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
  $("#passo1").classList.toggle("feito", $("#arquivos").files.length > 0);
  $("#passo2").classList.toggle("feito", ["curso", "uc", "instrutor"].every((n) => form.elements[n].value.trim()));
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
inputArq.onchange = () => { mostrarArquivos(); marcarPassos(); };
const up = $("#upload");
up.ondragover = (e) => { e.preventDefault(); up.classList.add("arrastando"); };
up.ondragleave = () => up.classList.remove("arrastando");
up.ondrop = (e) => { e.preventDefault(); up.classList.remove("arrastando"); inputArq.files = e.dataTransfer.files; mostrarArquivos(); marcarPassos(); };

render();
carregarHistorico();
