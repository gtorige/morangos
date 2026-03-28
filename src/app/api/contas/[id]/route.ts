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
    const conta = await prisma.conta.findUnique({
      where: { id: Number(id) },
    });

    if (!conta) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(conta);
  } catch (error) {
    console.error("Erro ao buscar conta:", error);
    return NextResponse.json(
      { error: "Erro ao buscar conta" },
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
    const { fornecedorId, fornecedorNome, categoria, categoriaId, subcategoriaId, tipoFinanceiro, valor, vencimento, situacao, parcelas, parcelaNumero, parcelaGrupoId } = body;
    const conta = await prisma.conta.update({
      where: { id: Number(id) },
      data: { fornecedorId, fornecedorNome, categoria, categoriaId, subcategoriaId: subcategoriaId ?? null, tipoFinanceiro: tipoFinanceiro ?? "", valor, vencimento, situacao, ...(parcelas !== undefined ? { parcelas, parcelaNumero: parcelaNumero ?? 1 } : {}), ...(parcelaGrupoId !== undefined ? { parcelaGrupoId } : {}) },
    });

    return NextResponse.json(conta);
  } catch (error) {
    console.error("Erro ao atualizar conta:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar conta" },
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
    await prisma.conta.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: "Conta excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir conta:", error);
    return NextResponse.json(
      { error: "Erro ao excluir conta" },
      { status: 500 }
    );
  }
}
