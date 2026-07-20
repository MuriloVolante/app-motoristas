const path = require("path");
const crypto = require("crypto");

module.exports = {
  porta: process.env.PORT || 3000,

  // Endpoint externo de validação de credenciais.
  // Contrato esperado: POST { matricula, senha } -> 200 { valido: true, nome: "..." }
  // Se não configurado, usa o simulador embutido (server/authExternoMock.js).
  authExternaUrl: process.env.EXTERNAL_AUTH_URL || null,

  // Usuário administrativo fixo (requisito do cliente)
  admin: { matricula: "admin", senha: "adminGbs", nome: "Administrador" },

  jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex"),
  jwtExpiraEm: process.env.JWT_EXPIRES || "12h",

  dirDados: process.env.DATA_DIR || path.join(__dirname, "..", "dados"),
  dirUploads: process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads"),
  dirPublico: path.join(__dirname, "..", "public"),
  dirFluxos: path.join(__dirname, "flows"),

  uploadMaxBytes: 8 * 1024 * 1024 // 8 MB por foto
};
