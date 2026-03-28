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
    const promocao = await prisma.promocao.findUnique({
      where: { id: Number(id) },
      include: { produto: true },
    });

    if (!promocao) {
      return NextResponse.json(
        { error: "Promoção não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(promocao);
  } catch (error) {
    console.error("Erro ao buscar promoção:", error);
    return NextResponse.json(
      { error: "Erro ao buscar promoção" },
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
    const { nome, produtoId, tipo, precoPromocional, leveQuantidade, pagueQuantidade, dataInicio, dataFim, ativo } = body;
    const promocao = await prisma.promocao.update({
      where: { id: Number(id) },
      data: { nome, produtoId, tipo, precoPromocional, leveQuantidade, pagueQuantidade, dataInicio, dataFim, ativo },
      include: { produto: true },
    });

    return NextResponse.json(promocao);
  } catch (error) {
    console.error("Erro ao atualizar promoção:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar promoção" },
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
    await prisma.promocao.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: "Promoção excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir promoção:", error);
    return NextResponse.json(
      { error: "Erro ao excluir promoção" },
      { status: 500 }
    );
  }
}
