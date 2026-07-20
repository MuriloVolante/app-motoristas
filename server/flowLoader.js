/* Carrega os fluxos de conversa da pasta server/flows.
   Cada arquivo .js é um item do menu — o nome do arquivo é o nome do item
   (ex.: "Abrir OS.js", "Pane.js", "Contatos.js").
   Para criar um item novo, basta criar um arquivo novo na pasta. */

const fs = require("fs");
const path = require("path");
const config = require("./config");

const fluxos = new Map();

for (const arquivo of fs.readdirSync(config.dirFluxos)) {
  if (!arquivo.endsWith(".js")) continue;
  const definicao = require(path.join(config.dirFluxos, arquivo));

  const nome = path.basename(arquivo, ".js");
  definicao.titulo = definicao.titulo || nome;
  definicao.id = definicao.id || nome.toLowerCase().replace(/\s+/g, "-");

  if (!definicao.inicio || !definicao.etapas) {
    throw new Error(`Fluxo inválido em server/flows/${arquivo}: defina "inicio" e "etapas".`);
  }
  fluxos.set(definicao.id, definicao);
}

function listar() {
  return [...fluxos.values()]
    .sort((a, b) => (a.ordem || 99) - (b.ordem || 99))
    .map((f) => ({
      id: f.id,
      titulo: f.titulo,
      descricao: f.descricao || "",
      icone: f.icone || "chevron-right",
      cor: f.cor || "azul"
    }));
}

function obter(id) {
  return fluxos.get(id) || null;
}

module.exports = { listar, obter };
