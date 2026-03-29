import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId, ApiError } from "@/lib/api-helpers";
import { categoriaSchema } from "@/lib/schemas";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);
    const { nome } = await parseBody(request, categoriaSchema);

    const categoria = await prisma.categoria.update({
      where: { id: idNum },
      data: { nome },
    });
    return NextResponse.json(categoria);
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const categoriaId = parseId(id);

    const contasCount = await prisma.conta.count({
      where: { categoriaId },
    });

    if (contasCount > 0) {
      throw new ApiError(
        `Não é possível excluir: ${contasCount} conta(s) vinculada(s) a esta categoria`,
        409
      );
    }

    await prisma.categoria.delete({ where: { id: categoriaId } });
    return NextResponse.json({ message: "Categoria excluída com sucesso" });
  });
}
