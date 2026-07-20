# Modelo de Dados — Portal do Motorista (Grupo GBS)

Banco: **SQLite** (arquivo `dados/portal.sqlite`), esquema portável para PostgreSQL.
DDL completo em [`server/schema.sql`](../server/schema.sql). Versão PlantUML em [`der.puml`](der.puml).

## Diagrama (Mermaid)

```mermaid
erDiagram
    usuarios ||--o{ sessoes : "abre"
    usuarios ||--o{ conversas : "inicia"
    usuarios ||--o{ ordens_servico : "solicita"
    usuarios ||--o{ auditoria : "gera eventos"
    conversas ||--o{ mensagens : "contem"
    conversas ||--o| ordens_servico : "origina"
    mensagens ||--o| fotos : "anexa"
    ordens_servico |o--o{ fotos : "evidencia"
    veiculos |o--o{ ordens_servico : "objeto da"

    usuarios {
        INTEGER id PK
        TEXT matricula UK
        TEXT nome
        TEXT papel "motorista | admin"
        INTEGER ativo "0/1"
        TEXT criado_em
        TEXT ultimo_login_em
    }
    sessoes {
        INTEGER id PK
        INTEGER usuario_id FK
        TEXT token_hash UK "SHA-256 do JWT"
        TEXT ip
        TEXT user_agent
        TEXT criada_em
        TEXT expira_em
        TEXT revogada_em "NULL = ativa"
    }
    veiculos {
        INTEGER id PK
        TEXT prefixo UK
        TEXT placa UK
        INTEGER ativo "0/1"
    }
    contatos {
        INTEGER id PK
        TEXT setor "escalas | dp | sam"
        TEXT regiao "NULL sem regional"
        TEXT telefone
        TEXT horario
        INTEGER ativo "0/1"
    }
    conversas {
        INTEGER id PK
        INTEGER usuario_id FK
        TEXT fluxo "arquivo em server/flows"
        TEXT etapa_atual
        TEXT estado "JSON"
        TEXT status "ativa | concluida | cancelada"
        TEXT iniciada_em
        TEXT finalizada_em
    }
    mensagens {
        INTEGER id PK
        INTEGER conversa_id FK
        TEXT autor "bot | usuario"
        TEXT tipo "texto | opcao | foto | sistema"
        TEXT conteudo
        TEXT etapa
        TEXT criada_em
    }
    fotos {
        INTEGER id PK
        INTEGER mensagem_id FK
        INTEGER os_id FK "NULL"
        TEXT caminho
        TEXT nome_original
        TEXT mime
        INTEGER tamanho_bytes
        TEXT sha256 "integridade do arquivo"
        TEXT enviada_em
    }
    ordens_servico {
        INTEGER id PK
        INTEGER numero UK "sequencial visivel"
        INTEGER conversa_id FK
        INTEGER usuario_id FK
        INTEGER veiculo_id FK "NULL"
        INTEGER km
        TEXT tipo_defeito
        TEXT descricao
        TEXT observacao
        TEXT criada_em
    }
    auditoria {
        INTEGER id PK
        INTEGER usuario_id FK "NULL em falha de login"
        TEXT acao
        TEXT entidade
        INTEGER entidade_id
        TEXT detalhes "JSON"
        TEXT ip
        TEXT user_agent
        TEXT hash_anterior "GENESIS no 1o"
        TEXT hash UK "SHA-256 encadeado"
        TEXT criada_em
    }
```

## Tabelas

| Tabela | Papel | Observações |
|---|---|---|
| `usuarios` | Identidade local dos usuários | Provisionado no 1º login validado no endpoint externo; senha **não** é armazenada aqui |
| `sessoes` | Sessões JWT emitidas | Guarda o SHA-256 do token (nunca o token); permite revogação no logout |
| `veiculos` | Frota | Valida prefixo/placa na abertura de OS |
| `contatos` | Telefones exibidos no fluxo Contatos | Setores: `escalas` (com regional), `dp`, `sam` |
| `conversas` | Uma linha por fluxo iniciado no chat | `estado` acumula as respostas em JSON; `fluxo` referencia o arquivo `server/flows/<Nome>.js` |
| `mensagens` | **Histórico integral do chat** | Append-only (triggers bloqueiam UPDATE/DELETE); toda bolha, do bot ou do usuário, vira uma linha |
| `fotos` | Fotos anexadas | Arquivo em disco + `sha256` para prova de integridade; vincula à mensagem e, quando houver, à OS |
| `ordens_servico` | OS geradas pelo fluxo Abrir OS | `numero` sequencial visível ao motorista |
| `auditoria` | **Trilha de auditoria** | Append-only com hash encadeado (cada linha inclui o hash da anterior — estilo blockchain); adulteração quebra a cadeia, verificável em `GET /api/admin/auditoria/verificar` |

## Ações registradas na auditoria

`LOGIN_SUCESSO` · `LOGIN_FALHA` · `LOGOUT` · `CONVERSA_INICIADA` · `ETAPA_AVANCOU` · `ETAPA_VOLTOU` · `ENTRADA_REJEITADA` · `CONVERSA_CONCLUIDA` · `CONVERSA_CANCELADA` · `FOTO_ENVIADA` · `OS_CRIADA` · `PANE_ENCAMINHADA_SAM`

Cada registro carrega: usuário, ação, entidade afetada, detalhes em JSON, IP, user-agent, timestamp e o hash encadeado.

## Relacionamentos (resumo)

- `usuarios 1—N sessoes` · `usuarios 1—N conversas` · `usuarios 1—N ordens_servico` · `usuarios 1—N auditoria`
- `conversas 1—N mensagens` (histórico) · `conversas 1—0..1 ordens_servico`
- `mensagens 1—0..1 fotos` · `ordens_servico 0..1—N fotos`
- `veiculos 0..1—N ordens_servico`
- Itens de menu (fluxos) **não são tabela**: são arquivos versionados em `server/flows/`, referenciados por `conversas.fluxo`.
