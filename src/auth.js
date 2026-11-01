// Contas e sessões: senha com scrypt, sessão em cookie assinado (HMAC). Sem dependências externas.
import crypto from "node:crypto";
import { sql } from "./db.js";

const SEGREDO = process.env.SESSION_SECRET || "dev-somente-local-troque-em-producao";
const DURACAO_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
const COOKIE = "gd_sessao";

function hashSenha(senha) {
  const sal = crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(senha, sal, 64).toString("hex");
  return `${sal}:${h}`;
}
function confereSenha(senha, guardado) {
  const [sal, h] = String(guardado).split(":");
  if (!sal || !h) return false;
  const teste = crypto.scryptSync(senha, sal, 64);
  return crypto.timingSafeEqual(teste, Buffer.from(h, "hex"));
}

const assinar = (txt) => crypto.createHmac("sha256", SEGREDO).update(txt).digest("base64url");
function criarToken(id, versao = 0) {
  const corpo = `${id}.${versao}.${Date.now() + DURACAO_MS}`;
  return `${corpo}.${assinar(corpo)}`;
}
// Devolve { id, versao }. Tokens antigos (sem versão) contam como versão 0.
function lerToken(token) {
  const partes = String(token || "").split(".");
  if (partes.length === 3) partes.splice(1, 0, null);
  const [id, ver, exp, sig] = partes;
  if (!id || !exp || !sig) return null;
  const esperado = assinar(ver === null ? `${id}.${exp}` : `${id}.${ver}.${exp}`);
  if (sig.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado))) return null;
  if (Number(exp) < Date.now()) return null;
  return { id: Number(id), versao: Number(ver || 0) };
}
// Senha provisória legível (sem 0/O, 1/l).
export function senhaProvisoria() {
  const a = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.randomBytes(10), (b) => a[b % a.length]).join("");
}

