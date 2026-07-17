/* ==========================================================================
   Definição dos fluxos: Abrir OS · Pane · Contatos
   ========================================================================== */

const telefone = (t) => `[tel:${t.replace(/\D/g, "")}|${t}]`;

const FLOWS = {

  /* ============ ABRIR OS ============ */
  os: {
    titulo: "Abrir OS 🛠️",
    inicio: "veiculo",
    etapas: {

      veiculo: {
        tipo: "texto",
        mensagem: (s) => [
          `Olá, *${s.motorista}*! Vamos abrir uma OS. 🛠️`,
          "Qual o *prefixo* ou a *placa* do carro?\n(Ex.: 98000 ou ABC1D23)"
        ],
        validar: (v) => {
          const veic = DB.buscarVeiculo(v);
          if (!veic) {
            return "❌ Prefixo ou placa *não encontrado* na frota.\n\nConfira e digite novamente.\n(Ex.: 98000, 8899 ou a placa do carro)";
          }
          return true;
        },
        salvar: "veiculoInput",
        proxima: "km",
        aoSalvar: null
      },

      km: {
        tipo: "texto",
        mensagem: "Veículo encontrado! ✅\n\nAgora me informe o *KM atual* do veículo (somente números):",
        validar: (v) => {
          const n = v.replace(/[.\s]/g, "");
          if (!/^\d{1,7}$/.test(n)) {
            return "❌ Valor inválido. Digite o KM usando *somente números*.\n(Ex.: 152300)";
          }
          return true;
        },
        salvar: "km",
        proxima: "tipo"
      },

      tipo: {
        tipo: "botoes",
        mensagem: "Qual o *tipo de defeito*? Toque em uma opção:",
        opcoes: () => DB.tiposDefeito,
        salvar: "tipoDefeito",
        proxima: "descricao"
      },

      descricao: {
        tipo: "texto",
        mensagem: (s) => `Certo, defeito de *${s.tipoDefeito}*. 📝\n\nAgora *descreva o defeito* com suas palavras:`,
        validar: (v) => v.trim().length >= 3 || "❌ Descrição muito curta. Explique um pouco mais o defeito, por favor.",
        salvar: "descricao",
        proxima: "fotoPergunta"
      },

      fotoPergunta: {
        tipo: "botoes",
        mensagem: "Deseja *adicionar uma foto* do defeito? 📷",
        opcoes: [
          { label: "✅ Sim", value: "sim" },
          { label: "❌ Não", value: "nao" }
        ],
        salvar: "querFoto",
        proxima: (s, v) => (v === "sim" ? "foto" : "observacao")
      },

      foto: {
        tipo: "foto",
        mensagem: "Toque no botão abaixo para *tirar ou anexar a foto*: 📷",
        proxima: "observacao"
      },

      observacao: {
        tipo: "texto",
        opcaoPular: "⏭️ Pular",
        mensagem: "Alguma *observação*? (opcional)\n\nDigite ou toque em *Pular*:",
        salvar: "observacao",
        proxima: "confirmacao"
      },

      confirmacao: {
        tipo: "fim",
        aoEntrar: (s) => {
          const veic = DB.buscarVeiculo(s.veiculoInput);
          s.os = DB.salvarOS({
            motorista: s.motorista,
            matricula: s.matricula,
            prefixo: veic ? veic.prefixo : s.veiculoInput,
            placa: veic ? veic.placa : "",
            km: s.km,
            tipoDefeito: s.tipoDefeito,
            descricao: s.descricao,
            temFoto: s.querFoto === "sim",
            observacao: s.observacao || ""
          });
        },
        mensagem: (s) => [
          `*OS criada com sucesso!* ✅\n\n📋 OS Nº *${s.os.numero}*\n🚌 Veículo: *${s.os.prefixo}*\n🔧 Defeito: *${s.os.tipoDefeito}*\n📏 KM: *${s.os.km}*` +
          (s.os.temFoto ? "\n📷 Foto anexada" : "") +
          (s.os.observacao ? `\n🗒️ Obs.: ${s.os.observacao}` : ""),
          "Nossa equipe de manutenção já foi avisada. Obrigado! 🙌"
        ]
      }
    }
  },

  /* ============ PANE ============ */
  pane: {
    titulo: "Pane 🚨",
    inicio: "identificou",
    etapas: {

      identificou: {
        tipo: "botoes",
        mensagem: (s) => [
          `*${s.motorista}*, vamos te ajudar com a pane. 🚨`,
          "Você *identificou o problema* do veículo?"
        ],
        opcoes: [
          { label: "✅ Sim", value: "sim" },
          { label: "❌ Não", value: "nao" }
        ],
        salvar: "identificou",
        proxima: (s, v) => (v === "sim" ? "tipo" : "encaminhado")
      },

      tipo: {
        tipo: "botoes",
        mensagem: "Qual o *tipo do problema*? Toque em uma opção:",
        opcoes: () => DB.tiposDefeito,
        salvar: "tipoProblema",
        proxima: "encaminhado"
      },

      encaminhado: {
        tipo: "fim",
        mensagem: (s) => [
          (s.tipoProblema
            ? `Anotado: problema de *${s.tipoProblema}*. 📝`
            : "Sem problema, nossa equipe vai avaliar. 👍"),
          `🚨 *Encaminhado ao SAM!*\n\nSua ocorrência foi transferida para o *${DB.contatoSAM.setor}*.\n\nSe precisar falar agora, ligue:\n${telefone(DB.contatoSAM.telefone)}`,
          "Fique em local seguro e aguarde o contato. 🙏"
        ]
      }
    }
  },

  /* ============ CONTATOS ============ */
  contatos: {
    titulo: "Contatos 📞",
    inicio: "menu",
    etapas: {

      menu: {
        tipo: "botoes",
        mensagem: (s) => [
          `Olá, *${s.motorista}*! 📞`,
          "Com qual setor você quer falar?"
        ],
        opcoes: [
          { label: "🗓️ Contato Escalas", value: "escalas" },
          { label: "🧑‍💼 Contato Departamento Pessoal", value: "dp" }
        ],
        proxima: (s, v) => (v === "escalas" ? "escalas" : "dp")
      },

      escalas: {
        tipo: "botoes",
        mensagem: "Escolha a sua *regional*:",
        opcoes: () => DB.contatosEscalas.map((c) => ({ label: c.regiao, value: c.regiao })),
        salvar: "regional",
        proxima: "escalasTelefone"
      },

      escalasTelefone: {
        tipo: "fim",
        mensagem: (s) => {
          const c = DB.contatosEscalas.find((x) => x.regiao === s.regional);
          return [
            `🗓️ *Escalas — ${c.regiao}*\n\nToque no número para ligar:\n${telefone(c.telefone)}`,
            "Horário de atendimento: *06h às 22h*, todos os dias."
          ];
        }
      },

      dp: {
        tipo: "fim",
        mensagem: [
          `🧑‍💼 *${DB.contatoDP.setor}*\n\nToque no número para ligar:\n${telefone(DB.contatoDP.telefone)}`,
          "Horário de atendimento: *08h às 18h*, segunda a sexta."
        ]
      }
    }
  }
};
