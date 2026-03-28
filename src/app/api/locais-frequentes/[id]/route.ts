import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../../auth";

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
    if (isNaN(idNum)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    await prisma.localFrequente.delete({ where: { id: idNum } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir local frequente:", error);
    return NextResponse.json(
      { error: "Erro ao excluir local frequente" },
      { status: 500 }
    );
  }
}
