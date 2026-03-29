import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId, ApiError } from "@/lib/api-helpers";
import { fornecedorSchema } from "@/lib/schemas";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);
    const data = await parseBody(request, fornecedorSchema);

    const fornecedor = await prisma.fornecedor.update({
      where: { id: idNum },
      data,
    });

    return NextResponse.json(fornecedor);
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);

    const contasCount = await prisma.conta.count({
      where: { fornecedorId: idNum },
    });

    if (contasCount > 0) {
      throw new ApiError(
        `Fornecedor possui ${contasCount} conta(s) associada(s). Remova as contas antes de excluir.`,
        409
      );
    }

    await prisma.fornecedor.delete({ where: { id: idNum } });
    return NextResponse.json({ success: true });
  });
}
