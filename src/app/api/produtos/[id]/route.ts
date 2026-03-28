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
    const produto = await prisma.produto.findUnique({
      where: { id: Number(id) },
    });

    if (!produto) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(produto);
  } catch (error) {
    console.error("Erro ao buscar produto:", error);
    return NextResponse.json(
      { error: "Erro ao buscar produto" },
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
    const idNum = parseInt(id);
    if (isNaN(idNum)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }
    const body = await request.json();
    const { nome, preco } = body;
    const produto = await prisma.produto.update({
      where: { id: idNum },
      data: { nome, preco },
    });

    return NextResponse.json(produto);
  } catch (error) {
    console.error("Erro ao atualizar produto:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar produto" },
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
    const produtoId = Number(id);

    // Check if product is used in any orders
    const itensCount = await prisma.pedidoItem.count({
      where: { produtoId },
    });

    if (itensCount > 0) {
      return NextResponse.json(
        {
          error: `Este produto está vinculado a ${itensCount} item(ns) de pedido e não pode ser excluído para manter o histórico.`,
        },
        { status: 400 }
      );
    }

    // Check for related promotions
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

    // Delete related promotions and product in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.promocao.deleteMany({ where: { produtoId } });
      await tx.produto.delete({ where: { id: produtoId } });
    });
    return NextResponse.json({ message: "Produto excluído com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir produto:", error);
    return NextResponse.json(
      { error: "Erro ao excluir produto" },
      { status: 500 }
    );
  }
}
