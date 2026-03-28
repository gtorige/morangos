import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { auth } from "../../../../auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const duplicarId = searchParams.get("duplicar");

    // Handle duplication
    if (duplicarId) {
      const original = await prisma.pedido.findUnique({
        where: { id: Number(duplicarId) },
        include: { itens: true },
      });

      if (!original) {
        return NextResponse.json(
          { error: "Pedido não encontrado para duplicação" },
          { status: 404 }
        );
      }

      const now = new Date();
      const dataPedido = now.toISOString().slice(0, 19);
      const dataEntrega = now.toISOString().slice(0, 10);

      const novoPedido = await prisma.pedido.create({
        data: {
          clienteId: original.clienteId,
          dataPedido,
          dataEntrega,
          formaPagamentoId: original.formaPagamentoId,
          total: original.total,
          taxaEntrega: original.taxaEntrega ?? 0,
          valorPago: 0,
          situacaoPagamento: "Pendente",
          statusEntrega: "Pendente",
          ordemRota: original.ordemRota,
          observacoes: original.observacoes,
          itens: {
            create: original.itens.map((item) => ({
              produtoId: item.produtoId,
              quantidade: item.quantidade,
              precoUnitario: item.precoUnitario,
              subtotal: item.subtotal,
            })),
          },
        },
        include: {
          cliente: true,
          itens: { include: { produto: true } },
          formaPagamento: true,
        },
      });

      return NextResponse.json(novoPedido, { status: 201 });
    }

    // Build filters
    const where: Prisma.PedidoWhereInput = {};

    const clienteId = searchParams.get("cliente");
    if (clienteId) where.clienteId = Number(clienteId);

    const produtoId = searchParams.get("produto");
    if (produtoId) {
      where.itens = { some: { produtoId: Number(produtoId) } };
    }

    const bairro = searchParams.get("bairro");
    if (bairro) {
      where.cliente = { bairro: { contains: bairro } };
    }

    const formaPagamentoId = searchParams.get("formaPagamento");
    if (formaPagamentoId) where.formaPagamentoId = Number(formaPagamentoId);

    const validPagamento = ["Pendente", "Pago"];
    const validEntrega = ["Pendente", "Em rota", "Entregue", "Cancelado"];

    const situacaoPagamento = searchParams.get("situacaoPagamento");
    if (situacaoPagamento && validPagamento.includes(situacaoPagamento)) {
      where.situacaoPagamento = situacaoPagamento;
    }

    const statusEntrega = searchParams.get("statusEntrega");
    if (statusEntrega) {
      const statuses = statusEntrega.split(",").filter(s => validEntrega.includes(s));
      if (statuses.length === 1) {
        where.statusEntrega = statuses[0];
      } else if (statuses.length > 1) {
        where.statusEntrega = { in: statuses };
      }
    }

    const data = searchParams.get("data");
    const dataInicio = searchParams.get("dataInicio");
    const dataFim = searchParams.get("dataFim");
    if (data) {
      where.dataEntrega = data;
    } else if (dataInicio || dataFim) {
      where.dataEntrega = {};
      if (dataInicio) where.dataEntrega.gte = dataInicio;
      if (dataFim) where.dataEntrega.lte = dataFim;
    }

    const valorMin = searchParams.get("valorMin");
    const valorMax = searchParams.get("valorMax");
    if (valorMin || valorMax) {
      where.total = {};
      if (valorMin) where.total.gte = Number(valorMin);
      if (valorMax) where.total.lte = Number(valorMax);
    }

    const pedidos = await prisma.pedido.findMany({
      where,
      include: {
        cliente: true,
        formaPagamento: true,
        itens: { include: { produto: true } },
      },
      orderBy: { dataPedido: "desc" },
    });

    return NextResponse.json(pedidos);
  } catch (error) {
    console.error("Erro ao buscar pedidos:", error);
    return NextResponse.json(
      { error: "Erro ao buscar pedidos" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    if (!body.clienteId) {
      return NextResponse.json({ error: "Cliente é obrigatório" }, { status: 400 });
    }
    if (!Array.isArray(body.itens) || body.itens.length === 0) {
      return NextResponse.json({ error: "Pedido deve ter ao menos um item" }, { status: 400 });
    }
    const { itens, taxaEntrega: taxaEntregaInput, ...pedidoData } = body;
    const taxaEntrega = Number(taxaEntregaInput) || 0;

    const hoje = new Date().toISOString().slice(0, 10);

    // Batch-fetch all products and active promotions to avoid N+1 queries
    const produtoIds = itens.map((i: any) => Number(i.produtoId));
    const [allProdutos, allPromocoes] = await Promise.all([
      prisma.produto.findMany({ where: { id: { in: produtoIds } } }),
      prisma.promocao.findMany({
        where: {
          produtoId: { in: produtoIds },
          ativo: true,
          dataInicio: { lte: hoje },
          dataFim: { gte: hoje },
        },
      }),
    ]);
    const produtoMap = new Map(allProdutos.map(p => [p.id, p]));
    const promocaoMap = new Map(allPromocoes.map(p => [p.produtoId, p]));

    // Process items: check for active promotions
    const itensProcessados = itens.map(
      (item: {
        produtoId: number;
        quantidade: number;
        precoUnitario?: number;
      }) => {
        // If a non-zero precoUnitario override is provided, use it directly
        if (item.precoUnitario !== undefined && item.precoUnitario !== 0) {
          const subtotal = item.precoUnitario * item.quantidade;
          return {
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            precoUnitario: item.precoUnitario,
            subtotal,
          };
        }

        const produtoId = Number(item.produtoId);
        const promocao = promocaoMap.get(produtoId) ?? null;
        const produto = produtoMap.get(produtoId);
        const precoBase = produto?.preco ?? 0;

        let precoUnitario: number;
        let subtotal: number;

        if (promocao && promocao.tipo === "leve_x_pague_y") {
          // "Leve X Pague Y" promotion: charge fewer units
          const leveQuantidade = promocao.leveQuantidade ?? 0;
          const pagueQuantidade = promocao.pagueQuantidade ?? 0;

          precoUnitario = precoBase;

          if (leveQuantidade > 0 && pagueQuantidade > 0) {
            const gruposCompletos = Math.floor(item.quantidade / leveQuantidade);
            const resto = item.quantidade % leveQuantidade;
            const qtdCobrada = gruposCompletos * pagueQuantidade + resto;
            subtotal = qtdCobrada * precoUnitario;
          } else {
            subtotal = precoUnitario * item.quantidade;
          }
        } else if (promocao && promocao.tipo === "desconto") {
          // Discount promotion: use promotional price
          precoUnitario = promocao.precoPromocional;
          subtotal = precoUnitario * item.quantidade;
        } else if (promocao) {
          // Fallback for promotions without a recognized tipo (legacy behavior)
          precoUnitario = promocao.precoPromocional;
          subtotal = precoUnitario * item.quantidade;
        } else {
          precoUnitario = precoBase;
          subtotal = precoUnitario * item.quantidade;
        }

        return {
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          precoUnitario,
          subtotal,
        };
      }
    );

    const total =
      itensProcessados.reduce(
        (acc: number, item: { subtotal: number }) => acc + item.subtotal,
        0
      ) + taxaEntrega;

    const now = new Date();
    const dataPedido = now.toISOString().slice(0, 19);

    const pedido = await prisma.pedido.create({
      data: {
        clienteId: pedidoData.clienteId,
        dataPedido,
        dataEntrega: pedidoData.dataEntrega || now.toISOString().slice(0, 10),
        formaPagamentoId: pedidoData.formaPagamentoId || null,
        observacoes: pedidoData.observacoes || "",
        total,
        taxaEntrega,
        itens: {
          create: itensProcessados,
        },
      },
      include: {
        cliente: true,
        formaPagamento: true,
        itens: { include: { produto: true } },
      },
    });

    return NextResponse.json(pedido, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar pedido:", error);
    return NextResponse.json(
      { error: "Erro ao criar pedido" },
      { status: 500 }
    );
  }
}
