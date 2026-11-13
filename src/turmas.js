// Turmas: calendário de aulas, diário, alunos, frequência, notas, roteiro por aula e painel da coordenação.
import { sql } from "./db.js";
import { exigeLogin, exigeGestor, ehGestor } from "./auth.js";
import { perguntarJson } from "./ia.js";
import { SISTEMA, ROTEIRO } from "./prompts.js";

// Datas no horário de Brasília (o servidor roda em UTC).
const hoje = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const brParaIso = (s) => {
  const m = String(s || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(s || "").slice(0, 10);
};

// Confere se o usuário pode mexer na turma (dono, coordenação ou admin).
async function turmaDoUsuario(id, usuario) {
  const [t] = await sql`SELECT * FROM turmas WHERE id = ${id}`;
  if (!t || (!ehGestor(usuario) && Number(t.usuario_id) !== usuario.id)) return null;
  return t;
}
async function aulaDoUsuario(id, usuario) {
  const [a] = await sql`SELECT a.*, t.usuario_id FROM aulas a JOIN turmas t ON t.id = a.turma_id WHERE a.id = ${id}`;
  if (!a || (!ehGestor(usuario) && Number(a.usuario_id) !== usuario.id)) return null;
  return a;
}

// Andamento: aulas que já passaram e ainda não foram registradas no diário.
function andamento(aulas) {
  const h = hoje();
  const passadas = aulas.filter((a) => String(a.data).slice(0, 10) <= h);
  const realizadas = aulas.filter((a) => a.realizada).length;
  const atrasadas = passadas.filter((a) => !a.realizada).length;
  return { total: aulas.length, previstas: passadas.length, realizadas, atrasadas,
    situacao: atrasadas > 2 ? "atrasada" : atrasadas > 0 ? "atencao" : "em-dia" };
}

export function rotasTurmas(app) {
  // Lista: instrutor vê as dele; coordenação vê todas (com ?todas=1).
  app.get("/api/turmas", exigeLogin, async (req, res) => {
    const todas = ehGestor(req.usuario) && req.query.todas === "1";
    const turmas = await sql`
      SELECT t.id, t.nome, t.curso, t.criado_em, u.nome AS instrutor,
        (SELECT count(*)::int FROM alunos al WHERE al.turma_id = t.id AND al.ativo) AS alunos,
        (SELECT count(*)::int FROM aulas a WHERE a.turma_id = t.id) AS aulas,
        (SELECT count(*)::int FROM aulas a WHERE a.turma_id = t.id AND a.realizada) AS realizadas,
        (SELECT count(*)::int FROM aulas a WHERE a.turma_id = t.id AND a.data <= (now() AT TIME ZONE 'America/Sao_Paulo')::date AND NOT a.realizada) AS atrasadas,
        (SELECT min(data) FROM aulas a WHERE a.turma_id = t.id) AS inicio,
        (SELECT max(data) FROM aulas a WHERE a.turma_id = t.id) AS termino
      FROM turmas t JOIN usuarios u ON u.id = t.usuario_id
      WHERE (${todas} OR t.usuario_id = ${req.usuario.id})
      ORDER BY t.criado_em DESC`;
    res.json({ itens: turmas });
  });

  // Cria a turma a partir do calendário calculado na tela do gerador.
  app.post("/api/turmas", exigeLogin, async (req, res) => {
    try {
      const { nome, curso, dados = {}, aulas = [] } = req.body;
      if (!String(nome || "").trim() || !String(curso || "").trim()) return res.status(400).json({ erro: "Informe o nome da turma e o curso." });
      if (!aulas.length) return res.status(400).json({ erro: "Monte o calendário da turma antes de salvar." });
      const [t] = await sql`INSERT INTO turmas (usuario_id, nome, curso, dados) VALUES (${req.usuario.id}, ${nome.trim()}, ${curso.trim()}, ${JSON.stringify(dados)}) RETURNING id`;
      // Insere todas as aulas numa única instrução.
      await sql`
        INSERT INTO aulas (turma_id, uc, numero, numero_uc, data, ch)
        SELECT ${t.id}, x.uc, x.numero, x.numero_uc, x.data::date, x.ch
        FROM jsonb_to_recordset(${JSON.stringify(aulas.map((a) => ({ ...a, data: brParaIso(a.data) })))}::jsonb)
          AS x(uc text, numero int, numero_uc int, data text, ch numeric)`;
      res.json({ id: t.id });
    } catch (e) { console.error(e); res.status(500).json({ erro: e.message }); }
  });

  app.get("/api/turmas/:id", exigeLogin, async (req, res) => {
    const t = await turmaDoUsuario(Number(req.params.id), req.usuario);
    if (!t) return res.status(404).json({ erro: "Turma não encontrada." });
    const [alunos, aulas, notas, freq, sequencias] = await Promise.all([
      sql`SELECT id, nome, matricula FROM alunos WHERE turma_id = ${t.id} AND ativo ORDER BY nome`,
      sql`SELECT id, uc, numero, numero_uc, to_char(data, 'YYYY-MM-DD') AS data, ch, conteudo_previsto, conteudo_dado, realizada,
                 (roteiro IS NOT NULL) AS tem_roteiro,
                 (SELECT count(*)::int FROM frequencias f WHERE f.aula_id = aulas.id) AS chamada
          FROM aulas WHERE turma_id = ${t.id} ORDER BY numero`,
      sql`SELECT aluno_id, uc, avaliacao, nota FROM notas WHERE turma_id = ${t.id}`,
      sql`SELECT f.aluno_id, count(*)::int AS aulas, count(*) FILTER (WHERE f.presente)::int AS presencas
          FROM frequencias f JOIN aulas a ON a.id = f.aula_id WHERE a.turma_id = ${t.id} GROUP BY f.aluno_id`,
      sql`SELECT s.id, s.uc, s.criado_em, COALESCE(array_agg(e.etapa) FILTER (WHERE e.etapa IS NOT NULL), '{}') AS etapas
          FROM sequencias s LEFT JOIN entregas e ON e.sequencia_id = s.id WHERE s.turma_id = ${t.id} GROUP BY s.id ORDER BY s.criado_em`,
    ]);
    const [dono] = await sql`SELECT nome FROM usuarios WHERE id = ${t.usuario_id}`;
    res.json({ turma: { ...t, instrutor: dono?.nome }, alunos, aulas, notas, frequencia: freq, sequencias, andamento: andamento(aulas) });
  });

  app.patch("/api/turmas/:id", exigeLogin, async (req, res) => {
    const t = await turmaDoUsuario(Number(req.params.id), req.usuario);
    if (!t) return res.status(404).json({ erro: "Turma não encontrada." });
    const nome = String(req.body.nome || "").trim() || t.nome;
    await sql`UPDATE turmas SET nome = ${nome}, atualizado_em = now() WHERE id = ${t.id}`;
    res.json({ ok: true });
  });

  app.delete("/api/turmas/:id", exigeLogin, async (req, res) => {
    const t = await turmaDoUsuario(Number(req.params.id), req.usuario);
    if (!t) return res.status(404).json({ erro: "Turma não encontrada." });
    await sql`DELETE FROM turmas WHERE id = ${t.id}`;
    res.json({ ok: true });
  });

  // ---------- Alunos ----------
  app.post("/api/turmas/:id/alunos", exigeLogin, async (req, res) => {
    const t = await turmaDoUsuario(Number(req.params.id), req.usuario);
    if (!t) return res.status(404).json({ erro: "Turma não encontrada." });
    // Aceita uma lista colada (um aluno por linha; "nome; matrícula" opcional).
    const linhas = String(req.body.lista || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const novos = linhas.map((l) => { const [nome, matricula] = l.split(/\s*[;\t]\s*/); return { nome, matricula: matricula || null }; })
      .filter((a) => a.nome);
    if (!novos.length) return res.status(400).json({ erro: "Cole pelo menos um nome, um por linha." });
    await sql`
      INSERT INTO alunos (turma_id, nome, matricula)
      SELECT ${t.id}, x.nome, x.matricula FROM jsonb_to_recordset(${JSON.stringify(novos)}::jsonb) AS x(nome text, matricula text)`;
    res.json({ adicionados: novos.length });
  });
  app.delete("/api/alunos/:id", exigeLogin, async (req, res) => {
    const [a] = await sql`SELECT turma_id FROM alunos WHERE id = ${Number(req.params.id)}`;
    if (!a || !(await turmaDoUsuario(a.turma_id, req.usuario))) return res.status(404).json({ erro: "Aluno não encontrado." });
    await sql`UPDATE alunos SET ativo = false WHERE id = ${Number(req.params.id)}`;
    res.json({ ok: true });
  });

  // ---------- Diário: o que foi dado na aula ----------
  app.patch("/api/aulas/:id", exigeLogin, async (req, res) => {
    const a = await aulaDoUsuario(Number(req.params.id), req.usuario);
    if (!a) return res.status(404).json({ erro: "Aula não encontrada." });
    const { conteudo_dado, conteudo_previsto, realizada } = req.body;
    await sql`
      UPDATE aulas SET
        conteudo_dado = COALESCE(${conteudo_dado ?? null}, conteudo_dado),
        conteudo_previsto = COALESCE(${conteudo_previsto ?? null}, conteudo_previsto),
        realizada = COALESCE(${typeof realizada === "boolean" ? realizada : null}::boolean, realizada)
      WHERE id = ${a.id}`;
    res.json({ ok: true });
  });

  // ---------- Frequência ----------
  app.get("/api/aulas/:id/frequencia", exigeLogin, async (req, res) => {
    const a = await aulaDoUsuario(Number(req.params.id), req.usuario);
    if (!a) return res.status(404).json({ erro: "Aula não encontrada." });
    const itens = await sql`SELECT aluno_id, presente FROM frequencias WHERE aula_id = ${a.id}`;
    res.json({ itens });
  });
  app.put("/api/aulas/:id/frequencia", exigeLogin, async (req, res) => {
    const a = await aulaDoUsuario(Number(req.params.id), req.usuario);
    if (!a) return res.status(404).json({ erro: "Aula não encontrada." });
    const itens = Object.entries(req.body.presencas || {}).map(([aluno_id, presente]) => ({ aluno_id: Number(aluno_id), presente: Boolean(presente) }));
    await sql`
      INSERT INTO frequencias (aula_id, aluno_id, presente)
      SELECT ${a.id}, x.aluno_id, x.presente FROM jsonb_to_recordset(${JSON.stringify(itens)}::jsonb) AS x(aluno_id bigint, presente boolean)
      JOIN alunos al ON al.id = x.aluno_id AND al.turma_id = ${a.turma_id}
      ON CONFLICT (aula_id, aluno_id) DO UPDATE SET presente = EXCLUDED.presente`;
    // Fazer a chamada marca a aula como realizada.
    await sql`UPDATE aulas SET realizada = true WHERE id = ${a.id}`;
    res.json({ ok: true });
  });

  // ---------- Notas (avaliações de 30 e 60 pontos por UC) ----------
  app.put("/api/turmas/:id/notas", exigeLogin, async (req, res) => {
    const t = await turmaDoUsuario(Number(req.params.id), req.usuario);
    if (!t) return res.status(404).json({ erro: "Turma não encontrada." });
    const itens = (req.body.notas || []).filter((n) => ["30", "60"].includes(String(n.avaliacao)));
    for (const n of itens) {
      const max = Number(n.avaliacao);
      if (n.nota !== null && n.nota !== "" && (Number(n.nota) < 0 || Number(n.nota) > max)) {
        return res.status(400).json({ erro: `A nota da avaliação de ${max} pontos precisa estar entre 0 e ${max}.` });
      }
    }
    const comNota = itens.filter((n) => n.nota !== null && n.nota !== "").map((n) => ({ ...n, nota: Number(n.nota), avaliacao: String(n.avaliacao) }));
    const semNota = itens.filter((n) => n.nota === null || n.nota === "");
    if (comNota.length) await sql`
      INSERT INTO notas (turma_id, aluno_id, uc, avaliacao, nota)
      SELECT ${t.id}, x.aluno_id, x.uc, x.avaliacao, x.nota FROM jsonb_to_recordset(${JSON.stringify(comNota)}::jsonb)
        AS x(aluno_id bigint, uc text, avaliacao text, nota numeric)
      JOIN alunos al ON al.id = x.aluno_id AND al.turma_id = ${t.id}
      ON CONFLICT (aluno_id, uc, avaliacao) DO UPDATE SET nota = EXCLUDED.nota`;
    for (const n of semNota) await sql`DELETE FROM notas WHERE turma_id = ${t.id} AND aluno_id = ${n.aluno_id} AND uc = ${n.uc} AND avaliacao = ${String(n.avaliacao)}`;
    res.json({ ok: true });
  });

  // ---------- Roteiro de uma aula (IA) ----------
  app.get("/api/aulas/:id/roteiro", exigeLogin, async (req, res) => {
    const a = await aulaDoUsuario(Number(req.params.id), req.usuario);
    if (!a) return res.status(404).json({ erro: "Aula não encontrada." });
    res.json({ roteiro: a.roteiro });
  });
  app.post("/api/aulas/:id/roteiro", exigeLogin, async (req, res) => {
    try {
      const a = await aulaDoUsuario(Number(req.params.id), req.usuario);
      if (!a) return res.status(404).json({ erro: "Aula não encontrada." });
      const [t] = await sql`SELECT * FROM turmas WHERE id = ${a.turma_id}`;
      const aulasUc = await sql`SELECT numero_uc, to_char(data,'DD/MM/YYYY') AS data, conteudo_previsto, conteudo_dado, realizada
                                FROM aulas WHERE turma_id = ${t.id} AND uc = ${a.uc} ORDER BY numero_uc`;
      // Usa o PER e o plano já gerados para esta UC, se existirem.
      const [seq] = await sql`SELECT id FROM sequencias WHERE turma_id = ${t.id} AND uc = ${a.uc} ORDER BY criado_em DESC LIMIT 1`;
      const entregas = seq ? await sql`SELECT etapa, conteudo FROM entregas WHERE sequencia_id = ${seq.id} AND etapa IN ('per','plano')` : [];
      const contexto = `Curso: ${t.curso}\nTurma: ${t.nome}\nUnidade curricular: ${a.uc}
Esta é a aula ${a.numero_uc} de ${aulasUc.length} da UC, em ${new Date(a.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}, com ${a.ch}h.
Aulas da UC (diário):\n${aulasUc.map((x) => `- Aula ${x.numero_uc} (${x.data}): ${x.conteudo_dado || x.conteudo_previsto || "sem registro"}${x.realizada ? " [realizada]" : ""}`).join("\n")}
${entregas.map((e) => `MATERIAL JÁ GERADO (${e.etapa}):\n${JSON.stringify(e.conteudo)}`).join("\n\n")}`;
      const roteiro = await perguntarJson(SISTEMA, `${contexto}\n\nTAREFA: ${ROTEIRO}`);
      await sql`UPDATE aulas SET roteiro = ${JSON.stringify(roteiro)},
                conteudo_previsto = COALESCE(conteudo_previsto, ${roteiro.tema || null}) WHERE id = ${a.id}`;
      res.json({ roteiro });
    } catch (e) { console.error(e); res.status(500).json({ erro: e.message }); }
  });

  // ---------- Início: resumo do dia para quem entrou ----------
  app.get("/api/inicio", exigeLogin, async (req, res) => {
    const uid = req.usuario.id;
    const [proximas, pendentes, materiais, totais] = await Promise.all([
      sql`SELECT a.id, a.uc, a.numero_uc, to_char(a.data,'YYYY-MM-DD') AS data, a.ch, a.conteudo_previsto, t.id AS turma_id, t.nome AS turma,
            (SELECT count(*)::int FROM aulas x WHERE x.turma_id = a.turma_id AND x.uc = a.uc) AS total_uc
          FROM aulas a JOIN turmas t ON t.id = a.turma_id
          WHERE t.usuario_id = ${uid} AND a.data >= (now() AT TIME ZONE 'America/Sao_Paulo')::date AND NOT a.realizada
          ORDER BY a.data, t.nome LIMIT 4`,
      sql`SELECT t.id, t.nome, count(*)::int AS aulas, min(to_char(a.data,'YYYY-MM-DD')) AS desde
          FROM aulas a JOIN turmas t ON t.id = a.turma_id
          WHERE t.usuario_id = ${uid} AND a.data < (now() AT TIME ZONE 'America/Sao_Paulo')::date AND NOT a.realizada
          GROUP BY t.id, t.nome ORDER BY aulas DESC LIMIT 5`,
      sql`SELECT s.id, s.uc, s.curso, s.criado_em, COALESCE(array_agg(e.etapa) FILTER (WHERE e.etapa IS NOT NULL), '{}') AS etapas
          FROM sequencias s LEFT JOIN entregas e ON e.sequencia_id = s.id
          WHERE s.usuario_id = ${uid} GROUP BY s.id ORDER BY s.criado_em DESC LIMIT 10`,
      sql`SELECT (SELECT count(*)::int FROM turmas WHERE usuario_id = ${uid}) AS turmas,
                 (SELECT count(*)::int FROM sequencias WHERE usuario_id = ${uid}) AS materiais,
                 (SELECT count(*)::int FROM aulas a JOIN turmas t ON t.id = a.turma_id WHERE t.usuario_id = ${uid} AND a.realizada) AS aulas_dadas,
                 (SELECT count(*)::int FROM usuarios WHERE NOT aprovado) AS pendentes_acesso`,
    ]);
    res.json({ proximas, pendentes, materiais, totais: totais[0] });
  });

  // ---------- Painel da coordenação ----------
  app.get("/api/painel", exigeLogin, exigeGestor, async (_req, res) => {
    const [instrutores, turmas, totais] = await Promise.all([
      sql`SELECT u.id, u.nome, u.email, u.papel,
            (SELECT count(*)::int FROM turmas t WHERE t.usuario_id = u.id) AS turmas,
            (SELECT count(*)::int FROM sequencias s WHERE s.usuario_id = u.id) AS sequencias,
            (SELECT count(*)::int FROM aulas a JOIN turmas t ON t.id = a.turma_id WHERE t.usuario_id = u.id AND a.data <= (now() AT TIME ZONE 'America/Sao_Paulo')::date AND NOT a.realizada) AS atrasadas,
            (SELECT max(s.criado_em) FROM sequencias s WHERE s.usuario_id = u.id) AS ultimo_material
          FROM usuarios u WHERE u.aprovado ORDER BY u.nome`,
      sql`SELECT t.id, t.nome, t.curso, u.nome AS instrutor,
            (SELECT count(*)::int FROM aulas a WHERE a.turma_id = t.id) AS aulas,
            (SELECT count(*)::int FROM aulas a WHERE a.turma_id = t.id AND a.realizada) AS realizadas,
            (SELECT count(*)::int FROM aulas a WHERE a.turma_id = t.id AND a.data <= (now() AT TIME ZONE 'America/Sao_Paulo')::date) AS previstas,
            (SELECT count(*)::int FROM aulas a WHERE a.turma_id = t.id AND a.data <= (now() AT TIME ZONE 'America/Sao_Paulo')::date AND NOT a.realizada) AS atrasadas,
            (SELECT count(*)::int FROM alunos al WHERE al.turma_id = t.id AND al.ativo) AS alunos,
            (SELECT round(100.0 * count(*) FILTER (WHERE f.presente) / NULLIF(count(*), 0))::int
               FROM frequencias f JOIN aulas a ON a.id = f.aula_id WHERE a.turma_id = t.id) AS frequencia,
            (SELECT count(*)::int FROM sequencias s WHERE s.turma_id = t.id) AS sequencias,
            (SELECT max(data) FROM aulas a WHERE a.turma_id = t.id) AS termino
          FROM turmas t JOIN usuarios u ON u.id = t.usuario_id ORDER BY atrasadas DESC, t.criado_em DESC`,
      sql`SELECT (SELECT count(*)::int FROM usuarios WHERE aprovado) AS instrutores,
                 (SELECT count(*)::int FROM usuarios WHERE NOT aprovado) AS bloqueadas,
                 (SELECT count(*)::int FROM usuarios WHERE aprovado AND nova_senha) AS primeiro_acesso,
                 (SELECT count(*)::int FROM turmas) AS turmas,
                 (SELECT count(*)::int FROM sequencias WHERE criado_em > now() - interval '30 days') AS materiais_mes`,
    ]);
    res.json({ instrutores, turmas, totais: totais[0] });
  });
}
