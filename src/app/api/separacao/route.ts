import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const data =
      searchParams.get("data") || new Date().toISOString().slice(0, 10);
    const dataInicio = searchParams.get("dataInicio");
    const dataFim = searchParams.get("dataFim");

    const pedidos = await prisma.pedido.findMany({
      where:
        dataInicio && dataFim
          ? {
              dataEntrega: { gte: dataInicio, lte: dataFim },
              statusEntrega: { not: "Cancelado" },
            }
          : { dataEntrega: data, statusEntrega: { not: "Cancelado" } },
      include: {
        cliente: true,
        itens: { include: { produto: true } },
      },
      orderBy: { ordemRota: "asc" },
    });

    const produtoMap = new Map<
      number,
      { produtoId: number; nome: string; quantidadeTotal: number }
    >();

    for (const pedido of pedidos) {
      for (const item of pedido.itens) {
        const existing = produtoMap.get(item.produtoId);
        if (existing) {
          existing.quantidadeTotal += item.quantidade;
        } else {
          produtoMap.set(item.produtoId, {
            produtoId: item.produtoId,
            nome: item.produto.nome,
            quantidadeTotal: item.quantidade,
          });
        }
      }
    }

    const produtos = Array.from(produtoMap.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome)
    );

    const detalhes = pedidos.map((p) => ({
      pedidoId: p.id,
      cliente: p.cliente.nome,
      bairro: p.cliente.bairro,
      dataEntrega: p.dataEntrega,
      statusEntrega: p.statusEntrega,
      itens: p.itens.map((i) => ({
        produto: i.produto.nome,
        quantidade: i.quantidade,
      })),
    }));

    return NextResponse.json({
      data: dataInicio && dataFim ? dataInicio : data,
      dataFim: dataInicio && dataFim ? dataFim : undefined,
      totalPedidos: pedidos.length,
      produtos,
      detalhes,
    });
  });
}
