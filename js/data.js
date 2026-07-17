/* ==========================================================================
   Dados mockados (sem backend real — MVP)
   ========================================================================== */

const DB = {
  // Motoristas pré-cadastrados (matrícula + senha)
  motoristas: [
    { matricula: "12345", senha: "1234", nome: "João da Silva" },
    { matricula: "67890", senha: "1234", nome: "Maria Oliveira" },
    { matricula: "11111", senha: "1111", nome: "Carlos Souza" }
  ],

  // Frota: prefixo ou placa são aceitos na abertura de OS
  veiculos: [
    { prefixo: "98000", placa: "ABC1D23" },
    { prefixo: "98001", placa: "DEF4G56" },
    { prefixo: "98002", placa: "GHI7J89" },
    { prefixo: "8899",  placa: "JKL0M12" },
    { prefixo: "8898",  placa: "NOP3Q45" }
  ],

  tiposDefeito: ["Motor", "Câmbio", "Freio", "Suspensão", "Infiltração"],

  contatosEscalas: [
    { regiao: "Matriz",        telefone: "(44) 3218-8000" },
    { regiao: "Maringá",       telefone: "(44) 3218-8100" },
    { regiao: "São Paulo",     telefone: "(11) 4002-8200" },
    { regiao: "Curitiba",      telefone: "(41) 3333-8300" },
    { regiao: "Florianópolis", telefone: "(48) 3222-8400" }
  ],

  contatoDP: { setor: "Departamento Pessoal", telefone: "(44) 3218-8050" },

  contatoSAM: { setor: "SAM — Socorro e Apoio ao Motorista", telefone: "(44) 3218-8900" }
};

// Busca veículo por prefixo ou placa (ignora maiúsculas/minúsculas e espaços)
DB.buscarVeiculo = function (texto) {
  const t = String(texto).trim().toUpperCase().replace(/[\s-]/g, "");
  return DB.veiculos.find(v => v.prefixo === t || v.placa === t) || null;
};

// Persistência mock de OS criadas (localStorage)
DB.salvarOS = function (os) {
  const lista = JSON.parse(localStorage.getItem("gbs_os") || "[]");
  os.numero = 1000 + lista.length + 1;
  os.criadaEm = new Date().toISOString();
  lista.push(os);
  localStorage.setItem("gbs_os", JSON.stringify(lista));
  return os;
};
