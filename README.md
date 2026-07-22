# Portal do Motorista — Grupo GBS

Portal de autoatendimento para ~900 motoristas: PWA mobile-first (instalável, funciona também no desktop) com atendimento por chat, agora com **backend real** — histórico integral de mensagens em banco, fotos persistidas com hash de integridade e trilha de auditoria imutável.

## Arquitetura

```
server/                    Backend Node.js + Express + SQLite
  index.js                 Rotas HTTP (auth, fluxos, conversas, fotos, admin)
  config.js                Configuração (env vars)
  db.js                    Conexão + seed inicial (frota, contatos)
  schema.sql               DDL do banco (documentado em docs/DER.md)
  auth.js                  Login via endpoint externo + JWT + sessões revogáveis
  authExternoMock.js       Simulador do endpoint externo (dev)
  audit.js                 Trilha de auditoria com hash encadeado
  flowLoader.js            Carrega os fluxos da pasta flows/
  chatEngine.js            Motor de conversa (roda no servidor)
  flows/                   ⭐ UM ARQUIVO POR ITEM DO MENU
    Abrir OS.js
    Pane.js
    Contatos.js
public/                    Front-end PWA (cliente da API)
docs/
  DER.md                   Modelo de dados (Mermaid) + dicionário de tabelas
  der.puml                 DER em PlantUML
```

### Como adicionar um item novo no menu

Crie um arquivo em `server/flows/` com o nome do item (ex.: `Troca de Turno.js`) exportando `{ descricao, icone, cor, ordem, inicio, etapas }` — use `Pane.js` como modelo. Reinicie o servidor: o card aparece na Home automaticamente, com todo o histórico e auditoria já funcionando. Nenhum outro arquivo precisa ser alterado.

## Imagens do Sr. Assis e logo (envio manual)

O visual usa arquivos em `public/assets/`. Enquanto eles não existirem, o app mostra placeholders ilustrados automaticamente — basta subir os arquivos com estes nomes exatos (minúsculos):

```
public/assets/logo.png              Logo da empresa (fundo transparente, aparece no topo do hero e no login)
public/assets/assis/padrao.png      Sr. Assis pose padrão (hero da Home e avatar do banner)
public/assets/assis/fala.png        Sr. Assis falando (expressão padrão no diálogo)
public/assets/assis/duvida.png      Sr. Assis com dúvida (perguntas e entradas rejeitadas)
public/assets/assis/triste.png      Sr. Assis triste (cancelamento de atendimento)
```

Recomendação: PNG com fundo transparente, personagem enquadrado da cintura para cima, ~800px de altura. A expressão de cada etapa é definida no arquivo do fluxo pelo campo `expressao` (`padrao`, `fala`, `duvida` ou `triste`; padrão das etapas é `fala`, erros usam `duvida`, cancelamento `triste`, conclusões `padrao`).

## Como rodar

```bash
npm install
npm start          # http://localhost:3000
```

### Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3000` | Porta HTTP |
| `EXTERNAL_AUTH_URL` | *(vazio)* | Endpoint externo de validação de login. Contrato: `POST {matricula, senha}` → `200 {valido: true, nome}`. Sem ela, usa o simulador embutido |
| `JWT_SECRET` | aleatório por boot | **Defina em produção** (senão as sessões caem a cada restart) |
| `JWT_EXPIRES` | `12h` | Validade do token |
| `DATA_DIR` | `./dados` | Pasta do banco SQLite |
| `UPLOAD_DIR` | `./uploads` | Pasta das fotos |

### Acessos de teste (simulador de autenticação)

| Matrícula | Senha | Papel |
|---|---|---|
| `admin` | `adminGbs` | admin (sempre disponível, mesmo com endpoint externo) |
| `12345` | `1234` | motorista (João da Silva) |
| `67890` | `1234` | motorista (Maria Oliveira) |
| `11111` | `1111` | motorista (Carlos Souza) |

Veículos válidos: prefixos `98000`, `98001`, `98002`, `8899`, `8898` (ou as placas correspondentes) — tabela `veiculos`.

## API

| Método/Rota | Descrição |
|---|---|
| `POST /api/auth/login` | Valida no endpoint externo, emite JWT |
| `POST /api/auth/logout` | Revoga a sessão |
| `GET /api/auth/eu` | Dados do usuário logado |
| `GET /api/fluxos` | Itens do menu (gerados de `server/flows/`) |
| `POST /api/conversas` | Inicia uma conversa `{fluxo}` |
| `POST /api/conversas/:id/mensagens` | Envia entrada `{tipo: texto\|opcao, valor}` |
| `POST /api/conversas/:id/fotos` | Upload de foto (multipart, campo `foto`, máx. 8 MB) |
| `GET /api/fotos/:id` | Baixa foto (dono ou admin) |
| `GET /api/conversas` | Histórico do próprio usuário |
| `GET /api/admin/os` | (admin) Todas as OS |
| `GET /api/admin/conversas/:id/mensagens` | (admin) Histórico de qualquer conversa |
| `GET /api/admin/auditoria` | (admin) Trilha de auditoria |
| `GET /api/admin/auditoria/verificar` | (admin) Verifica a integridade da cadeia de hashes |

## Auditabilidade

- **Toda mensagem** (bot e usuário) é gravada em `mensagens`, tabela **append-only** (triggers bloqueiam UPDATE/DELETE).
- **Todo evento relevante** (login, falha de login, cada avanço/retorno de etapa, entrada rejeitada, foto, OS criada, cancelamento) vira um registro em `auditoria` com usuário, IP, user-agent e timestamp.
- A auditoria usa **hash encadeado** (cada linha inclui o SHA-256 da anterior): qualquer adulteração quebra a cadeia e é detectada por `GET /api/admin/auditoria/verificar`.
- Fotos são armazenadas com **SHA-256 do arquivo**, provando que não foram trocadas.
- Sessões são registradas e revogáveis; o token nunca é armazenado, apenas seu hash.

## Modelo de dados

Ver [docs/DER.md](docs/DER.md) (diagrama + dicionário completo) e [docs/der.puml](docs/der.puml) (PlantUML).

## Hospedagem

Qualquer servidor com Node.js ≥ 18 (VPS com PM2/systemd atrás de Nginx com HTTPS, Docker, Render, Railway, Fly.io). O SQLite roda no próprio servidor (arquivo em `DATA_DIR`); para volume alto ou múltiplas instâncias, o esquema é portável para PostgreSQL. HTTPS é obrigatório em produção (PWA/câmera exigem contexto seguro).
