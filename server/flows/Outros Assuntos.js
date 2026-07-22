/* ==========================================================================
   Item de menu: Outros Assuntos
   Canal aberto: o motorista descreve o assunto e a mensagem fica
   registrada para tratamento pela equipe administrativa.
   ========================================================================== */

module.exports = {
  id: "outros-assuntos",
  descricao: "Algo que não se encaixa nos outros cards? Fale com o Sr. Assis.",
  icone: "message",
  cor: "roxo",
  ordem: 4,

  inicio: "assunto",
  etapas: {

    assunto: {
      tipo: "texto",
      expressao: "duvida",
      mensagem: (s) => [
        `Pois não, *${s.motorista}*. Em que posso ajudar?`,
        "*Descreva o assunto* com suas palavras — vou registrar e encaminhar à equipe responsável:"
      ],
      validar: (v) => v.trim().length >= 5 || "Pode detalhar um pouco mais? Assim consigo encaminhar direitinho.",
      salvar: "assunto",
      proxima: "registrado"
    },

    registrado: {
      tipo: "fim",
      expressao: "feliz",
      aoEntrar: (s, ctx, conversa) => {
        require("../audit").registrar({
          usuarioId: ctx.usuario.id, acao: "OUTRO_ASSUNTO_REGISTRADO",
          entidade: "conversas", entidadeId: conversa.id,
          detalhes: { resumo: String(s.assunto).slice(0, 120) }
        });
      },
      mensagem: [
        "*Registrado!* ✅\n\nSua mensagem foi encaminhada à equipe responsável, que vai te retornar pelos canais oficiais.",
        "Precisando de mim, é só chamar."
      ]
    }
  }
};
