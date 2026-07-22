/* ==========================================================================
   Item de menu: Abrir OS
   Registra uma Ordem de Serviço de defeito do veículo.
   Para criar um item novo, copie este arquivo e ajuste as etapas.
   ========================================================================== */

const TIPOS_DEFEITO = ["Motor", "Câmbio", "Freio", "Suspensão", "Infiltração"];

function buscarVeiculo(db, texto) {
  const t = String(texto).trim().toUpperCase().replace(/[\s-]/g, "");
  return db.prepare("SELECT * FROM veiculos WHERE ativo = 1 AND (prefixo = ? OR placa = ?)").get(t, t) || null;
}

module.exports = {
  id: "abrir-os",
  descricao: "Registrar defeito do veículo.",
  icone: "wrench",
  cor: "azul",
  ordem: 3,

  inicio: "veiculo",
  etapas: {

    veiculo: {
      tipo: "texto",
      mensagem: (s) => [
        `Olá, *${s.motorista}*. Vamos abrir uma Ordem de Serviço.`,
        "Informe o *prefixo* ou a *placa* do veículo.\n(Ex.: 98000 ou ABC1D23)"
      ],
      validar: (v, s, ctx) =>
        buscarVeiculo(ctx.db, v)
          ? true
          : "Prefixo ou placa *não encontrado* na frota.\n\nConfira o número e digite novamente.",
      salvar: "veiculoInput",
      proxima: "km"
    },

    km: {
      tipo: "texto",
      mensagem: "Veículo localizado. ✓\n\nInforme o *KM atual* do veículo (somente números):",
      validar: (v) =>
        /^\d{1,7}$/.test(v.replace(/[.\s]/g, ""))
          ? true
          : "Valor inválido. Informe o KM usando *somente números*.\n(Ex.: 152300)",
      salvar: "km",
      proxima: "tipo"
    },

    tipo: {
      tipo: "botoes",
      mensagem: "Selecione o *tipo de defeito*:",
      opcoes: () => TIPOS_DEFEITO,
      salvar: "tipoDefeito",
      proxima: "descricao"
    },

    descricao: {
      tipo: "texto",
      mensagem: (s) => `Registrado: defeito de *${s.tipoDefeito}*.\n\nAgora *descreva o defeito* com suas palavras:`,
      validar: (v) => v.trim().length >= 3 || "Descrição muito curta. Detalhe um pouco mais o defeito, por favor.",
      salvar: "descricao",
      proxima: "fotoPergunta"
    },

    fotoPergunta: {
      tipo: "botoes",
      mensagem: "Deseja *adicionar uma foto* do defeito?",
      opcoes: [
        { label: "Sim", value: "sim" },
        { label: "Não", value: "nao" }
      ],
      salvar: "querFoto",
      proxima: (s, v) => (v === "sim" ? "foto" : "observacao")
    },

    foto: {
      tipo: "foto",
      mensagem: "Toque no botão abaixo para *tirar ou anexar a foto*:",
      proxima: "observacao"
    },

    observacao: {
      tipo: "texto",
      opcaoPular: "Pular",
      mensagem: "Alguma *observação*? (opcional)\n\nDigite a observação ou toque em *Pular*:",
      salvar: "observacao",
      proxima: "confirmacao"
    },

    confirmacao: {
      tipo: "fim",
      expressao: "feliz",
      aoEntrar: (s, ctx, conversa) => {
        const { db, usuario } = ctx;
        const veiculo = buscarVeiculo(db, s.veiculoInput);

        const numero = (db.prepare("SELECT COALESCE(MAX(numero), 1000) AS n FROM ordens_servico").get().n) + 1;
        const r = db.prepare(`
          INSERT INTO ordens_servico (numero, conversa_id, usuario_id, veiculo_id,
                                      km, tipo_defeito, descricao, observacao)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(numero, conversa.id, usuario.id, veiculo ? veiculo.id : null,
               parseInt(String(s.km).replace(/\D/g, ""), 10), s.tipoDefeito,
               s.descricao, s.observacao || null);

        if (s._ultimaFotoMensagemId) {
          db.prepare("UPDATE fotos SET os_id = ? WHERE mensagem_id = ?")
            .run(r.lastInsertRowid, s._ultimaFotoMensagemId);
        }

        require("../audit").registrar({
          usuarioId: usuario.id, acao: "OS_CRIADA",
          entidade: "ordens_servico", entidadeId: r.lastInsertRowid,
          detalhes: { numero, veiculo: veiculo ? veiculo.prefixo : s.veiculoInput, tipoDefeito: s.tipoDefeito }
        });

        s.osNumero = numero;
        s.osPrefixo = veiculo ? veiculo.prefixo : s.veiculoInput;
      },
      mensagem: (s) => [
        `*OS criada* ✅\n\nNúmero: *${s.osNumero}*\nVeículo: *${s.osPrefixo}*\nDefeito: *${s.tipoDefeito}*\nKM: *${s.km}*` +
        (s.querFoto === "sim" ? "\nFoto: anexada" : "") +
        (s.observacao ? `\nObservação: ${s.observacao}` : ""),
        "A equipe de manutenção foi notificada. Obrigado."
      ]
    }
  }
};
