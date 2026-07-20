const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const config = require("./config");

fs.mkdirSync(config.dirDados, { recursive: true });
fs.mkdirSync(config.dirUploads, { recursive: true });

const db = new Database(path.join(config.dirDados, "portal.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));

/* ---------- carga inicial (seed) ---------- */

const temVeiculos = db.prepare("SELECT COUNT(*) AS n FROM veiculos").get().n > 0;
if (!temVeiculos) {
  const ins = db.prepare("INSERT INTO veiculos (prefixo, placa) VALUES (?, ?)");
  [
    ["98000", "ABC1D23"],
    ["98001", "DEF4G56"],
    ["98002", "GHI7J89"],
    ["8899", "JKL0M12"],
    ["8898", "NOP3Q45"]
  ].forEach((v) => ins.run(...v));
}

const temContatos = db.prepare("SELECT COUNT(*) AS n FROM contatos").get().n > 0;
if (!temContatos) {
  const ins = db.prepare(
    "INSERT INTO contatos (setor, regiao, telefone, horario) VALUES (?, ?, ?, ?)"
  );
  [
    ["escalas", "Matriz", "(44) 3218-8000", "06h às 22h, todos os dias"],
    ["escalas", "Maringá", "(44) 3218-8100", "06h às 22h, todos os dias"],
    ["escalas", "São Paulo", "(11) 4002-8200", "06h às 22h, todos os dias"],
    ["escalas", "Curitiba", "(41) 3333-8300", "06h às 22h, todos os dias"],
    ["escalas", "Florianópolis", "(48) 3222-8400", "06h às 22h, todos os dias"],
    ["dp", null, "(44) 3218-8050", "08h às 18h, segunda a sexta"],
    ["sam", null, "(44) 3218-8900", "24h"]
  ].forEach((c) => ins.run(...c));
}

module.exports = db;
