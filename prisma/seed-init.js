const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function seedInit() {
  // Formas de pagamento (essenciais)
  const formas = ["Dinheiro", "Pix"];
  for (const nome of formas) {
    await prisma.formaPagamento.upsert({
      where: { id: formas.indexOf(nome) + 1 },
      update: { nome },
      create: { nome },
    });
  }
  console.log("OK formas de pagamento");

  // Endereco de partida padrao
  await prisma.configuracao.upsert({
    where: { chave: "endereco_partida" },
    update: {},
    create: {
      chave: "endereco_partida",
      valor: "",
    },
  });
  console.log("OK configuracao inicial");

  console.log("Seed inicial completo!");
}

seedInit()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
