-- ==========================================================================
-- Portal do Motorista — Grupo GBS
-- Esquema do banco de dados (SQLite; portável para PostgreSQL)
-- Documentação completa: docs/DER.md
-- ==========================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Usuários autenticados (provisionados no primeiro login validado externamente)
CREATE TABLE IF NOT EXISTS usuarios (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  matricula       TEXT NOT NULL UNIQUE,
  nome            TEXT NOT NULL,
  papel           TEXT NOT NULL DEFAULT 'motorista'
                  CHECK (papel IN ('motorista', 'admin')),
  ativo           INTEGER NOT NULL DEFAULT 1,
  criado_em       TEXT NOT NULL DEFAULT (datetime('now')),
  ultimo_login_em TEXT
);

-- Sessões emitidas (JWT) — permite revogação e auditoria de acesso
CREATE TABLE IF NOT EXISTS sessoes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id),
  token_hash  TEXT NOT NULL UNIQUE,         -- SHA-256 do JWT (o token em si não é armazenado)
  ip          TEXT,
  user_agent  TEXT,
  criada_em   TEXT NOT NULL DEFAULT (datetime('now')),
  expira_em   TEXT NOT NULL,
  revogada_em TEXT
);

-- Frota (validação de prefixo/placa na abertura de OS)
CREATE TABLE IF NOT EXISTS veiculos (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  prefixo TEXT NOT NULL UNIQUE,
  placa   TEXT NOT NULL UNIQUE,
  ativo   INTEGER NOT NULL DEFAULT 1
);

-- Contatos exibidos pelo fluxo "Contatos"
CREATE TABLE IF NOT EXISTS contatos (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  setor    TEXT NOT NULL,                   -- 'escalas' | 'dp' | 'sam'
  regiao   TEXT,                            -- NULL para setores sem regional
  telefone TEXT NOT NULL,
  horario  TEXT,
  ativo    INTEGER NOT NULL DEFAULT 1
);

-- Conversas de chat (uma por fluxo iniciado)
CREATE TABLE IF NOT EXISTS conversas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id),
  fluxo         TEXT NOT NULL,              -- id do fluxo (arquivo em server/flows)
  etapa_atual   TEXT,
  estado        TEXT NOT NULL DEFAULT '{}', -- JSON com as respostas coletadas
  status        TEXT NOT NULL DEFAULT 'ativa'
                CHECK (status IN ('ativa', 'concluida', 'cancelada')),
  iniciada_em   TEXT NOT NULL DEFAULT (datetime('now')),
  finalizada_em TEXT
);

-- Histórico integral de mensagens (append-only, protegido por triggers)
CREATE TABLE IF NOT EXISTS mensagens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  conversa_id INTEGER NOT NULL REFERENCES conversas(id),
  autor       TEXT NOT NULL CHECK (autor IN ('bot', 'usuario')),
  tipo        TEXT NOT NULL DEFAULT 'texto'
              CHECK (tipo IN ('texto', 'opcao', 'foto', 'sistema')),
  conteudo    TEXT NOT NULL,
  etapa       TEXT,
  criada_em   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fotos enviadas (arquivo em disco + hash de integridade)
CREATE TABLE IF NOT EXISTS fotos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  mensagem_id   INTEGER NOT NULL REFERENCES mensagens(id),
  os_id         INTEGER REFERENCES ordens_servico(id),
  caminho       TEXT NOT NULL,
  nome_original TEXT,
  mime          TEXT NOT NULL,
  tamanho_bytes INTEGER NOT NULL,
  sha256        TEXT NOT NULL,
  enviada_em    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ordens de serviço geradas pelo fluxo "Abrir OS"
CREATE TABLE IF NOT EXISTS ordens_servico (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  numero       INTEGER NOT NULL UNIQUE,
  conversa_id  INTEGER NOT NULL REFERENCES conversas(id),
  usuario_id   INTEGER NOT NULL REFERENCES usuarios(id),
  veiculo_id   INTEGER REFERENCES veiculos(id),
  km           INTEGER NOT NULL,
  tipo_defeito TEXT NOT NULL,
  descricao    TEXT NOT NULL,
  observacao   TEXT,
  criada_em    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Trilha de auditoria append-only com hash encadeado (estilo blockchain):
-- hash = SHA-256(hash_anterior || acao || entidade || entidade_id || detalhes || criada_em)
CREATE TABLE IF NOT EXISTS auditoria (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id    INTEGER REFERENCES usuarios(id),  -- NULL em falha de login
  acao          TEXT NOT NULL,
  entidade      TEXT,
  entidade_id   INTEGER,
  detalhes      TEXT,                             -- JSON
  ip            TEXT,
  user_agent    TEXT,
  hash_anterior TEXT NOT NULL,
  hash          TEXT NOT NULL UNIQUE,
  criada_em     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Proteções de imutabilidade (append-only)
CREATE TRIGGER IF NOT EXISTS auditoria_sem_update
  BEFORE UPDATE ON auditoria
  BEGIN SELECT RAISE(ABORT, 'auditoria é append-only'); END;

CREATE TRIGGER IF NOT EXISTS auditoria_sem_delete
  BEFORE DELETE ON auditoria
  BEGIN SELECT RAISE(ABORT, 'auditoria é append-only'); END;

CREATE TRIGGER IF NOT EXISTS mensagens_sem_update
  BEFORE UPDATE ON mensagens
  BEGIN SELECT RAISE(ABORT, 'mensagens são append-only'); END;

CREATE TRIGGER IF NOT EXISTS mensagens_sem_delete
  BEFORE DELETE ON mensagens
  BEGIN SELECT RAISE(ABORT, 'mensagens são append-only'); END;

-- Índices de consulta
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_conversas_usuario  ON conversas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario  ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_os_usuario         ON ordens_servico(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_usuario    ON sessoes(usuario_id);
