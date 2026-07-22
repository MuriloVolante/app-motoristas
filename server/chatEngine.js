/* Motor de conversa executado no servidor.
   Toda mensagem (bot e usuário) é gravada em `mensagens` e todo avanço,
   retorno ou conclusão de etapa é registrado na trilha de auditoria. */

const db = require("./db");
const audit = require("./audit");
const flowLoader = require("./flowLoader");

/* ---------- helpers ---------- */

function ctxDe(usuario) {
  return { db, usuario };
}

function resolver(valor, ...args) {
  return typeof valor === "function" ? valor(...args) : valor;
}

function gravarMensagem(conversaId, autor, tipo, conteudo, etapa) {
  const r = db.prepare(
    "INSERT INTO mensagens (conversa_id, autor, tipo, conteudo, etapa) VALUES (?, ?, ?, ?, ?)"
  ).run(conversaId, autor, tipo, conteudo, etapa || null);
  return r.lastInsertRowid;
}

function salvarEstado(conversa) {
  db.prepare("UPDATE conversas SET estado = ?, etapa_atual = ? WHERE id = ?")
    .run(JSON.stringify(conversa.estadoObj), conversa.etapa_atual, conversa.id);
}

function finalizar(conversa, status) {
  db.prepare("UPDATE conversas SET status = ?, finalizada_em = datetime('now'), estado = ?, etapa_atual = ? WHERE id = ?")
    .run(status, JSON.stringify(conversa.estadoObj), conversa.etapa_atual, conversa.id);
}

/* Monta a especificação de entrada que o cliente deve apresentar */
function especificarEntrada(fluxo, etapaId, estado, ctx) {
  const etapa = fluxo.etapas[etapaId];
  if (!etapa || etapa.tipo === "fim") return null;

  const spec = { tipo: etapa.tipo };
  if (etapa.tipo === "botoes") {
    spec.opcoes = resolver(etapa.opcoes, estado, ctx).map((o) =>
      typeof o === "string" ? { label: o, value: o } : { label: o.label, value: o.value ?? o.label }
    );
  }
  if (etapa.tipo === "texto" && etapa.opcaoPular) spec.opcaoPular = etapa.opcaoPular;
  return spec;
}

/* Entra numa etapa: executa efeitos, gera mensagens do bot, grava tudo */
function entrarEtapa(conversa, fluxo, etapaId, ctx, saida) {
  const etapa = fluxo.etapas[etapaId];
  conversa.etapa_atual = etapaId;

  if (etapa.aoEntrar) etapa.aoEntrar(conversa.estadoObj, ctx, conversa);

  const expressao = resolver(etapa.expressao, conversa.estadoObj, ctx) || "fala";
  const msgs = [].concat(resolver(etapa.mensagem, conversa.estadoObj, ctx));
  for (const m of msgs) {
    gravarMensagem(conversa.id, "bot", "texto", m, etapaId);
    saida.mensagens.push({ autor: "bot", tipo: "texto", conteudo: m, expressao });
  }

  if (etapa.tipo === "fim") {
    finalizar(conversa, "concluida");
    saida.status = "concluida";
    saida.entrada = null;
    audit.registrar({
      usuarioId: ctx.usuario.id, acao: "CONVERSA_CONCLUIDA",
      entidade: "conversas", entidadeId: conversa.id, detalhes: { fluxo: fluxo.id }
    });
  } else {
    salvarEstado(conversa);
    saida.entrada = especificarEntrada(fluxo, etapaId, conversa.estadoObj, ctx);
  }
}

/* ---------- API do motor ---------- */

function iniciarConversa(fluxoId, usuario) {
  const fluxo = flowLoader.obter(fluxoId);
  if (!fluxo) return null;

  const r = db.prepare(
    "INSERT INTO conversas (usuario_id, fluxo, etapa_atual, estado) VALUES (?, ?, ?, ?)"
  ).run(usuario.id, fluxo.id, fluxo.inicio, "{}");

  const conversa = {
    id: r.lastInsertRowid,
    estadoObj: { motorista: usuario.nome.split(" ")[0], matricula: usuario.matricula, _hist: [] },
    etapa_atual: fluxo.inicio
  };

  audit.registrar({
    usuarioId: usuario.id, acao: "CONVERSA_INICIADA",
    entidade: "conversas", entidadeId: conversa.id, detalhes: { fluxo: fluxo.id }
  });

  const saida = { conversaId: conversa.id, status: "ativa", mensagens: [], entrada: null };
  entrarEtapa(conversa, fluxo, fluxo.inicio, ctxDe(usuario), saida);
  return saida;
}

function carregarConversa(conversaId, usuario) {
  const linha = db.prepare(
    "SELECT * FROM conversas WHERE id = ? AND usuario_id = ? AND status = 'ativa'"
  ).get(conversaId, usuario.id);
  if (!linha) return null;
  return { ...linha, estadoObj: JSON.parse(linha.estado) };
}

/* Processa uma entrada do usuário.
   entrada: { tipo: 'texto' | 'opcao' | 'foto', valor, mensagemId? } */
