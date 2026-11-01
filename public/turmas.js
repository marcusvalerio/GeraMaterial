import { $, esc, api, iniciarPagina, dataBrIso } from "./comum.js";

const params = new URLSearchParams(location.search);
const usuario = await iniciarPagina("turmas");
const gestor = usuario && (usuario.papel === "admin" || usuario.papel === "coordenador");
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const hojeIso = new Date().toLocaleDateString("en-CA"); // data local (aaaa-mm-dd)
const fmtH = (h) => `${String(Number(h)).replace(".", ",")}h`;

let dados = null; // turma aberta
let aulaAberta = null;

const SITUACAO = {
  "em-dia": ["Em dia", "ok"],
  atencao: ["Diário com pendência", "atencao"],
  atrasada: ["Diário atrasado", "atrasada"],
};
function situacao(atrasadas) {
  return atrasadas > 2 ? SITUACAO.atrasada : atrasadas > 0 ? SITUACAO.atencao : SITUACAO["em-dia"];
}

// ---------- Lista ----------
async function mostrarLista() {
  $("#vistaLista").hidden = false;
  $("#filtroGestor").hidden = !gestor;
  const todas = gestor && $("#verTodas").checked;
  const { itens } = await api(`/api/turmas${todas ? "?todas=1" : ""}`);
  const lista = $("#listaTurmas");
  if (!itens.length) {
    lista.innerHTML = `<div class="vazio-grande"><h2>Nenhuma turma ainda</h2>
      <p>No gerador, envie o plano de curso, monte o calendário e clique em <strong>Salvar como turma</strong>.</p>
      <a class="btn-gerar btn-curto" href="index.html">Criar a primeira turma</a></div>`;
    return;
  }
  lista.innerHTML = itens.map((t) => {
    const [rot, cls] = situacao(t.atrasadas);
    const pct = t.aulas ? Math.round((t.realizadas / t.aulas) * 100) : 0;
    return `<a class="card-turma" href="turmas.html?id=${t.id}">
      <span class="selo-situacao ${cls}">${rot}</span>
      <h2>${esc(t.nome)}</h2>
      <p class="card-curso">${esc(t.curso)}</p>
      ${todas ? `<p class="card-instrutor">${esc(t.instrutor)}</p>` : ""}
      <div class="barra-mini" aria-hidden="true"><div style="width:${pct}%"></div></div>
      <p class="card-meta">${t.realizadas} de ${t.aulas} aulas · ${t.alunos} alunos · ${dataBrIso(t.inicio)} a ${dataBrIso(t.termino)}</p>
    </a>`;
  }).join("");
}
$("#verTodas").onchange = mostrarLista;

// ---------- Detalhe ----------
async function carregarTurma() {
  dados = await api(`/api/turmas/${params.get("id")}`);
  renderTurma();
}

function renderTurma() {
  const { turma, aulas, alunos, andamento, sequencias } = dados;
  $("#vistaTurma").hidden = false;
  document.title = `${turma.nome} · gera.documento`;
  $("#tNome").textContent = turma.nome;
  const ucs = [...new Set(aulas.map((a) => a.uc))];
  $("#tSub").textContent = `${turma.curso}${gestor && turma.usuario_id != usuario.id ? ` · ${turma.instrutor}` : ""}`;
  $("#tGerar").href = `index.html?turma=${turma.id}`;
  const freqTotal = dados.frequencia.reduce((s, f) => s + f.aulas, 0);
  const presTotal = dados.frequencia.reduce((s, f) => s + f.presencas, 0);
  const [rot, cls] = situacao(andamento.atrasadas);
  $("#tIndicadores").innerHTML = `
    <div><strong>${andamento.realizadas}<small>/${andamento.total}</small></strong><span>aulas dadas</span></div>
    <div class="${cls}"><strong>${andamento.atrasadas}</strong><span>${andamento.atrasadas === 1 ? "aula sem registro" : "aulas sem registro"}</span><em>${rot}</em></div>
    <div><strong>${alunos.length}</strong><span>alunos</span></div>
    <div><strong>${freqTotal ? Math.round((presTotal / freqTotal) * 100) + "%" : "-"}</strong><span>frequência média</span></div>
    <div><strong>${new Set(sequencias.map((s) => s.uc)).size}<small>/${ucs.length}</small></strong><span>UCs com materiais</span></div>`;
  renderDiario();
  renderAlunos();
  renderNotas();
  renderMateriais();
}

