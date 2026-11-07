import fs from "node:fs";
const B = process.argv[2], PDF = process.argv[3];
let ck = "";
const f = async (p, o = {}) => {
  const r = await fetch(B + p, { ...o, headers: { ...(o.headers || {}), cookie: ck } });
  const sc = r.headers.get("set-cookie"); if (sc) ck = sc.split(";")[0];
  return r;
};
const json = (o) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });
const ok = (n, c, x = "") => console.log(`${c ? "OK  " : "FALHA"} ${n} ${x}`);
const t0 = () => Date.now(), seg = (t) => ((Date.now() - t) / 1000).toFixed(0) + "s";
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
ok("login", (await f("/api/auth/entrar", json({ email: "ux@teste.local", senha: "TesteUx2026!" }))).ok);

let t = t0();
const fd = new FormData(); fd.append("referencias", new Blob([fs.readFileSync(PDF)], { type: "application/pdf" }), "plano.pdf");
const an = await (await f("/api/analisar", { method: "POST", body: fd })).json();
const uc = an.ucs?.find((u) => u.conhecimentos?.length) || an.ucs?.[0];
ok("leitura do plano de curso", !!uc, `${seg(t)} · ${an.ucs?.length} UCs · "${uc?.nome}" · ${uc?.conhecimentos?.length} tópicos`);

const dados = { curso: an.curso, uc: uc.nome, cargaHorariaUC: uc.cargaHoraria, turma: "TESTE-E2E", instrutor: "Revisão UX", horasAula: "4",
  conhecimentosUC: uc.conhecimentos, capacidadesUC: uc.capacidades, avaliacoes: {} };
const g = new FormData();
g.append("dados", JSON.stringify(dados)); g.append("anteriores", "{}"); g.append("seguir", JSON.stringify(["plano", "avaliacao", "atividade"]));
g.append("referencias", new Blob([fs.readFileSync(PDF)], { type: "application/pdf" }), "plano.pdf");
t = t0();
const { sequenciaId: id } = await (await f("/api/gerar/per", { method: "POST", body: g })).json();
ok("início da cadeia", !!id, `sequência ${id}`);
const marcas = {}; let p;
let paralelo = false;
for (let i = 0; i < 150; i++) {
  await espera(3000);
  p = await (await f(`/api/sequencias/${id}/progresso`)).json();
  for (const k of Object.keys(p.resultados)) marcas[k] ??= seg(t);
  if (p.estados.avaliacao?.tipo === "gerando" && p.estados.atividade?.tipo === "gerando") paralelo = true;
  if (!p.ativo) break;
}
ok("cadeia completa (4 materiais)", ["per", "plano", "avaliacao", "atividade"].every((k) => p.resultados[k]), `total ${seg(t)} · ${JSON.stringify(marcas)}`);
ok("avaliação e atividade em paralelo", paralelo);
const erros = Object.entries(p.estados).filter(([, e]) => e.tipo === "erro"); ok("sem erros na cadeia", !erros.length, JSON.stringify(erros));
const cf = p.resultados.plano?.conferencia;
ok("conferência do plano", !!cf, JSON.stringify(cf));

t = t0();
ok("pedido de slides do encontro 1", (await f(`/api/sequencias/${id}/slides/1`, { method: "POST" })).status === 202);
for (let i = 0; i < 80; i++) { await espera(3000); p = await (await f(`/api/sequencias/${id}/progresso`)).json(); if (p.resultados["slides:1"] || p.estados["slides:1"]?.tipo === "erro") break; }
const sl = p.resultados["slides:1"];
ok("slides do encontro 1", !!sl, `${seg(t)} · ${sl?.slides?.length} slides · ${sl?.slides?.filter((s) => s.notas).length} com notas · ${p.estados["slides:1"]?.msg || ""}`);

const plano = structuredClone(p.resultados.plano); plano.dias[0].objetivo = "OBJETIVO EDITADO NO TESTE";
ok("salvar edição", (await f(`/api/sequencias/${id}/entregas/plano`, { ...json({ conteudo: plano }), method: "PUT" })).ok);
const s1 = await (await f(`/api/sequencias/${id}`)).json();
ok("edição persistida", s1.resultados.plano.dias[0].objetivo === "OBJETIVO EDITADO NO TESTE");
ok("slides continuam após edição", !!s1.resultados["slides:1"]);

t = t0();
const antes = JSON.stringify(s1.resultados.plano.dias[1]);
const rf = await f(`/api/sequencias/${id}/plano/encontro/2`, json({ pedido: "mais prático" }));
const rj = await rf.json();
ok("refazer encontro 2", rf.ok && JSON.stringify(rj.plano?.dias?.[1]) !== antes && rj.plano.dias[0].objetivo === "OBJETIVO EDITADO NO TESTE", `${seg(t)} ${rj.erro || ""}`);

const cp = await (await f(`/api/sequencias/${id}/copiar`, json({ turma: "TESTE-COPIA" }))).json();
const s2 = await (await f(`/api/sequencias/${cp.id}`)).json();
ok("copiar para outra turma", Object.keys(s2.resultados || {}).length >= 4, `nova ${cp.id} · ${Object.keys(s2.resultados || {}).join(",")} · turma ${s2.turma}`);

const qs = await (await f(`/api/questoes?busca=${encodeURIComponent(uc.nome.slice(0, 15))}`)).json();
ok("banco de questões", qs.itens?.length > 0, `${qs.itens?.length} questões`);

const itens = [{ formato: "per", dados: s1.resultados.per, nome: "PER" }, { formato: "planoaula", dados: rj.plano, nome: "Plano" },
  { formato: "pptx", dados: sl, nome: "Slides 1" }];
const z = await f("/api/exportar-pacote?nome=t", json({ itens }));
const buf = Buffer.from(await z.arrayBuffer()); fs.writeFileSync(process.argv[4] + "/pacote.zip", buf);
ok("baixar tudo (.zip)", z.ok && buf.length > 10000, `${(buf.length / 1024).toFixed(0)} KB`);
const pn = await (await f("/api/painel")).json();
const eu = pn.instrutores?.find((i) => i.email === "ux@teste.local");
ok("painel da coordenação", eu && "completas" in eu, `${eu?.completas} de ${eu?.sequencias} completas`);
fs.writeFileSync(process.argv[4] + "/ids.txt", `${id} ${cp.id}`);
