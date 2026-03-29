import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api-helpers";
import { pedidoUpdateSchema } from "@/lib/schemas";
import { PEDIDO_INCLUDE } from "@/lib/constants";

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
    const { itens, ...pedidoData } = body;

    if (itens) {
      const total = itens.reduce(
        (acc, item) =>
          acc + (item.subtotal ?? item.precoUnitario! * item.quantidade),
        0
      );

      const pedido = await prisma.$transaction(async (tx) => {
        await tx.pedidoItem.deleteMany({
          where: { pedidoId: idNum },
        });

        return tx.pedido.update({
          where: { id: idNum },
          data: {
            ...pedidoData,
            total,
            itens: {
              create: itens.map((item) => ({
                produtoId: item.produtoId,
                quantidade: item.quantidade,
                precoUnitario: item.precoUnitario!,
                subtotal: item.subtotal ?? item.precoUnitario! * item.quantidade,
              })),
            },
          },
          include: PEDIDO_INCLUDE,
        });
      });

      return NextResponse.json(pedido);
    }

    const pedido = await prisma.pedido.update({
      where: { id: idNum },
      data: pedidoData,
      include: PEDIDO_INCLUDE,
    });

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
      await tx.pedidoItem.deleteMany({ where: { pedidoId: idNum } });
      await tx.pedido.delete({ where: { id: idNum } });
    });

    return NextResponse.json({ message: "Pedido excluído com sucesso" });
  });
}