function renderDiario() {
  const { aulas } = dados;
  const porUc = new Map();
  for (const a of aulas) { if (!porUc.has(a.uc)) porUc.set(a.uc, []); porUc.get(a.uc).push(a); }
  const proxima = aulas.find((a) => a.data >= hojeIso);
  $("#aba-diario").innerHTML = `<p class="dica-aba">Clique numa aula para registrar o diário, fazer a chamada ou gerar o roteiro.</p>` +
    [...porUc.entries()].map(([uc, lista]) => {
      const feitas = lista.filter((a) => a.realizada).length;
      // Abre só as UCs em andamento ou com pendência; as concluídas e as futuras ficam recolhidas.
      const pendente = lista.some((a) => a.data <= hojeIso && !a.realizada);
      const emAndamento = lista[0].data <= hojeIso && lista.at(-1).data >= hojeIso;
      const aberta = pendente || emAndamento || lista.some((a) => a.id === proxima?.id);
      return `<details class="bloco-uc"${aberta ? " open" : ""}><summary class="bloco-uc-cab"><h2>${esc(uc)}</h2><span>${feitas} de ${lista.length} aulas · ${dataBrIso(lista[0].data)} a ${dataBrIso(lista.at(-1).data)}</span></summary>
      <ol class="lista-aulas">${lista.map((a) => {
        const atrasada = a.data <= hojeIso && !a.realizada;
        const estado = a.realizada ? "feita" : atrasada ? "atrasada" : a.id === proxima?.id ? "proxima" : "";
        const d = new Date(`${a.data}T12:00:00`);
        return `<li><button type="button" class="aula ${estado}" data-aula="${a.id}">
          <span class="aula-data"><strong>${dataBrIso(a.data).slice(0, 5)}</strong>${DIAS[d.getDay()]}</span>
          <span class="aula-txt"><span class="aula-n">Aula ${a.numero_uc} · ${fmtH(a.ch)}${a.chamada ? " · chamada feita" : ""}${a.tem_roteiro ? " · roteiro" : ""}</span>
            ${esc(a.conteudo_dado || a.conteudo_previsto || (atrasada ? "Sem registro no diário" : "Sem conteúdo registrado"))}</span>
          <span class="aula-estado">${a.realizada ? "Dada" : atrasada ? "Pendente" : a.id === proxima?.id ? "Próxima" : ""}</span>
        </button></li>`;
      }).join("")}</ol></details>`;
    }).join("");
  $("#aba-diario").querySelectorAll("[data-aula]").forEach((b) => { b.onclick = () => abrirAula(Number(b.dataset.aula)); });
}

function renderAlunos() {
  const { alunos, frequencia } = dados;
  const freq = new Map(frequencia.map((f) => [Number(f.aluno_id), f]));
  $("#aba-alunos").innerHTML = `
    <div class="duas-colunas">
      <div>
        ${alunos.length ? `<table class="tabela"><thead><tr><th>Aluno</th><th>Matrícula</th><th class="num">Presenças</th><th class="num">Frequência</th><th></th></tr></thead>
        <tbody>${alunos.map((al) => {
          const f = freq.get(Number(al.id));
          const pct = f?.aulas ? Math.round((f.presencas / f.aulas) * 100) : null;
          return `<tr><td>${esc(al.nome)}</td><td>${esc(al.matricula || "-")}</td><td class="num">${f ? `${f.presencas}/${f.aulas}` : "-"}</td>
            <td class="num ${pct !== null && pct < 75 ? "alerta" : ""}">${pct === null ? "-" : pct + "%"}</td>
            <td class="num"><button type="button" class="link-remover" data-remover="${al.id}" aria-label="Remover ${esc(al.nome)}">Remover</button></td></tr>`;
        }).join("")}</tbody></table>
        <p class="dica-aba">Frequência abaixo de 75% aparece em vermelho. A chamada é feita dentro de cada aula, na aba Diário.</p>`
        : `<div class="vazio-grande pequeno"><h2>Sem alunos</h2><p>Cole a lista ao lado para começar a fazer chamada e lançar notas.</p></div>`}
      </div>
      <form class="caixa" id="formAlunos">
        <h3>Adicionar alunos</h3>
        <label>Um aluno por linha. Se quiser, coloque a matrícula depois de ponto e vírgula.
          <textarea name="lista" rows="8" placeholder="Ana Souza; 2026001&#10;Bruno Lima; 2026002"></textarea></label>
        <button type="submit" class="btn-gerar btn-curto">Adicionar</button>
      </form>
    </div>`;
  $("#formAlunos").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api(`/api/turmas/${dados.turma.id}/alunos`, { metodo: "POST", corpo: { lista: e.target.elements.lista.value } });
      await carregarTurma();
    } catch (err) { alert(err.message); }
  };
  $("#aba-alunos").querySelectorAll("[data-remover]").forEach((b) => {
    b.onclick = async () => {
      if (!confirm("Remover este aluno da turma? O histórico de chamadas e notas é mantido.")) return;
      await api(`/api/alunos/${b.dataset.remover}`, { metodo: "DELETE" });
      await carregarTurma();
    };
  });
}