function lerCookie(req, nome) {
  const m = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(`${nome}=`));
  return m ? decodeURIComponent(m.slice(nome.length + 1)) : null;
}
function gravarSessao(res, id, versao = 0) {
  const seguro = process.env.VERCEL ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE}=${criarToken(id, versao)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DURACAO_MS / 1000}${seguro}`);
}
function limparSessao(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

const publico = (u) => u && { id: Number(u.id), nome: u.nome, email: u.email, papel: u.papel, aprovado: u.aprovado, tour: Boolean(u.tour_visto) };
export const ehGestor = (u) => u && (u.papel === "admin" || u.papel === "coordenador");

// Carrega o usuário da sessão em req.usuario (ou null).
export async function carregarUsuario(req, _res, next) {
  req.usuario = null;
  const t = lerToken(lerCookie(req, COOKIE));
  if (t && sql) {
    try {
      const [u] = await sql`SELECT id, nome, email, papel, aprovado, nova_senha, sessao_versao, tour_visto FROM usuarios WHERE id = ${t.id}`;
      // Senha revogada pelo administrador (versão mudou) ou ainda provisória: sessão não vale.
      if (u && Number(u.sessao_versao) === t.versao && !u.nova_senha) req.usuario = publico(u);
    } catch (e) { console.error("sessão:", e.message); }
  }
  next();
}

export function exigeLogin(req, res, next) {
  if (!req.usuario) return res.status(401).json({ erro: "Entre na sua conta para continuar.", login: true });
  if (!req.usuario.aprovado) return res.status(403).json({ erro: "Sua conta ainda não foi liberada pelo administrador.", pendente: true });
  next();
}
export function exigeGestor(req, res, next) {
  if (!ehGestor(req.usuario)) return res.status(403).json({ erro: "Apenas coordenação e administração têm acesso a esta área." });
  next();
}
export function exigeAdmin(req, res, next) {
  if (req.usuario?.papel !== "admin") return res.status(403).json({ erro: "Apenas o administrador pode fazer isso." });
  next();
}

const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ""));

export function rotasAuth(app) {
  app.post("/api/auth/cadastro", async (req, res) => {
    try {
      const nome = String(req.body.nome || "").trim();
      const email = String(req.body.email || "").trim().toLowerCase();
      const senha = String(req.body.senha || "");
      if (!nome || !emailValido(email)) return res.status(400).json({ erro: "Informe seu nome e um e-mail válido." });
      if (senha.length < 8) return res.status(400).json({ erro: "A senha precisa ter pelo menos 8 caracteres." });
      const [{ total }] = await sql`SELECT count(*)::int AS total FROM usuarios`;
      // Só o primeiro cadastro é livre (vira o administrador). Os demais são criados pelo administrador.
      const primeiro = total === 0;
      if (!primeiro) return res.status(403).json({ erro: "O cadastro é feito pelo administrador. Envie seu e-mail para ele e você recebe uma senha provisória." });
      const [u] = await sql`
        INSERT INTO usuarios (nome, email, senha_hash, papel, aprovado)
        VALUES (${nome}, ${email}, ${hashSenha(senha)}, ${primeiro ? "admin" : "instrutor"}, ${primeiro})
        ON CONFLICT (email) DO NOTHING RETURNING id, nome, email, papel, aprovado`;
      if (!u) return res.status(409).json({ erro: "Já existe uma conta com este e-mail. Entre com sua senha." });
      gravarSessao(res, u.id);
      res.json({ usuario: publico(u) });
    } catch (e) { console.error(e); res.status(500).json({ erro: e.message }); }
  });

  app.post("/api/auth/entrar", async (req, res) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
      const [u] = await sql`SELECT * FROM usuarios WHERE email = ${email}`;
      if (!u || !confereSenha(String(req.body.senha || ""), u.senha_hash)) {
        return res.status(401).json({ erro: "E-mail ou senha incorretos." });
      }
      // Entrou com a senha provisória: precisa criar a própria senha antes de usar.
      if (u.nova_senha) return res.json({ novaSenha: true });
      gravarSessao(res, u.id, Number(u.sessao_versao));
      res.json({ usuario: publico(u) });
    } catch (e) { console.error(e); res.status(500).json({ erro: e.message }); }
  });

  // Troca a senha provisória pela senha da pessoa (exige a provisória correta).
  app.post("/api/auth/nova-senha", async (req, res) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
      const senha = String(req.body.senha || "");
      if (senha.length < 8) return res.status(400).json({ erro: "A senha precisa ter pelo menos 8 caracteres." });
      const [atual] = await sql`SELECT * FROM usuarios WHERE email = ${email}`;
      if (!atual || !atual.nova_senha || !confereSenha(String(req.body.provisoria || ""), atual.senha_hash))
        return res.status(403).json({ erro: "Senha provisória inválida. Peça uma nova ao administrador." });
      if (senha === req.body.provisoria) return res.status(400).json({ erro: "Escolha uma senha diferente da provisória." });
      const [u] = await sql`UPDATE usuarios SET senha_hash = ${hashSenha(senha)}, nova_senha = false
        WHERE id = ${atual.id} RETURNING id, nome, email, papel, aprovado, sessao_versao`;
      gravarSessao(res, u.id, Number(u.sessao_versao));
      res.json({ usuario: publico(u) });
    } catch (e) { console.error(e); res.status(500).json({ erro: e.message }); }
  });

  // Marca o tour de primeiro acesso como visto.
  app.post("/api/auth/tour", exigeLogin, async (req, res) => {
    await sql`UPDATE usuarios SET tour_visto = true WHERE id = ${req.usuario.id}`;
    res.json({ ok: true });
  });

  app.post("/api/auth/sair", (_req, res) => { limparSessao(res); res.json({ ok: true }); });

  app.get("/api/auth/eu", (req, res) => {
    if (!req.usuario) return res.status(401).json({ erro: "Sem sessão", login: true });
    res.json({ usuario: req.usuario });
  });

  // ---------- Administração de contas ----------
  app.get("/api/admin/usuarios", exigeLogin, exigeAdmin, async (_req, res) => {
    const itens = await sql`SELECT id, nome, email, papel, aprovado, nova_senha, criado_em FROM usuarios ORDER BY aprovado, criado_em DESC`;
    res.json({ itens });
  });
  // Cadastra uma pessoa e devolve a senha provisória (mostrada só uma vez ao administrador).
  app.post("/api/admin/usuarios", exigeLogin, exigeAdmin, async (req, res) => {
    try {
      const nome = String(req.body.nome || "").trim();
      const email = String(req.body.email || "").trim().toLowerCase();
      const papel = ["admin", "coordenador", "instrutor"].includes(req.body.papel) ? req.body.papel : "instrutor";
      if (!nome || !emailValido(email)) return res.status(400).json({ erro: "Informe o nome e um e-mail válido." });
      const senha = senhaProvisoria();
      const [u] = await sql`
        INSERT INTO usuarios (nome, email, senha_hash, papel, aprovado, nova_senha)
        VALUES (${nome}, ${email}, ${hashSenha(senha)}, ${papel}, true, true)
        ON CONFLICT (email) DO NOTHING RETURNING id, nome, email, papel, aprovado`;
      if (!u) return res.status(409).json({ erro: "Já existe uma conta com este e-mail. Use \"Nova senha provisória\" na lista." });
      res.json({ usuario: publico(u), senha });
    } catch (e) { console.error(e); res.status(500).json({ erro: e.message }); }
  });
  // Revoga a senha atual (e as sessões abertas) e gera uma nova provisória.
  app.post("/api/admin/usuarios/:id/senha", exigeLogin, exigeAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.usuario.id) return res.status(400).json({ erro: "Para a sua própria conta, use outra conta de administrador." });
    const senha = senhaProvisoria();
    const [u] = await sql`UPDATE usuarios SET senha_hash = ${hashSenha(senha)}, nova_senha = true, aprovado = true,
      sessao_versao = sessao_versao + 1 WHERE id = ${id} RETURNING id, nome, email`;
    u ? res.json({ usuario: u, senha }) : res.status(404).json({ erro: "Conta não encontrada." });
  });
  app.patch("/api/admin/usuarios/:id", exigeLogin, exigeAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.usuario.id) return res.status(400).json({ erro: "Você não pode alterar a sua própria conta por aqui." });
    const { aprovado, papel, novaSenha } = req.body;
    if (papel && !["admin", "coordenador", "instrutor"].includes(papel)) return res.status(400).json({ erro: "Papel inválido." });
    const [u] = await sql`
      UPDATE usuarios SET
        aprovado = COALESCE(${typeof aprovado === "boolean" ? aprovado : null}::boolean, aprovado),
        sessao_versao = sessao_versao + ${aprovado === false ? 1 : 0},
        papel = COALESCE(${papel || null}, papel),
        nova_senha = COALESCE(${typeof novaSenha === "boolean" ? novaSenha : null}::boolean, nova_senha)
      WHERE id = ${id} RETURNING id, nome, email, papel, aprovado`;
    u ? res.json({ usuario: publico(u) }) : res.status(404).json({ erro: "Conta não encontrada." });
  });
  app.delete("/api/admin/usuarios/:id", exigeLogin, exigeAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.usuario.id) return res.status(400).json({ erro: "Você não pode excluir a sua própria conta." });
    await sql`DELETE FROM usuarios WHERE id = ${id}`;
    res.json({ ok: true });
  });
}
