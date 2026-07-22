/* ==========================================================================
   Item de menu: Pane
   Registro rápido de pane com encaminhamento ao SAM.
   ========================================================================== */

const TIPOS_PROBLEMA = ["Motor", "Câmbio", "Freio", "Suspensão", "Infiltração"];

const telefone = (t) => `[tel:${t.replace(/\D/g, "")}|${t}]`;

function contatoSAM(db) {
  return db.prepare("SELECT * FROM contatos WHERE setor = 'sam' AND ativo = 1").get();
}

module.exports = {
  id: "pane",
  descricao: "Problema com o veículo agora? Acionamos o SAM para você.",
  icone: "alert",
  cor: "vermelho",
  ordem: 2,

  inicio: "identificou",
  etapas: {

    identificou: {
      tipo: "botoes",
      mensagem: (s) => [
        `*${s.motorista}*, vamos registrar a pane do veículo.`,
        "Você *identificou o problema*?"
      ],
      opcoes: [
        { label: "Sim", value: "sim" },
        { label: "Não", value: "nao" }
      ],
      salvar: "identificou",
      proxima: (s, v) => (v === "sim" ? "tipo" : "encaminhado")
    },

    tipo: {
      tipo: "botoes",
      mensagem: "Selecione o *tipo do problema*:",
      opcoes: () => TIPOS_PROBLEMA,
      salvar: "tipoProblema",
      proxima: "encaminhado"
    },

    encaminhado: {
      tipo: "fim",
      aoEntrar: (s, ctx, conversa) => {
        require("../audit").registrar({
          usuarioId: ctx.usuario.id, acao: "PANE_ENCAMINHADA_SAM",
          entidade: "conversas", entidadeId: conversa.id,
          detalhes: { tipoProblema: s.tipoProblema || "nao identificado" }
        });
      },
      mensagem: (s, ctx) => {
        const sam = contatoSAM(ctx.db);
        return [
          (s.tipoProblema
            ? `Registrado: problema de *${s.tipoProblema}*.`
            : "Sem problema — a equipe fará a avaliação no local."),
          `*Encaminhado ao SAM* ✅\n\nSua ocorrência foi transferida ao *Socorro e Apoio ao Motorista*.\n\nSe precisar falar agora, toque para ligar:\n${telefone(sam.telefone)}`,
          "Permaneça em local seguro e aguarde o contato."
        ];
      }
    }
  }
};
