import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../../auth";

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
    const fornecedor = await prisma.fornecedor.update({
      where: { id: idNum },
      data: { nome: body.nome },
    });
    return NextResponse.json(fornecedor);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && (error as any).code === "P2002") {
      return NextResponse.json(
        { error: "Fornecedor já existe com este nome" },
        { status: 409 }
      );
    }
    console.error("Erro ao atualizar fornecedor:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar fornecedor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await params;
    const idNum = parseInt(id);

    // Check if has associated contas
    const contasCount = await prisma.conta.count({
      where: { fornecedorId: idNum },
    });

    if (contasCount > 0) {
      return NextResponse.json(
        {
          error: `Fornecedor possui ${contasCount} conta(s) associada(s). Remova as contas antes de excluir.`,
        },
        { status: 409 }
      );
    }

    await prisma.fornecedor.delete({ where: { id: idNum } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir fornecedor:", error);
    return NextResponse.json(
      { error: "Erro ao excluir fornecedor" },
      { status: 500 }
    );
  }
}
