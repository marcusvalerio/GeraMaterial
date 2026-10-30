let material = null;
const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function renderizar(m) {
  let h = `<h2>${esc(m.titulo)}</h2>`;
  for (const s of m.secoes || []) {
    h += `<h3>${esc(s.titulo)}</h3>`;
    for (const p of s.paragrafos || []) h += `<p>${esc(p)}</p>`;
    if (s.itens?.length) h += `<ul>${s.itens.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
    if (s.tabela?.cabecalho?.length) {
      h += `<table><tr>${s.tabela.cabecalho.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>`;
      h += (s.tabela.linhas || []).map((l) => `<tr>${l.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
      h += "</table>";
    }
  }
  $("#previa").innerHTML = h;
  $("#resultado").hidden = false;
}

$("#form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const tipo = fd.get("tipo");
  fd.delete("tipo");
  const btn = $("#btnGerar");
  btn.disabled = true;
  $("#status").textContent = "Gerando o material com IA… isso pode levar 1 a 2 minutos.";
  try {
    const r = await fetch("/api/gerar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, dados: Object.fromEntries(fd) }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.erro || "Falha ao gerar");
    material = j;
    renderizar(j);
    $("#status").textContent = "Pronto! Revise a prévia e baixe no formato desejado.";
  } catch (err) {
    $("#status").textContent = "Erro: " + err.message;
  } finally {
    btn.disabled = false;
  }
});

document.querySelectorAll("[data-fmt]").forEach((b) => b.addEventListener("click", async () => {
  if (!material) return;
  const fmt = b.dataset.fmt;
  const r = await fetch(`/api/exportar/${fmt}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(material),
  });
  if (!r.ok) return alert("Erro ao exportar");
  const url = URL.createObjectURL(await r.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: `${material.titulo}.${fmt}` });
  a.click();
  URL.revokeObjectURL(url);
}));
