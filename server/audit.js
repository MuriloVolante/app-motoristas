/* Trilha de auditoria append-only com hash encadeado.
   Cada registro carrega o hash do anterior; alterar qualquer linha
   quebra a cadeia inteira, o que torna adulteração detectável. */

const crypto = require("crypto");
const db = require("./db");

const ultimoHash = db.prepare("SELECT hash FROM auditoria ORDER BY id DESC LIMIT 1");
const inserir = db.prepare(`
  INSERT INTO auditoria (usuario_id, acao, entidade, entidade_id, detalhes,
                         ip, user_agent, hash_anterior, hash, criada_em)
  VALUES (@usuario_id, @acao, @entidade, @entidade_id, @detalhes,
          @ip, @user_agent, @hash_anterior, @hash, @criada_em)
`);

function registrar({ usuarioId = null, acao, entidade = null, entidadeId = null, detalhes = null, req = null }) {
  const anterior = ultimoHash.get();
  const hashAnterior = anterior ? anterior.hash : "GENESIS";
  const criadaEm = new Date().toISOString();
  const detalhesJson = detalhes ? JSON.stringify(detalhes) : null;

  const hash = crypto
    .createHash("sha256")
    .update([hashAnterior, acao, entidade || "", entidadeId || "", detalhesJson || "", criadaEm].join("|"))
    .digest("hex");

  inserir.run({
    usuario_id: usuarioId,
    acao,
    entidade,
    entidade_id: entidadeId,
    detalhes: detalhesJson,
    ip: req ? req.ip : null,
    user_agent: req ? req.get("user-agent") : null,
    hash_anterior: hashAnterior,
    hash,
    criada_em: criadaEm
  });
}

/* Verifica a integridade da cadeia inteira. Retorna { integra, total, quebraEm } */
function verificarCadeia() {
  const linhas = db.prepare("SELECT * FROM auditoria ORDER BY id").all();
  let hashAnterior = "GENESIS";
  for (const l of linhas) {
    const esperado = crypto
      .createHash("sha256")
      .update([hashAnterior, l.acao, l.entidade || "", l.entidade_id || "", l.detalhes || "", l.criada_em].join("|"))
      .digest("hex");
    if (l.hash_anterior !== hashAnterior || l.hash !== esperado) {
      return { integra: false, total: linhas.length, quebraEm: l.id };
    }
    hashAnterior = l.hash;
  }
  return { integra: true, total: linhas.length, quebraEm: null };
}

module.exports = { registrar, verificarCadeia };
