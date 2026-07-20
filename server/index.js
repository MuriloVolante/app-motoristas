const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");

const config = require("./config");
const db = require("./db");
const audit = require("./audit");
const auth = require("./auth");
const flowLoader = require("./flowLoader");
const chatEngine = require("./chatEngine");

const app = express();
app.use(express.json());
app.disable("x-powered-by");

/* ============ AUTENTICAÇÃO ============ */

app.post("/api/auth/login", async (req, res) => {
  const { matricula, senha } = req.body || {};
  if (!matricula || !senha) return res.status(400).json({ erro: "Informe matrícula e senha." });

  try {
    const resultado = await auth.login(String(matricula).trim(), String(senha), req);
    if (!resultado) return res.status(401).json({ erro: "Matrícula ou senha inválida." });
    res.json(resultado);
  } catch (e) {
    console.error("Falha na validação externa:", e.message);
    res.status(502).json({ erro: "Serviço de autenticação indisponível. Tente novamente." });
  }
});

app.post("/api/auth/logout", auth.exigirAuth, (req, res) => {
  auth.logout(req.token, req.usuario.id, req);
  res.json({ ok: true });
});

app.get("/api/auth/eu", auth.exigirAuth, (req, res) => {
  res.json({ matricula: req.usuario.matricula, nome: req.usuario.nome, papel: req.usuario.papel });
});

/* ============ FLUXOS (itens do menu) ============ */

app.get("/api/fluxos", auth.exigirAuth, (req, res) => {
  res.json(flowLoader.listar());
});

/* ============ CONVERSAS ============ */

app.post("/api/conversas", auth.exigirAuth, (req, res) => {
  const saida = chatEngine.iniciarConversa(req.body?.fluxo, req.usuario);
  if (!saida) return res.status(404).json({ erro: "Fluxo não encontrado." });
  res.json(saida);
});

app.post("/api/conversas/:id/mensagens", auth.exigirAuth, (req, res) => {
  const conversa = chatEngine.carregarConversa(req.params.id, req.usuario);
  if (!conversa) return res.status(404).json({ erro: "Conversa não encontrada ou já finalizada." });

  const { tipo, valor } = req.body || {};
  if (!["texto", "opcao"].includes(tipo)) return res.status(400).json({ erro: "Tipo de entrada inválido." });
  if (typeof valor !== "string" || valor.length > 2000) {
    return res.status(400).json({ erro: "Conteúdo inválido." });
  }

  res.json(chatEngine.processarEntrada(conversa, { tipo, valor }, req.usuario));
});

/* Upload de foto dentro de uma conversa */
const upload = multer({
  storage: multer.diskStorage({
    destination: config.dirUploads,
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || ".jpg").toLowerCase().slice(0, 8);
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
    }
  }),
  limits: { fileSize: config.uploadMaxBytes },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith("image/"))
});

app.post("/api/conversas/:id/fotos", auth.exigirAuth, upload.single("foto"), (req, res) => {
  const conversa = chatEngine.carregarConversa(req.params.id, req.usuario);
  if (!conversa) return res.status(404).json({ erro: "Conversa não encontrada ou já finalizada." });
  if (!req.file) return res.status(400).json({ erro: "Envie uma imagem válida (até 8 MB)." });

  const sha256 = crypto.createHash("sha256").update(fs.readFileSync(req.file.path)).digest("hex");

  const mensagemId = db.prepare(
    "INSERT INTO mensagens (conversa_id, autor, tipo, conteudo, etapa) VALUES (?, 'usuario', 'foto', ?, ?)"
  ).run(conversa.id, req.file.filename, conversa.etapa_atual).lastInsertRowid;

  const fotoId = db.prepare(`
    INSERT INTO fotos (mensagem_id, caminho, nome_original, mime, tamanho_bytes, sha256)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(mensagemId, req.file.filename, req.file.originalname || null,
         req.file.mimetype, req.file.size, sha256).lastInsertRowid;

  audit.registrar({
    usuarioId: req.usuario.id, acao: "FOTO_ENVIADA",
    entidade: "fotos", entidadeId: fotoId,
    detalhes: { conversaId: conversa.id, sha256, tamanho: req.file.size }, req
  });

  const saida = chatEngine.processarEntrada(
    conversa, { tipo: "foto", valor: req.file.filename, mensagemId }, req.usuario
  );
  saida.fotoUrl = `/api/fotos/${fotoId}`;
  res.json(saida);
});

app.get("/api/fotos/:id", auth.exigirAuth, (req, res) => {
  const foto = db.prepare("SELECT * FROM fotos WHERE id = ?").get(req.params.id);
  if (!foto) return res.status(404).json({ erro: "Foto não encontrada." });

  // motorista só acessa as próprias fotos; admin acessa todas
  const dona = db.prepare(`
    SELECT c.usuario_id FROM fotos f
    JOIN mensagens m ON m.id = f.mensagem_id
    JOIN conversas c ON c.id = m.conversa_id
    WHERE f.id = ?
  `).get(req.params.id);
  if (req.usuario.papel !== "admin" && dona.usuario_id !== req.usuario.id) {
    return res.status(403).json({ erro: "Sem acesso a esta foto." });
  }
  res.type(foto.mime).sendFile(path.join(config.dirUploads, foto.caminho));
});

/* Histórico do próprio usuário */
app.get("/api/conversas", auth.exigirAuth, (req, res) => {
  res.json(db.prepare(`
    SELECT id, fluxo, status, iniciada_em, finalizada_em
    FROM conversas WHERE usuario_id = ? ORDER BY id DESC LIMIT 50
  `).all(req.usuario.id));
});

/* ============ ADMINISTRAÇÃO (papel admin) ============ */

app.get("/api/admin/os", auth.exigirAuth, auth.exigirAdmin, (req, res) => {
  res.json(db.prepare(`
    SELECT os.*, u.matricula, u.nome AS motorista, v.prefixo, v.placa
    FROM ordens_servico os
    JOIN usuarios u ON u.id = os.usuario_id
    LEFT JOIN veiculos v ON v.id = os.veiculo_id
    ORDER BY os.id DESC LIMIT 200
  `).all());
});

app.get("/api/admin/conversas/:id/mensagens", auth.exigirAuth, auth.exigirAdmin, (req, res) => {
  res.json(db.prepare("SELECT * FROM mensagens WHERE conversa_id = ? ORDER BY id").all(req.params.id));
});

app.get("/api/admin/auditoria", auth.exigirAuth, auth.exigirAdmin, (req, res) => {
  res.json(db.prepare("SELECT * FROM auditoria ORDER BY id DESC LIMIT 500").all());
});

app.get("/api/admin/auditoria/verificar", auth.exigirAuth, auth.exigirAdmin, (req, res) => {
  res.json(audit.verificarCadeia());
});

/* ============ FRONT (PWA estático) ============ */

app.use(express.static(config.dirPublico));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(config.dirPublico, "index.html"));
});

app.listen(config.porta, () => {
  console.log(`Portal do Motorista rodando em http://localhost:${config.porta}`);
  console.log(`Fluxos carregados: ${flowLoader.listar().map((f) => f.titulo).join(" · ")}`);
  if (!config.authExternaUrl) {
    console.log("EXTERNAL_AUTH_URL não definida — usando simulador de autenticação embutido.");
  }
});
