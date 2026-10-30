// Histórico de sequências geradas (Neon Postgres).
import { neon } from "@neondatabase/serverless";

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
export const bancoAtivo = () => Boolean(sql);

export async function criarSequencia(dados, referencias = []) {
  if (!sql) return null;
  const [s] = await sql`
    INSERT INTO sequencias (curso, uc, turma, instrutor, dados, referencias)
    VALUES (${dados.curso || "-"}, ${dados.uc || "-"}, ${dados.turma || null}, ${dados.instrutor || null},
            ${JSON.stringify(dados)}, ${referencias})
    RETURNING id`;
  return s.id;
}

export async function salvarEntrega(sequenciaId, etapa, conteudo) {
  if (!sql || !sequenciaId) return;
  await sql`
    INSERT INTO entregas (sequencia_id, etapa, conteudo) VALUES (${sequenciaId}, ${etapa}, ${JSON.stringify(conteudo)})
    ON CONFLICT (sequencia_id, etapa) DO UPDATE SET conteudo = EXCLUDED.conteudo, gerado_em = now()`;
  await sql`UPDATE sequencias SET atualizado_em = now() WHERE id = ${sequenciaId}`;
}

export async function listarSequencias(busca = "") {
  if (!sql) return [];
  const q = `%${busca}%`;
  return sql`
    SELECT s.id, s.curso, s.uc, s.turma, s.instrutor, s.criado_em,
           COALESCE(array_agg(e.etapa) FILTER (WHERE e.etapa IS NOT NULL), '{}') AS etapas
    FROM sequencias s LEFT JOIN entregas e ON e.sequencia_id = s.id
    WHERE s.curso ILIKE ${q} OR s.uc ILIKE ${q} OR COALESCE(s.turma,'') ILIKE ${q} OR COALESCE(s.instrutor,'') ILIKE ${q}
    GROUP BY s.id ORDER BY s.criado_em DESC LIMIT 100`;
}

export async function obterSequencia(id) {
  if (!sql) return null;
  const [s] = await sql`SELECT * FROM sequencias WHERE id = ${id}`;
  if (!s) return null;
  const entregas = await sql`SELECT etapa, conteudo FROM entregas WHERE sequencia_id = ${id}`;
  s.resultados = Object.fromEntries(entregas.map((e) => [e.etapa, e.conteudo]));
  return s;
}

export async function excluirSequencia(id) {
  if (!sql) return;
  await sql`DELETE FROM sequencias WHERE id = ${id}`;
}
