import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId, ApiError } from "@/lib/api-helpers";
import { produtoUpdateSchema } from "@/lib/schemas";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);

    const produto = await prisma.produto.findUnique({
      where: { id: idNum },
    });

    if (!produto) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(produto);
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);
    const data = await parseBody(request, produtoUpdateSchema);

    const produto = await prisma.produto.update({
      where: { id: idNum },
      data,
    });

    return NextResponse.json(produto);
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const produtoId = parseId(id);

    const itensCount = await prisma.pedidoItem.count({
      where: { produtoId },
    });

    if (itensCount > 0) {
      throw new ApiError(
        `Este produto está vinculado a ${itensCount} item(ns) de pedido e não pode ser excluído para manter o histórico.`,
        400
      );
    }

    const promocoesCount = await prisma.promocao.count({
      where: { produtoId },
    });

    const { searchParams } = new URL(request.url);
    const confirmarPromocoes = searchParams.get("confirmarPromocoes") === "true";

    if (promocoesCount > 0 && !confirmarPromocoes) {
      return NextResponse.json(
        {
          aviso: `Este produto tem ${promocoesCount} promoção(ões) vinculada(s) que serão excluídas junto. Deseja continuar?`,
          requerConfirmacao: true,
        },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.promocao.deleteMany({ where: { produtoId } });
      await tx.produto.delete({ where: { id: produtoId } });
    });

    return NextResponse.json({ message: "Produto excluído com sucesso" });
  });
}
