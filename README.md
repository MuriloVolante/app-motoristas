# Portal do Motorista — Grupo GBS (MVP)

PWA de autoatendimento para motoristas: **mobile-first**, instalável, responsivo (funciona também no desktop), com interface visual de tipografia grande, alto contraste e navegação por toque. Todos os dados são **mockados localmente** (sem backend real) — protótipo navegável pronto para apresentação.

## Como rodar

É um site estático — basta servir a pasta por HTTP:

```bash
# opção 1
npx serve .

# opção 2
python3 -m http.server 8080
```

Abra `http://localhost:8080` no navegador (no celular, use o IP da máquina na mesma rede). Para instalar como app, use "Adicionar à tela inicial" no navegador.

> O service worker (offline/instalação) exige HTTPS ou `localhost`.

## Acesso de demonstração

| Matrícula | Senha | Nome |
|-----------|-------|------|
| 12345 | 1234 | João da Silva |
| 67890 | 1234 | Maria Oliveira |
| 11111 | 1111 | Carlos Souza |

Prefixos/placas válidos para abrir OS: `98000`, `98001`, `98002`, `8899`, `8898` (ou as placas `ABC1D23`, `DEF4G56`, `GHI7J89`, `JKL0M12`, `NOP3Q45`).

## Funcionalidades (MVP)

- **Login** com matrícula + senha (usuários pré-cadastrados em `js/data.js`), sessão persistente via token local e mensagem de erro para credenciais inválidas.
- **Home** com saudação pelo nome, 3 cards grandes (Contatos / Pane / OS) e navegação inferior fixa (Home / Perfil / Configurações — placeholders).
- **Abrir OS** (chat simulado estilo WhatsApp): prefixo/placa com validação → KM (numérico) → tipo de defeito (botões) → descrição → foto opcional (câmera no mobile) → observação opcional → confirmação "OS criada ✅". As OS ficam salvas em `localStorage` (mock).
- **Pane**: identificou o problema? (Sim → tipo por botões / Não → segue direto) → "Encaminhado ao SAM" com telefone.
- **Contatos**: Escalas por regional (Matriz, Maringá, São Paulo, Curitiba, Florianópolis) e Departamento Pessoal, com telefone clicável (`tel:`).
- **Chat**: bolhas com timestamp, avatar do bot, selo de "conta comercial", indicador de digitação, respostas por botões (texto livre só onde necessário). Digitar **"sair"** volta uma etapa; na primeira etapa, cancela o fluxo e retorna ao menu.
- **PWA**: `manifest.webmanifest` + service worker com cache do app shell (funciona offline após o primeiro acesso).

## Estrutura

```
index.html            Telas (login, home, perfil, config, chat)
css/styles.css        Estilo mobile-first, alto contraste
js/data.js            Dados mockados (motoristas, frota, contatos)
js/chat.js            Motor de chat (etapas, validação, "sair", fotos)
js/flows.js           Fluxos: Abrir OS, Pane, Contatos
js/app.js             Autenticação, sessão, navegação, registro do SW
manifest.webmanifest  Manifesto PWA
sw.js                 Service worker (cache offline)
icons/                Ícones do app (SVG + PNG 192/512)
```

## Fora do escopo (MVP)

Notificações push reais, integração com sistema de OS real, upload persistente de foto e múltiplos idiomas.
