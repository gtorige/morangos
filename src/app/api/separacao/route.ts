import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const data =
      searchParams.get("data") || new Date().toISOString().slice(0, 10);

    const pedidos = await prisma.pedido.findMany({
      where: {
        dataEntrega: data,
        statusEntrega: { not: "Cancelado" },
      },
      include: {
        cliente: true,
        itens: {
          include: { produto: true },
        },
      },
      orderBy: { ordemRota: "asc" },
    });

    // Aggregate products across all orders
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

    // Detail per client
    const detalhes = pedidos.map((p) => ({
      pedidoId: p.id,
      cliente: p.cliente.nome,
      bairro: p.cliente.bairro,
      statusEntrega: p.statusEntrega,
      itens: p.itens.map((i) => ({
        produto: i.produto.nome,
        quantidade: i.quantidade,
      })),
    }));

    return NextResponse.json({
      data,
      totalPedidos: pedidos.length,
      produtos,
      detalhes,
    });
  } catch (error) {
    console.error("Erro ao buscar separação:", error);
    return NextResponse.json(
      { error: "Erro ao buscar separação" },
      { status: 500 }
    );
  }
}
