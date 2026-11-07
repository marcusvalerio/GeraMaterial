// Acesso ao banco (Neon Postgres): sequências geradas, com dono (instrutor) e turma.
import { neon } from "@neondatabase/serverless";

export const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
export const bancoAtivo = () => Boolean(sql);

const gestor = (u) => u && (u.papel === "admin" || u.papel === "coordenador");

export async function criarSequencia(dados, referencias = [], usuarioId = null, turmaId = null) {
  if (!sql) return null;
  const [s] = await sql`
    INSERT INTO sequencias (curso, uc, turma, instrutor, dados, referencias, usuario_id, turma_id)
    VALUES (${dados.curso || "-"}, ${dados.uc || "-"}, ${dados.turma || null}, ${dados.instrutor || null},
            ${JSON.stringify(dados)}, ${referencias}, ${usuarioId}, ${turmaId})
    RETURNING id`;
  return s.id;
}

// Slides por encontro ficam todos numa entrega "slides": { encontros: { "3": {...} } }.
export function mapaEntregas(entregas) {
  const m = {};
  for (const e of entregas) {
    if (e.etapa === "slides" && e.conteudo?.encontros) for (const [n, c] of Object.entries(e.conteudo.encontros)) m[`slides:${n}`] = c;
    else m[e.etapa] = e.conteudo;
  }
  return m;
}

export async function salvarEntrega(sequenciaId, etapa, conteudo) {
  if (!sql || !sequenciaId) return;
  if (etapa.startsWith("slides:")) {
    const n = etapa.split(":")[1];
    const novo = JSON.stringify({ encontros: { [n]: conteudo } });
    await sql`
      INSERT INTO entregas (sequencia_id, etapa, conteudo) VALUES (${sequenciaId}, 'slides', ${novo})
      ON CONFLICT (sequencia_id, etapa) DO UPDATE SET gerado_em = now(),
        conteudo = jsonb_build_object('encontros', COALESCE(entregas.conteudo->'encontros', '{}'::jsonb) || (EXCLUDED.conteudo->'encontros'))`;
    return;
  }
  await sql`
    INSERT INTO entregas (sequencia_id, etapa, conteudo) VALUES (${sequenciaId}, ${etapa}, ${JSON.stringify(conteudo)})
    ON CONFLICT (sequencia_id, etapa) DO UPDATE SET conteudo = EXCLUDED.conteudo, gerado_em = now()`;
  await sql`UPDATE sequencias SET atualizado_em = now() WHERE id = ${sequenciaId}`;
}

// Instrutor vê as próprias sequências; coordenação e admin veem todas.
export async function listarSequencias(busca = "", usuario = null) {
  if (!sql) return [];
  const q = `%${busca}%`;
  const todos = gestor(usuario);
  return sql`
    SELECT s.id, s.curso, s.uc, s.turma, s.instrutor, s.criado_em, s.turma_id,
           COALESCE(array_agg(e.etapa) FILTER (WHERE e.etapa IS NOT NULL), '{}') AS etapas
    FROM sequencias s LEFT JOIN entregas e ON e.sequencia_id = s.id
    WHERE (${todos} OR s.usuario_id = ${usuario?.id ?? -1})
      AND (s.curso ILIKE ${q} OR s.uc ILIKE ${q} OR COALESCE(s.turma,'') ILIKE ${q} OR COALESCE(s.instrutor,'') ILIKE ${q})
    GROUP BY s.id ORDER BY s.criado_em DESC LIMIT 100`;
}

export async function obterSequencia(id, usuario = null) {
  if (!sql) return null;
  const [s] = await sql`SELECT * FROM sequencias WHERE id = ${id}`;
  if (!s || (!gestor(usuario) && Number(s.usuario_id) !== usuario?.id)) return null;
  const entregas = await sql`SELECT etapa, conteudo FROM entregas WHERE sequencia_id = ${id}`;
  s.resultados = mapaEntregas(entregas);
  return s;
}

export async function podeEditarSequencia(id, usuario) {
  if (!sql || !id) return false;
  const [s] = await sql`SELECT usuario_id FROM sequencias WHERE id = ${id}`;
  return Boolean(s) && (gestor(usuario) || Number(s.usuario_id) === usuario?.id);
}

export async function excluirSequencia(id, usuario = null) {
  if (!sql) return;
  if (!(await podeEditarSequencia(id, usuario))) return;
  await sql`DELETE FROM sequencias WHERE id = ${id}`;
}
