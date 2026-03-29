import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { pedidoBulkSchema } from "@/lib/schemas";

export async function PATCH(request: NextRequest) {
  return withAuth(async () => {
    const { ids, action, dataEntrega } = await parseBody(
      request,
      pedidoBulkSchema
    );

    if (action === "pago") {
      const pedidos = await prisma.pedido.findMany({
        where: { id: { in: ids } },
        select: { id: true, total: true },
      });

      await prisma.$transaction(
        pedidos.map((p) =>
          prisma.pedido.update({
            where: { id: p.id },
            data: {
              situacaoPagamento: "Pago",
              valorPago: p.total,
              ...(dataEntrega ? { dataEntrega } : {}),
            },
          })
        )
      );

      return NextResponse.json({
        message: `${pedidos.length} pedidos atualizados.`,
        count: pedidos.length,
      });
    }

    const dataMap: Record<string, Record<string, unknown>> = {
      entregue: { statusEntrega: "Entregue" },
      cancelado: { statusEntrega: "Cancelado" },
      pendente_entrega: { statusEntrega: "Pendente" },
      pendente_pagamento: { situacaoPagamento: "Pendente", valorPago: 0 },
    };

    const data = { ...dataMap[action], ...(dataEntrega ? { dataEntrega } : {}) };

    const result = await prisma.pedido.updateMany({
      where: { id: { in: ids } },
      data,
    });

    return NextResponse.json({
      message: `${result.count} pedidos atualizados.`,
      count: result.count,
    });
  });
}
