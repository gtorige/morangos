import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api-helpers";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);

    await prisma.subcategoria.delete({ where: { id: idNum } });
    return NextResponse.json({ message: "Subcategoria excluída com sucesso" });
  });
}
