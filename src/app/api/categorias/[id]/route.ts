import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../../auth";

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
    const categoriaId = Number(id);

    // Check if any contas reference this category
    const contasCount = await prisma.conta.count({
      where: { categoriaId },
    });

    if (contasCount > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir: ${contasCount} conta(s) vinculada(s) a esta categoria` },
        { status: 409 }
      );
    }

    await prisma.categoria.delete({ where: { id: categoriaId } });
    return NextResponse.json({ message: "Categoria excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir categoria:", error);
    return NextResponse.json(
      { error: "Erro ao excluir categoria" },
      { status: 500 }
    );
  }
}
