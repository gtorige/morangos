import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const data = searchParams.get("data") || new Date().toISOString().slice(0, 10);

    const pedidos = await prisma.pedido.findMany({
      where: {
        dataEntrega: data,
        statusEntrega: { not: "Entregue" },
      },
      include: {
        cliente: true,
        formaPagamento: true,
        itens: { include: { produto: true } },
      },
      orderBy: [
        { cliente: { cidade: "asc" } },
        { cliente: { bairro: "asc" } },
        { cliente: { rua: "asc" } },
      ],
    });

    return NextResponse.json(pedidos);
  } catch (error) {
    console.error("Erro ao buscar rota:", error);
    return NextResponse.json(
      { error: "Erro ao buscar rota" },
      { status: 500 }
    );
  }
}
