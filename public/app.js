// Sequência padrão: cada etapa usa o resultado das anteriores.
const ETAPAS = [
  { id: "per", nome: "1º PER – Plano de Ensino e Recursos",
    downloads: (r) => [["Baixar PER (Excel)", "per", r, "PER"]] },
  { id: "plano", nome: "2º Plano de Aula (EP-190)",
    downloads: (r) => [["Baixar EP-190 (Excel)", "ep190", r, "EP-190"]] },
  { id: "slides", nome: "3º Slides (PPTX)",
    downloads: (r) => [["Baixar PPTX", "pptx", r, r.titulo || "Slides"]] },
  { id: "avaliacao", nome: "4º Avaliações (30 e 60 pontos)",
    downloads: (r) => [
      ["Avaliação 30 pts (Word)", "docx", r.avaliacao30, "Avaliacao 30 pontos"],
      ["Avaliação 60 pts (Word)", "docx", r.avaliacao60, "Avaliacao 60 pontos"],
      ["Avaliação 30 pts (PDF)", "pdf", r.avaliacao30, "Avaliacao 30 pontos"],
      ["Avaliação 60 pts (PDF)", "pdf", r.avaliacao60, "Avaliacao 60 pontos"],
    ] },
  { id: "atividade", nome: "5º Atividade do educador",
    downloads: (r) => [
      ["Atividade teórica (Word)", "docx", r.teorica, "Atividade teorica"],
      ["Atividade prática (Word)", "docx", r.pratica, "Atividade pratica"],
    ] },
];

const $ = (s) => document.querySelector(s);
const resultados = {};

function cartao(etapa) {
  let el = document.getElementById(`etapa-${etapa.id}`);
  if (!el) {
    el = document.createElement("div");
    el.id = `etapa-${etapa.id}`;
    el.className = "etapa";
    $("#etapas").append(el);
  }
  return el;
}

function mostrar(etapa, estado, erro) {
  const el = cartao(etapa);
  el.innerHTML = `<h3>${etapa.nome}</h3><p class="estado">${estado}</p>`;
  if (erro) {
    const b = document.createElement("button");
    b.textContent = "Tentar novamente a partir desta etapa";
    b.onclick = () => executar(ETAPAS.indexOf(etapa));
    el.append(b);
  }
  if (resultados[etapa.id] && !erro) {
    const acoes = document.createElement("div");
    acoes.className = "acoes";
    for (const [rotulo, fmt, dados, nome] of etapa.downloads(resultados[etapa.id])) {
      const b = document.createElement("button");
      b.textContent = rotulo;
      b.onclick = () => baixar(fmt, dados, nome);
      acoes.append(b);
    }
    el.append(acoes);
  }
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
  const form = $("#form");
  const fd = new FormData(form);
  const arquivos = fd.getAll("referencias").filter((f) => f.size);
  fd.delete("referencias");
  const dados = Object.fromEntries(fd);
  $("#btnGerar").disabled = true;

  for (let i = inicio; i < ETAPAS.length; i++) {
    const etapa = ETAPAS[i];
    mostrar(etapa, "Gerando… (pode levar 1 a 3 minutos)");
    const corpo = new FormData();
    corpo.append("dados", JSON.stringify(dados));
    corpo.append("anteriores", JSON.stringify(resultados));
    arquivos.forEach((f) => corpo.append("referencias", f));
    try {
      const r = await fetch(`/api/gerar/${etapa.id}`, { method: "POST", body: corpo });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || "Falha ao gerar");
      resultados[etapa.id] = j;
      mostrar(etapa, "Pronto ✔");
    } catch (e) {
      mostrar(etapa, "Erro: " + e.message, true);
      break;
    }
  }
  $("#btnGerar").disabled = false;
}

$("#form").addEventListener("submit", (e) => {
  e.preventDefault();
  for (const k in resultados) delete resultados[k];
  $("#etapas").innerHTML = "";
  ETAPAS.forEach((et) => mostrar(et, "Aguardando…"));
  executar(0);
});
