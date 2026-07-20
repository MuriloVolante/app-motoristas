const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("./db");
const config = require("./config");
const audit = require("./audit");
const authExternoMock = require("./authExternoMock");

/* Valida credenciais no endpoint externo (ou no simulador embutido).
   Contrato do endpoint: POST { matricula, senha } -> 200 { valido: true, nome } */
async function validarCredenciais(matricula, senha) {
  // Usuário administrativo fixo (requisito)
  if (matricula === config.admin.matricula) {
    return senha === config.admin.senha
      ? { valido: true, nome: config.admin.nome, papel: "admin" }
      : { valido: false };
  }

  if (!config.authExternaUrl) {
    const r = await authExternoMock.validar(matricula, senha);
    return r.valido ? { ...r, papel: "motorista" } : { valido: false };
  }

  const resp = await fetch(config.authExternaUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ matricula, senha }),
    signal: AbortSignal.timeout(8000)
  });
  if (!resp.ok) return { valido: false };
  const dados = await resp.json();
  return dados.valido
    ? { valido: true, nome: dados.nome || `Motorista ${matricula}`, papel: "motorista" }
    : { valido: false };
}

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

async function login(matricula, senha, req) {
  const resultado = await validarCredenciais(matricula, senha);

  if (!resultado.valido) {
    audit.registrar({ acao: "LOGIN_FALHA", detalhes: { matricula }, req });
    return null;
  }

  // Provisiona/atualiza o usuário local no primeiro login validado
  db.prepare(`
    INSERT INTO usuarios (matricula, nome, papel, ultimo_login_em)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(matricula) DO UPDATE SET
      nome = excluded.nome,
      ultimo_login_em = datetime('now')
  `).run(matricula, resultado.nome, resultado.papel);

  const usuario = db.prepare("SELECT * FROM usuarios WHERE matricula = ?").get(matricula);

  const token = jwt.sign(
    { sub: usuario.id, matricula: usuario.matricula, nome: usuario.nome, papel: usuario.papel },
    config.jwtSecret,
    { expiresIn: config.jwtExpiraEm }
  );

  const decodificado = jwt.decode(token);
  db.prepare(`
    INSERT INTO sessoes (usuario_id, token_hash, ip, user_agent, expira_em)
    VALUES (?, ?, ?, ?, ?)
  `).run(usuario.id, sha256(token), req.ip, req.get("user-agent") || null,
         new Date(decodificado.exp * 1000).toISOString());

  audit.registrar({ usuarioId: usuario.id, acao: "LOGIN_SUCESSO", entidade: "usuarios", entidadeId: usuario.id, req });

  return { token, usuario: { matricula: usuario.matricula, nome: usuario.nome, papel: usuario.papel } };
}

function logout(token, usuarioId, req) {
  db.prepare("UPDATE sessoes SET revogada_em = datetime('now') WHERE token_hash = ?").run(sha256(token));
  audit.registrar({ usuarioId, acao: "LOGOUT", req });
}

/* Middleware: exige JWT válido com sessão ativa (não revogada, não expirada) */
function exigirAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ erro: "Não autenticado." });

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ erro: "Sessão inválida ou expirada." });
  }

  const sessao = db.prepare(
    "SELECT * FROM sessoes WHERE token_hash = ? AND revogada_em IS NULL AND expira_em > datetime('now')"
  ).get(sha256(token));
  if (!sessao) return res.status(401).json({ erro: "Sessão revogada ou expirada." });

  req.usuario = { id: payload.sub, matricula: payload.matricula, nome: payload.nome, papel: payload.papel };
  req.token = token;
  next();
}

function exigirAdmin(req, res, next) {
  if (req.usuario.papel !== "admin") return res.status(403).json({ erro: "Acesso restrito ao administrador." });
  next();
}

module.exports = { login, logout, exigirAuth, exigirAdmin };
