/* Simulador do endpoint externo de validação de credenciais.
   Usado apenas quando EXTERNAL_AUTH_URL não está configurada.
   Reproduz o contrato: valida { matricula, senha } e devolve { valido, nome }. */

const CADASTRO = [
  { matricula: "12345", senha: "1234", nome: "João da Silva" },
  { matricula: "67890", senha: "1234", nome: "Maria Oliveira" },
  { matricula: "11111", senha: "1111", nome: "Carlos Souza" }
];

async function validar(matricula, senha) {
  const u = CADASTRO.find((c) => c.matricula === matricula && c.senha === senha);
  return u ? { valido: true, nome: u.nome } : { valido: false };
}

module.exports = { validar };
