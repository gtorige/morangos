const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const fmt = (d) => d.toISOString().slice(0, 10);

async function seed() {
  const today = new Date();

  // 1. Starting address
  await prisma.configuracao.upsert({
    where: { chave: "endereco_partida" },
    update: {
      valor: "Av. Dr. Altino Arantes, 235, Vila Clementino, Sao Paulo",
    },
    create: {
      chave: "endereco_partida",
      valor: "Av. Dr. Altino Arantes, 235, Vila Clementino, Sao Paulo",
    },
  });
  console.log("OK endereco partida");

  // 2. Payment methods
  const fp1 = await prisma.formaPagamento.upsert({
    where: { id: 1 },
    update: {},
    create: { nome: "Dinheiro" },
  });
  const fp2 = await prisma.formaPagamento.upsert({
    where: { id: 2 },
    update: {},
    create: { nome: "Pix" },
  });
  console.log("OK formas pagamento");

  // 3. Products
  const produtosDef = [
    { nome: "Morango 300g", preco: 12.0 },
    { nome: "Morango 500g", preco: 18.0 },
    { nome: "Morango 1kg", preco: 32.0 },
    { nome: "Geleia de Morango 250ml", preco: 15.0 },
    { nome: "Morango Congelado 1kg", preco: 25.0 },
  ];
  const produtosDB = [];
  for (const p of produtosDef) {
    const existing = await prisma.produto.findFirst({
      where: { nome: p.nome },
    });
    if (existing) {
      produtosDB.push(existing);
    } else {
      produtosDB.push(await prisma.produto.create({ data: p }));
    }
  }
  console.log("OK " + produtosDB.length + " produtos");

  // 4. Promotions
  const dInicio = new Date(today);
  dInicio.setDate(today.getDate() - 3);
  const dFim = new Date(today);
  dFim.setDate(today.getDate() + 5);

  const promos = [
    {
      nome: "Morango 300g em promocao",
      produtoId: produtosDB[0].id,
      tipo: "desconto",
      precoPromocional: 10.0,
      dataInicio: fmt(dInicio),
      dataFim: fmt(dFim),
      ativo: true,
    },
    {
      nome: "Leve 3 pague 2 - Morango 500g",
      produtoId: produtosDB[1].id,
      tipo: "leve_x_pague_y",
      precoPromocional: 0,
      leveQuantidade: 3,
      pagueQuantidade: 2,
      dataInicio: fmt(dInicio),
      dataFim: fmt(dFim),
      ativo: true,
    },
  ];
  for (const pr of promos) {
    const existing = await prisma.promocao.findFirst({
      where: { nome: pr.nome },
    });
    if (!existing) await prisma.promocao.create({ data: pr });
  }
  console.log("OK promocoes");

  // 5. Clients (Sao Paulo, different bairros)
  const clientesDef = [
    { nome: "Maria Silva", telefone: "11999001122", rua: "Rua Domingos de Morais", numero: "1200", bairro: "Vila Mariana", cidade: "Sao Paulo" },
    { nome: "Joao Santos", telefone: "11998877665", rua: "Rua Vergueiro", numero: "3500", bairro: "Vila Mariana", cidade: "Sao Paulo" },
    { nome: "Ana Oliveira", telefone: "11997766554", rua: "Rua Tutoia", numero: "400", bairro: "Paraiso", cidade: "Sao Paulo", observacoes: "Pagar sempre em Pix" },
    { nome: "Carlos Souza", telefone: "11996655443", rua: "Av. Paulista", numero: "1578", bairro: "Bela Vista", cidade: "Sao Paulo", observacoes: "Portaria 24h" },
    { nome: "Fernanda Lima", telefone: "11995544332", rua: "Rua Oscar Freire", numero: "900", bairro: "Jardins", cidade: "Sao Paulo" },
    { nome: "Roberto Almeida", telefone: "11994433221", rua: "Rua Augusta", numero: "2200", bairro: "Consolacao", cidade: "Sao Paulo", observacoes: "Ligar antes" },
    { nome: "Patricia Costa", telefone: "11993322110", rua: "Rua Haddock Lobo", numero: "1100", bairro: "Jardins", cidade: "Sao Paulo" },
    { nome: "Marcos Ferreira", telefone: "11992211009", rua: "Rua da Consolacao", numero: "3000", bairro: "Consolacao", cidade: "Sao Paulo", observacoes: "Ap 42" },
    { nome: "Juliana Pereira", telefone: "11991100998", rua: "Rua Itapeva", numero: "500", bairro: "Bela Vista", cidade: "Sao Paulo" },
    { nome: "Ricardo Mendes", telefone: "11990099887", rua: "Rua Cardeal Arcoverde", numero: "1800", bairro: "Pinheiros", cidade: "Sao Paulo", observacoes: "Casa azul" },
  ];
  const clientesDB = [];
  for (const c of clientesDef) {
    const existing = await prisma.cliente.findFirst({ where: { nome: c.nome } });
    if (existing) {
      clientesDB.push(existing);
    } else {
      clientesDB.push(await prisma.cliente.create({ data: c }));
    }
  }
  console.log("OK " + clientesDB.length + " clientes");

  // 6. Orders: -5 days to +3 days
  const allOrders = [];
  for (let dayOffset = -5; dayOffset <= 3; dayOffset++) {
    const d = new Date(today);
    d.setDate(today.getDate() + dayOffset);
    const dataStr = fmt(d);

    const numOrders = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numOrders; i++) {
      const cliente = clientesDB[Math.floor(Math.random() * clientesDB.length)];
      const formaPagId = Math.random() > 0.4 ? fp2.id : fp1.id;
      const taxaEntrega = Math.random() > 0.5 ? 5.0 : 0;

      const numItens = 1 + Math.floor(Math.random() * 3);
      const itens = [];
      const used = new Set();

      for (let j = 0; j < numItens; j++) {
        let idx = Math.floor(Math.random() * produtosDB.length);
        while (used.has(idx) && used.size < produtosDB.length) {
          idx = (idx + 1) % produtosDB.length;
        }
        used.add(idx);
        const prod = produtosDB[idx];
        const qtd = 1 + Math.floor(Math.random() * 4);
        itens.push({
          produtoId: prod.id,
          quantidade: qtd,
          precoUnitario: prod.preco,
          subtotal: prod.preco * qtd,
        });
      }

      const totalItens = itens.reduce((a, it) => a + it.subtotal, 0);
      const total = totalItens + taxaEntrega;

      const isPast = dayOffset < 0;
      const isToday = dayOffset === 0;
      let situacaoPagamento = "Pendente";
      let statusEntrega = "Pendente";
      let valorPago = 0;

      if (isPast) {
        const pago = Math.random() > 0.15;
        situacaoPagamento = pago ? "Pago" : "Pendente";
        valorPago = pago ? total : 0;
        statusEntrega = pago ? "Entregue" : (Math.random() > 0.5 ? "Cancelado" : "Pendente");
      } else if (isToday) {
        const entregou = Math.random() > 0.4;
        statusEntrega = entregou ? "Entregue" : (Math.random() > 0.5 ? "Em rota" : "Pendente");
        if (entregou && Math.random() > 0.3) {
          situacaoPagamento = "Pago";
          valorPago = total;
        }
      }

      allOrders.push({
        clienteId: cliente.id,
        dataPedido: dataStr,
        dataEntrega: dataStr,
        formaPagamentoId: formaPagId,
        total,
        valorPago,
        situacaoPagamento,
        statusEntrega,
        taxaEntrega,
        observacoes: "",
        itens,
      });
    }
  }

  for (const order of allOrders) {
    const { itens, ...orderData } = order;
    await prisma.pedido.create({
      data: { ...orderData, itens: { create: itens } },
    });
  }
  console.log("OK " + allOrders.length + " pedidos");

  // 7. Contas
  const contasDef = [
    { fornecedorNome: "Samo", categoria: "Insumos", valor: 1500.0, vencimento: fmt(new Date(today.getTime() + 2 * 86400000)), situacao: "Pendente" },
    { fornecedorNome: "Inovar", categoria: "Embalagens", valor: 350.0, vencimento: fmt(new Date(today.getTime() - 1 * 86400000)), situacao: "Pendente" },
    { fornecedorNome: "Ferragem", categoria: "Manutencao", valor: 200.0, vencimento: fmt(new Date(today.getTime() - 5 * 86400000)), situacao: "Pago" },
    { fornecedorNome: "Solo Rico", categoria: "Fertilizante", valor: 890.0, vencimento: fmt(new Date(today.getTime() + 10 * 86400000)), situacao: "Pendente" },
  ];
  for (const c of contasDef) {
    await prisma.conta.create({ data: c });
  }
  console.log("OK " + contasDef.length + " contas");

  console.log("\nSeed completo!");
  await prisma.$disconnect();
}

seed().catch(console.error);
