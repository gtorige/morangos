import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { withAuth, parseBody, parseId } from "@/lib/api-helpers";
import { pedidoCreateSchema } from "@/lib/schemas";
import { processOrderItems } from "@/lib/services/pedido-service";
import { PEDIDO_INCLUDE, SITUACAO_PAGAMENTO, STATUS_ENTREGA } from "@/lib/constants";
import { nowStr, todayStr } from "@/lib/formatting";
import { parsePagination, paginatedResponse, UNPAGINATED_LIMIT } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);

    // Build filters
    const where: Prisma.PedidoWhereInput = {};

    const clienteId = searchParams.get("cliente");
    if (clienteId) where.clienteId = parseId(clienteId);

    const produtoId = searchParams.get("produto");
    if (produtoId) {
      where.itens = { some: { produtoId: parseId(produtoId) } };
    }

    const bairro = searchParams.get("bairro");
    if (bairro) {
      where.cliente = { bairro: { contains: bairro } };
    }

    const formaPagamentoId = searchParams.get("formaPagamento");
    if (formaPagamentoId) where.formaPagamentoId = parseId(formaPagamentoId);

    const validPagamento: readonly string[] = SITUACAO_PAGAMENTO;
    const validEntrega: readonly string[] = STATUS_ENTREGA;

    const situacaoPagamento = searchParams.get("situacaoPagamento");
    if (situacaoPagamento && validPagamento.includes(situacaoPagamento)) {
      where.situacaoPagamento = situacaoPagamento;
    }

    const statusEntrega = searchParams.get("statusEntrega");
    if (statusEntrega) {
      const statuses = statusEntrega
        .split(",")
        .filter((s) => validEntrega.includes(s));
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

    const limit = searchParams.get("limit");
    const orderBy = searchParams.get("orderBy");
    const pagination = parsePagination(searchParams);

    if (pagination) {
      const [pedidos, total] = await Promise.all([
        prisma.pedido.findMany({
          where,
          include: PEDIDO_INCLUDE,
          orderBy: { dataPedido: orderBy === "asc" ? "asc" : "desc" },
          skip: pagination.skip,
          take: pagination.take,
        }),
        prisma.pedido.count({ where }),
      ]);
      return NextResponse.json(paginatedResponse(pedidos, total, pagination));
    }

    // Sem paginação (retrocompatível, com limite de segurança)
    const take = limit ? Math.min(parseId(limit), UNPAGINATED_LIMIT) : UNPAGINATED_LIMIT;
    const pedidos = await prisma.pedido.findMany({
      where,
      include: PEDIDO_INCLUDE,
      orderBy: { dataPedido: orderBy === "asc" ? "asc" : "desc" },
      take,
    });

    return NextResponse.json(pedidos);
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const body = await parseBody(request, pedidoCreateSchema);
    const { itens, taxaEntrega, ...pedidoData } = body;

    const { itensProcessados, total } = await processOrderItems(
      itens,
      pedidoData.dataEntrega
    );

    const pedido = await prisma.pedido.create({
      data: {
        clienteId: pedidoData.clienteId,
        dataPedido: nowStr(),
        dataEntrega: pedidoData.dataEntrega || todayStr(),
        formaPagamentoId: pedidoData.formaPagamentoId || null,
        observacoes: pedidoData.observacoes || "",
        total: total + taxaEntrega,
        taxaEntrega,
        itens: {
          create: itensProcessados,
        },
      },
      include: PEDIDO_INCLUDE,
    });

    return NextResponse.json(pedido, { status: 201 });
  });
}
