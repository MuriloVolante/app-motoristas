/* ==========================================================================
   Definição dos fluxos: Abrir OS · Pane · Contatos
   ========================================================================== */

const telefone = (t) => `[tel:${t.replace(/\D/g, "")}|${t}]`;

const FLOWS = {

  /* ============ ABRIR OS ============ */
  os: {
    titulo: "Abrir OS",
    inicio: "veiculo",
    etapas: {

      veiculo: {
        tipo: "texto",
        mensagem: (s) => [
          `Olá, *${s.motorista}*. Vamos abrir uma Ordem de Serviço.`,
          "Informe o *prefixo* ou a *placa* do veículo.\n(Ex.: 98000 ou ABC1D23)"
        ],
        validar: (v) => {
          const veic = DB.buscarVeiculo(v);
          if (!veic) {
            return "Prefixo ou placa *não encontrado* na frota.\n\nConfira o número e digite novamente.\n(Ex.: 98000, 8899 ou a placa do veículo)";
          }
          return true;
        },
        salvar: "veiculoInput",
        proxima: "km"
      },

      km: {
        tipo: "texto",
        mensagem: "Veículo localizado. ✓\n\nInforme o *KM atual* do veículo (somente números):",
        validar: (v) => {
          const n = v.replace(/[.\s]/g, "");
          if (!/^\d{1,7}$/.test(n)) {
            return "Valor inválido. Informe o KM usando *somente números*.\n(Ex.: 152300)";
          }
          return true;
        },
        salvar: "km",
        proxima: "tipo"
      },

      tipo: {
        tipo: "botoes",
        mensagem: "Selecione o *tipo de defeito*:",
        opcoes: () => DB.tiposDefeito,
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
          `*OS criada* ✅\n\nNúmero: *${s.os.numero}*\nVeículo: *${s.os.prefixo}*\nDefeito: *${s.os.tipoDefeito}*\nKM: *${s.os.km}*` +
          (s.os.temFoto ? "\nFoto: anexada" : "") +
          (s.os.observacao ? `\nObservação: ${s.os.observacao}` : ""),
          "A equipe de manutenção foi notificada. Obrigado."
        ]
      }
    }
  },

  /* ============ PANE ============ */
  pane: {
    titulo: "Pane",
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
        opcoes: () => DB.tiposDefeito,
        salvar: "tipoProblema",
        proxima: "encaminhado"
      },

      encaminhado: {
        tipo: "fim",
        mensagem: (s) => [
          (s.tipoProblema
            ? `Registrado: problema de *${s.tipoProblema}*.`
            : "Sem problema — a equipe fará a avaliação no local."),
          `*Encaminhado ao SAM* ✅\n\nSua ocorrência foi transferida ao *${DB.contatoSAM.setor}*.\n\nSe precisar falar agora, toque para ligar:\n${telefone(DB.contatoSAM.telefone)}`,
          "Permaneça em local seguro e aguarde o contato."
        ]
      }
    }
  },

  /* ============ CONTATOS ============ */
  contatos: {
    titulo: "Contatos",
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
        opcoes: () => DB.contatosEscalas.map((c) => ({ label: c.regiao, value: c.regiao })),
        salvar: "regional",
        proxima: "escalasTelefone"
      },

      escalasTelefone: {
        tipo: "fim",
        mensagem: (s) => {
          const c = DB.contatosEscalas.find((x) => x.regiao === s.regional);
          return [
            `*Escalas — ${c.regiao}*\n\nToque no número para ligar:\n${telefone(c.telefone)}`,
            "Atendimento: *06h às 22h*, todos os dias."
          ];
        }
      },

      dp: {
        tipo: "fim",
        mensagem: [
          `*${DB.contatoDP.setor}*\n\nToque no número para ligar:\n${telefone(DB.contatoDP.telefone)}`,
          "Atendimento: *08h às 18h*, segunda a sexta."
        ]
      }
    }
  }
};