function processarEntrada(conversa, entrada, usuario) {
  const fluxo = flowLoader.obter(conversa.fluxo);
  const etapa = fluxo.etapas[conversa.etapa_atual];
  const ctx = ctxDe(usuario);
  const saida = { conversaId: conversa.id, status: "ativa", mensagens: [], entrada: null };

  const responderBot = (texto, expressao = "duvida") => {
    gravarMensagem(conversa.id, "bot", "texto", texto, conversa.etapa_atual);
    saida.mensagens.push({ autor: "bot", tipo: "texto", conteudo: texto, expressao });
  };

  // grava a mensagem do usuário (fotos já foram gravadas pela rota de upload)
  if (entrada.tipo !== "foto") {
    gravarMensagem(conversa.id, "usuario", entrada.tipo === "opcao" ? "opcao" : "texto",
                   String(entrada.valor), conversa.etapa_atual);
  }

  /* comando "sair": volta uma etapa; na primeira, cancela o fluxo */
  if (entrada.tipo === "texto" && String(entrada.valor).trim().toLowerCase() === "sair") {
    const hist = conversa.estadoObj._hist || [];
    if (hist.length === 0) {
      responderBot("Tudo bem, atendimento cancelado.\nVoltando ao menu principal…", "triste");
      finalizar(conversa, "cancelada");
      saida.status = "cancelada";
      audit.registrar({
        usuarioId: usuario.id, acao: "CONVERSA_CANCELADA",
        entidade: "conversas", entidadeId: conversa.id, detalhes: { fluxo: fluxo.id }
      });
      return saida;
    }
    const anterior = hist.pop();
    conversa.etapa_atual = anterior;
    responderBot("Certo, voltando uma etapa.", "fala");
    audit.registrar({
      usuarioId: usuario.id, acao: "ETAPA_VOLTOU",
      entidade: "conversas", entidadeId: conversa.id, detalhes: { fluxo: fluxo.id, etapa: anterior }
    });
    // reapresenta a etapa anterior sem reexecutar aoEntrar
    const expAnterior = resolver(fluxo.etapas[anterior].expressao, conversa.estadoObj, ctx) || "fala";
    const msgs = [].concat(resolver(fluxo.etapas[anterior].mensagem, conversa.estadoObj, ctx));
    msgs.forEach((m) => responderBot(m, expAnterior));
    salvarEstado(conversa);
    saida.entrada = especificarEntrada(fluxo, anterior, conversa.estadoObj, ctx);
    return saida;
  }

  /* validação por tipo de etapa */
  if (etapa.tipo === "botoes") {
    if (entrada.tipo !== "opcao") {
      responderBot("Por favor, use os botões acima para responder.\n(Ou digite *sair* para voltar.)");
      saida.entrada = especificarEntrada(fluxo, conversa.etapa_atual, conversa.estadoObj, ctx);
      return saida;
    }
    const opcoes = especificarEntrada(fluxo, conversa.etapa_atual, conversa.estadoObj, ctx).opcoes;
    if (!opcoes.some((o) => o.value === entrada.valor)) {
      responderBot("Opção inválida. Use os botões acima para responder.");
      saida.entrada = { tipo: "botoes", opcoes };
      return saida;
    }
  }

  if (etapa.tipo === "foto" && entrada.tipo !== "foto") {
    responderBot("Use o botão acima para tirar ou anexar a foto.\n(Ou digite *sair* para voltar.)");
    saida.entrada = especificarEntrada(fluxo, conversa.etapa_atual, conversa.estadoObj, ctx);
    return saida;
  }

  if (etapa.tipo === "texto" && etapa.validar) {
    const pulou = etapa.opcaoPular && entrada.tipo === "opcao" && entrada.valor === "";
    if (!pulou) {
      const res = etapa.validar(String(entrada.valor), conversa.estadoObj, ctx);
      if (res !== true) {
        responderBot(res);
        audit.registrar({
          usuarioId: usuario.id, acao: "ENTRADA_REJEITADA",
          entidade: "conversas", entidadeId: conversa.id,
          detalhes: { fluxo: fluxo.id, etapa: conversa.etapa_atual }
        });
        saida.entrada = especificarEntrada(fluxo, conversa.etapa_atual, conversa.estadoObj, ctx);
        return saida;
      }
    }
  }

  /* resposta aceita: salva, avança */
  if (etapa.salvar) conversa.estadoObj[etapa.salvar] = entrada.valor;
  if (entrada.tipo === "foto" && entrada.mensagemId) conversa.estadoObj._ultimaFotoMensagemId = entrada.mensagemId;

  conversa.estadoObj._hist = conversa.estadoObj._hist || [];
  conversa.estadoObj._hist.push(conversa.etapa_atual);

  const proximaId = resolver(etapa.proxima, conversa.estadoObj, entrada.valor, ctx);
  audit.registrar({
    usuarioId: usuario.id, acao: "ETAPA_AVANCOU",
    entidade: "conversas", entidadeId: conversa.id,
    detalhes: { fluxo: fluxo.id, de: conversa.etapa_atual, para: proximaId }
  });

  entrarEtapa(conversa, fluxo, proximaId, ctx, saida);
  return saida;
}

module.exports = { iniciarConversa, carregarConversa, processarEntrada };
