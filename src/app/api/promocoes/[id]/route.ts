import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api-helpers";
import { promocaoUpdateSchema } from "@/lib/schemas";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);

    const promocao = await prisma.promocao.findUnique({
      where: { id: idNum },
      include: { produto: true },
    });

    if (!promocao) {
      return NextResponse.json(
        { error: "Promoção não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(promocao);
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);
    const data = await parseBody(request, promocaoUpdateSchema);

    const promocao = await prisma.promocao.update({
      where: { id: idNum },
      data,
      include: { produto: true },
    });

    return NextResponse.json(promocao);
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);

    await prisma.promocao.delete({ where: { id: idNum } });
    return NextResponse.json({ message: "Promoção excluída com sucesso" });
  });
}