function renderNotas() {
  const { alunos, notas, aulas } = dados;
  const ucs = [...new Set(aulas.map((a) => a.uc))];
  if (!alunos.length) {
    $("#aba-notas").innerHTML = `<div class="vazio-grande pequeno"><h2>Sem alunos</h2><p>Adicione os alunos na aba Alunos.</p></div>`;
    return;
  }
  const ucAtual = $("#aba-notas").dataset.uc && ucs.includes($("#aba-notas").dataset.uc) ? $("#aba-notas").dataset.uc : ucs[0];
  const nota = (aluno, av) => notas.find((n) => Number(n.aluno_id) === Number(aluno) && n.uc === ucAtual && n.avaliacao === av)?.nota ?? "";
  $("#aba-notas").innerHTML = `
    <div class="linha-entre"><label class="seletor">Unidade curricular
      <select id="ucNotas">${ucs.map((u) => `<option${u === ucAtual ? " selected" : ""}>${esc(u)}</option>`).join("")}</select></label>
      <p class="dica-aba">Total de 90 pontos por UC: avaliação de 30 + avaliação de 60.</p></div>
    <form id="formNotas"><table class="tabela tabela-notas"><thead><tr><th>Aluno</th><th class="num">Avaliação 30</th><th class="num">Avaliação 60</th><th class="num">Total</th></tr></thead>
    <tbody>${alunos.map((al) => {
      const n30 = nota(al.id, "30"), n60 = nota(al.id, "60");
      const total = n30 === "" && n60 === "" ? "" : Number(n30 || 0) + Number(n60 || 0);
      return `<tr data-aluno="${al.id}"><td>${esc(al.nome)}</td>
        <td class="num"><input type="number" min="0" max="30" step="0.5" inputmode="decimal" data-av="30" value="${n30}" aria-label="Nota de 30 de ${esc(al.nome)}"></td>
        <td class="num"><input type="number" min="0" max="60" step="0.5" inputmode="decimal" data-av="60" value="${n60}" aria-label="Nota de 60 de ${esc(al.nome)}"></td>
        <td class="num total">${total === "" ? "-" : String(total).replace(".", ",")}</td></tr>`;
    }).join("")}</tbody></table>
    <div class="linha-acoes"><button type="submit" class="btn-gerar btn-curto">Salvar notas</button><span class="aviso" id="avisoNotas" role="status"></span></div></form>`;
  $("#ucNotas").onchange = (e) => { $("#aba-notas").dataset.uc = e.target.value; renderNotas(); };
  $("#formNotas").oninput = (e) => {
    const tr = e.target.closest("tr");
    const vals = [...tr.querySelectorAll("input")].map((i) => i.value);
    tr.querySelector(".total").textContent = vals.every((v) => v === "") ? "-" : String(vals.reduce((s, v) => s + Number(v || 0), 0)).replace(".", ",");
  };
  $("#formNotas").onsubmit = async (e) => {
    e.preventDefault();
    const lista = [...e.target.querySelectorAll("tr[data-aluno]")].flatMap((tr) =>
      [...tr.querySelectorAll("input")].map((i) => ({ aluno_id: Number(tr.dataset.aluno), uc: ucAtual, avaliacao: i.dataset.av, nota: i.value === "" ? null : Number(i.value) })));
    try {
      await api(`/api/turmas/${dados.turma.id}/notas`, { metodo: "PUT", corpo: { notas: lista } });
      dados.notas = dados.notas.filter((n) => n.uc !== ucAtual).concat(lista.filter((n) => n.nota !== null));
      $("#avisoNotas").textContent = "Notas salvas.";
      $("#avisoNotas").classList.remove("erro");
    } catch (err) { $("#avisoNotas").textContent = err.message; $("#avisoNotas").classList.add("erro"); }
  };
}

