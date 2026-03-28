import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../../auth";

type BulkAction =
  | "entregue"
  | "pago"
  | "cancelado"
  | "pendente_entrega"
  | "pendente_pagamento";

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const { ids, action, dataEntrega } = body as {
      ids: number[];
      action: BulkAction;
      dataEntrega?: string;
    };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "IDs são obrigatórios." },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: "Ação é obrigatória." },
        { status: 400 }
      );
    }

    // Build the data object based on action
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: Record<string, any> = {};

    switch (action) {
      case "entregue":
        data = { statusEntrega: "Entregue" };
        break;
      case "pago":
        // For "pago", we need to update each order individually to set valorPago = total
        // So we use a transaction with individual updates
        {
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
      case "cancelado":
        data = { statusEntrega: "Cancelado" };
        break;
      case "pendente_entrega":
        data = { statusEntrega: "Pendente" };
        break;
      case "pendente_pagamento":
        data = { situacaoPagamento: "Pendente", valorPago: 0 };
        break;
      default:
        return NextResponse.json(
          { error: "Ação inválida." },
          { status: 400 }
        );
    }

    // Add dataEntrega if provided
    if (dataEntrega) {
      data.dataEntrega = dataEntrega;
    }

    const result = await prisma.pedido.updateMany({
      where: { id: { in: ids } },
      data,
    });

    return NextResponse.json({
      message: `${result.count} pedidos atualizados.`,
      count: result.count,
    });
  } catch (error) {
    console.error("Erro ao atualizar pedidos em lote:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar pedidos." },
      { status: 500 }
    );
  }
}
