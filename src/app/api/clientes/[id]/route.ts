import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api-helpers";
import { clienteUpdateSchema } from "@/lib/schemas";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);

    const cliente = await prisma.cliente.findUnique({
      where: { id: idNum },
    });

    if (!cliente) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(cliente);
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);
    const data = await parseBody(request, clienteUpdateSchema);

    const cliente = await prisma.cliente.update({
      where: { id: idNum },
      data,
    });

    return NextResponse.json(cliente);
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);

    await prisma.cliente.delete({ where: { id: idNum } });
    return NextResponse.json({ message: "Cliente excluído com sucesso" });
  });
}