function renderMateriais() {
  const { sequencias, aulas, turma } = dados;
  const ucs = [...new Set(aulas.map((a) => a.uc))];
  $("#aba-materiais").innerHTML = `<ul class="lista-materiais">${ucs.map((uc) => {
    const seq = sequencias.filter((s) => s.uc === uc).at(-1);
    const completo = seq && seq.etapas.length >= 5;
    return `<li><div><strong>${esc(uc)}</strong><span>${seq ? `${seq.etapas.length} de 5 materiais · gerado em ${new Date(seq.criado_em).toLocaleDateString("pt-BR")}` : "Ainda sem materiais"}</span></div>
      ${seq ? `<a class="btn-secundario" href="index.html?sequencia=${seq.id}">Abrir materiais</a>` : ""}
      ${completo ? "" : `<a class="btn-secundario" href="index.html?turma=${turma.id}">${seq ? "Completar" : "Gerar"}</a>`}</li>`;
  }).join("")}</ul>`;
}

// Abas
document.querySelectorAll("[data-aba]").forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll("[data-aba]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    document.querySelectorAll(".aba-corpo").forEach((c) => { c.hidden = c.id !== `aba-${b.dataset.aba}`; });
  };
});

$("#tExcluir").onclick = async () => {
  if (!confirm(`Excluir a turma ${dados.turma.nome}? Calendário, diário, alunos, chamadas e notas serão apagados. Os materiais gerados continuam em Meus materiais.`)) return;
  await api(`/api/turmas/${dados.turma.id}`, { metodo: "DELETE" });
  location.href = "turmas.html";
};

// ---------- Aula: diário, chamada e roteiro ----------
function gaveta(abrir) {
  $("#gavetaAula").classList.toggle("aberta", abrir);
  $("#veu").hidden = !abrir;
}
$("#aFechar").onclick = () => gaveta(false);
$("#veu").onclick = () => gaveta(false);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") gaveta(false); });

async function abrirAula(id) {
  aulaAberta = dados.aulas.find((a) => a.id == id);
  const a = aulaAberta;
  const d = new Date(`${a.data}T12:00:00`);
  $("#aTitulo").textContent = `Aula ${a.numero_uc} · ${dataBrIso(a.data)}`;
  $("#aSub").textContent = `${a.uc} · ${DIAS[d.getDay()]} · ${fmtH(a.ch)}`;
  $("#aPrevisto").value = a.conteudo_previsto || "";
  $("#aDado").value = a.conteudo_dado || "";
  $("#aRealizada").checked = a.realizada;
  $("#aAviso").textContent = "";
  $("#aRoteiroCorpo").innerHTML = "";
  $("#aRoteiro").textContent = a.tem_roteiro ? "Gerar de novo" : "Gerar roteiro";
  gaveta(true);
  // Chamada
  const alunos = dados.alunos;
  if (!alunos.length) {
    $("#aChamada").innerHTML = `<p class="dica-aba">Adicione os alunos na aba Alunos para fazer a chamada.</p>`;
  } else {
    const { itens } = await api(`/api/aulas/${a.id}/frequencia`);
    const marcado = new Map(itens.map((f) => [Number(f.aluno_id), f.presente]));
    const semChamada = !itens.length;
    $("#aChamada").innerHTML = `<div class="chamada">${alunos.map((al) => `<label><input type="checkbox" data-aluno="${al.id}"
      ${semChamada || marcado.get(Number(al.id)) ? "checked" : ""}><span>${esc(al.nome)}</span></label>`).join("")}</div>
      <div class="linha-acoes"><button type="button" class="btn-gerar btn-curto" id="aSalvarChamada">Salvar chamada</button>
      <span class="dica-aba">${semChamada ? "Todos marcados como presentes. Desmarque quem faltou." : "Chamada já registrada."}</span></div>`;
    $("#aSalvarChamada").onclick = async () => {
      const presencas = Object.fromEntries([...document.querySelectorAll("#aChamada input")].map((c) => [c.dataset.aluno, c.checked]));
      try {
        await api(`/api/aulas/${a.id}/frequencia`, { metodo: "PUT", corpo: { presencas } });
        $("#aAviso").textContent = "Chamada salva. A aula foi marcada como dada.";
        $("#aRealizada").checked = true;
        await carregarTurma();
        aulaAberta = dados.aulas.find((x) => x.id == id);
      } catch (err) { $("#aAviso").textContent = err.message; }
    };
  }
  // Roteiro já gerado
  if (a.tem_roteiro) {
    const { roteiro } = await api(`/api/aulas/${a.id}/roteiro`);
    if (roteiro) mostrarRoteiro(roteiro);
  }
}

