import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api-helpers";
import { contaUpdateSchema } from "@/lib/schemas";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);

    const conta = await prisma.conta.findUnique({
      where: { id: idNum },
    });

    if (!conta) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(conta);
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);
    const data = await parseBody(request, contaUpdateSchema);

    const conta = await prisma.conta.update({
      where: { id: idNum },
      data,
    });

    return NextResponse.json(conta);
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);

    await prisma.conta.delete({ where: { id: idNum } });
    return NextResponse.json({ message: "Conta excluída com sucesso" });
  });
}
