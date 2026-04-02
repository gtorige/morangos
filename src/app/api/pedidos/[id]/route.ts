import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api-helpers";
import { pedidoUpdateSchema } from "@/lib/schemas";
import { PEDIDO_INCLUDE } from "@/lib/constants";
import {
  updatePedidoItens,
  reverterEstoquePedido,
  marcarPedidoEntregue,
  updatePedidoSimples,
} from "@/lib/services/pedido-update-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);

    const pedido = await prisma.pedido.findUnique({
      where: { id: idNum },
      include: PEDIDO_INCLUDE,
    });

    if (!pedido) {
      return NextResponse.json(
        { error: "Pedido não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(pedido);
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);
    const body = await parseBody(request, pedidoUpdateSchema);
    const { itens, updatedAt: bodyUpdatedAt, ...pedidoData } = body;

    // Path 1: Items update — replace items and recalculate total
    if (itens) {
      const pedido = await prisma.$transaction((tx) =>
        updatePedidoItens(tx, idNum, itens, pedidoData, bodyUpdatedAt)
      );
      return NextResponse.json(pedido);
    }

    // Path 2: Revert from "Entregue" — reverse stock then fall through to simple update
    // TOCTOU fix: check statusEntrega INSIDE the transaction
    if (pedidoData.statusEntrega && pedidoData.statusEntrega !== "Entregue") {
      const pedido = await prisma.$transaction(async (tx) => {
        const pedidoCheck = await tx.pedido.findUnique({
          where: { id: idNum },
          select: { statusEntrega: true },
        });
        if (pedidoCheck?.statusEntrega === "Entregue") {
          await reverterEstoquePedido(tx, idNum);
        }
        return updatePedidoSimples(tx, idNum, pedidoData, bodyUpdatedAt);
      });
      return NextResponse.json(pedido);
    }

    // Path 3: Mark as "Entregue" — check stock, create movements, debit
    if (pedidoData.statusEntrega === "Entregue") {
      const pedido = await prisma.$transaction((tx) =>
        marcarPedidoEntregue(tx, idNum, pedidoData, bodyUpdatedAt)
      );
      return NextResponse.json(pedido);
    }

    // Path 4: Simple field update
    const pedido = await prisma.$transaction((tx) =>
      updatePedidoSimples(tx, idNum, pedidoData, bodyUpdatedAt)
    );
    return NextResponse.json(pedido);
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);

    await prisma.$transaction(async (tx) => {
      await reverterEstoquePedido(tx, idNum);
      await tx.pedidoItem.deleteMany({ where: { pedidoId: idNum } });
      await tx.pedido.delete({ where: { id: idNum } });
    });

    return NextResponse.json({ message: "Pedido excluído com sucesso" });
  });
}