$("#aSalvar").onclick = async () => {
  const a = aulaAberta;
  try {
    await api(`/api/aulas/${a.id}`, { metodo: "PATCH", corpo: { conteudo_previsto: $("#aPrevisto").value, conteudo_dado: $("#aDado").value, realizada: $("#aRealizada").checked } });
    $("#aAviso").textContent = "Diário salvo.";
    await carregarTurma();
  } catch (err) { $("#aAviso").textContent = err.message; }
};

function mostrarRoteiro(r) {
  $("#aRoteiroCorpo").innerHTML = `
    <p class="roteiro-tema">${esc(r.tema)}</p>
    ${r.objetivos?.length ? `<h4>Objetivos</h4><ul>${r.objetivos.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
    ${r.momentos?.length ? `<h4>Momentos da aula</h4><ol class="momentos">${r.momentos.map((m) => `<li><span class="tempo">${esc(m.tempo)}</span>
      <div><strong>${esc(m.titulo)}</strong><p>${esc(m.docente)}</p>${m.alunos ? `<p class="alunos">Alunos: ${esc(m.alunos)}</p>` : ""}</div></li>`).join("")}</ol>` : ""}
    ${r.atividade ? `<h4>Atividade principal</h4><p>${esc(r.atividade)}</p>` : ""}
    ${r.avaliacao ? `<h4>Como verificar a aprendizagem</h4><p>${esc(r.avaliacao)}</p>` : ""}
    ${r.materiais?.length ? `<h4>Materiais</h4><p>${r.materiais.map(esc).join(", ")}</p>` : ""}
    ${r.tarefa ? `<h4>Para a próxima aula</h4><p>${esc(r.tarefa)}</p>` : ""}`;
}

$("#aRoteiro").onclick = async () => {
  const b = $("#aRoteiro");
  b.disabled = true;
  b.textContent = "Gerando…";
  $("#aRoteiroCorpo").innerHTML = `<p class="dica-aba">Montando o roteiro a partir do diário e dos materiais da UC. Leva cerca de 1 minuto.</p>`;
  try {
    const { roteiro } = await api(`/api/aulas/${aulaAberta.id}/roteiro`, { metodo: "POST" });
    mostrarRoteiro(roteiro);
    if (!$("#aPrevisto").value && roteiro.tema) $("#aPrevisto").value = roteiro.tema;
    aulaAberta.tem_roteiro = true;
  } catch (err) {
    $("#aRoteiroCorpo").innerHTML = `<p class="aviso erro">${esc(err.message)}</p>`;
  } finally {
    b.disabled = false;
    b.textContent = "Gerar de novo";
  }
};

if (usuario) {
  if (params.get("id")) carregarTurma().catch((e) => { $("#vistaTurma").hidden = false; $("#vistaTurma").innerHTML = `<p class="aviso erro">${esc(e.message)}</p><a href="turmas.html">Voltar</a>`; });
  else mostrarLista();
}
