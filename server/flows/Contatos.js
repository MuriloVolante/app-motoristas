/* ==========================================================================
   Item de menu: Contatos
   Telefones de Escalas (por regional) e Departamento Pessoal.
   Os números vêm da tabela `contatos` — para alterar, atualize o banco.
   ========================================================================== */

const telefone = (t) => `[tel:${t.replace(/\D/g, "")}|${t}]`;

module.exports = {
  id: "contatos",
  descricao: "Escalas e Departamento Pessoal",
  icone: "phone",
  cor: "azul",
  ordem: 1,

  inicio: "menu",
  etapas: {

    menu: {
      tipo: "botoes",
      mensagem: (s) => [
        `Olá, *${s.motorista}*.`,
        "Com qual setor você deseja falar?"
      ],
      opcoes: [
        { label: "Contato Escalas", value: "escalas" },
        { label: "Contato Departamento Pessoal", value: "dp" }
      ],
      proxima: (s, v) => (v === "escalas" ? "escalas" : "dp")
    },

    escalas: {
      tipo: "botoes",
      mensagem: "Selecione a sua *regional*:",
      opcoes: (s, ctx) =>
        ctx.db.prepare("SELECT regiao FROM contatos WHERE setor = 'escalas' AND ativo = 1 ORDER BY id")
          .all()
          .map((c) => ({ label: c.regiao, value: c.regiao })),
      salvar: "regional",
      proxima: "escalasTelefone"
    },

    escalasTelefone: {
      tipo: "fim",
      mensagem: (s, ctx) => {
        const c = ctx.db.prepare(
          "SELECT * FROM contatos WHERE setor = 'escalas' AND regiao = ? AND ativo = 1"
        ).get(s.regional);
        return [
          `*Escalas — ${c.regiao}*\n\nToque no número para ligar:\n${telefone(c.telefone)}`,
          `Atendimento: *${c.horario}*.`
        ];
      }
    },

    dp: {
      tipo: "fim",
      mensagem: (s, ctx) => {
        const c = ctx.db.prepare("SELECT * FROM contatos WHERE setor = 'dp' AND ativo = 1").get();
        return [
          `*Departamento Pessoal*\n\nToque no número para ligar:\n${telefone(c.telefone)}`,
          `Atendimento: *${c.horario}*.`
        ];
      }
    }
  }
};
