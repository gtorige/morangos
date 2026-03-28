import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../../auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await params;
    const pedido = await prisma.pedido.findUnique({
      where: { id: Number(id) },
      include: {
        cliente: true,
        formaPagamento: true,
        itens: { include: { produto: true } },
      },
    });

    if (!pedido) {
      return NextResponse.json(
        { error: "Pedido não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(pedido);
  } catch (error) {
    console.error("Erro ao buscar pedido:", error);
    return NextResponse.json(
      { error: "Erro ao buscar pedido" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { itens, ...pedidoData } = body;

    if (itens) {
      const idNum = Number(id);

      const total = itens.reduce(
        (acc: number, item: { subtotal?: number; precoUnitario: number; quantidade: number }) =>
          acc + (item.subtotal ?? item.precoUnitario * item.quantidade),
        0
      );

      const pedido = await prisma.$transaction(async (tx) => {
        // Delete existing items and recreate
        await tx.pedidoItem.deleteMany({
          where: { pedidoId: idNum },
        });

        return tx.pedido.update({
          where: { id: idNum },
          data: {
            ...pedidoData,
            total,
            itens: {
              create: itens.map(
                (item: {
                  produtoId: number;
                  quantidade: number;
                  precoUnitario: number;
                  subtotal?: number;
                }) => ({
                  produtoId: item.produtoId,
                  quantidade: item.quantidade,
                  precoUnitario: item.precoUnitario,
                  subtotal: item.subtotal ?? item.precoUnitario * item.quantidade,
                })
              ),
            },
          },
          include: {
            cliente: true,
            formaPagamento: true,
            itens: { include: { produto: true } },
          },
        });
      });

      return NextResponse.json(pedido);
    }

    const pedido = await prisma.pedido.update({
      where: { id: Number(id) },
      data: pedidoData,
      include: {
        cliente: true,
        formaPagamento: true,
        itens: { include: { produto: true } },
      },
    });

    return NextResponse.json(pedido);
  } catch (error) {
    console.error("Erro ao atualizar pedido:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar pedido" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await params;

    // Delete items first (cascade)
    await prisma.pedidoItem.deleteMany({
      where: { pedidoId: Number(id) },
    });

    await prisma.pedido.delete({ where: { id: Number(id) } });

    return NextResponse.json({ message: "Pedido excluído com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir pedido:", error);
    return NextResponse.json(
      { error: "Erro ao excluir pedido" },
      { status: 500 }
    );
  }
}
