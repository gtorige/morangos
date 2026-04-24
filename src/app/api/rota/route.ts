import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { todayStr } from "@/lib/formatting";

export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const data =
      searchParams.get("data") || todayStr();

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
  });
}
