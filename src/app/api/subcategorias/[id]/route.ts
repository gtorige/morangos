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
    await prisma.subcategoria.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: "Subcategoria excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir subcategoria:", error);
    return NextResponse.json({ error: "Erro ao excluir subcategoria" }, { status: 500 });
  }
}
