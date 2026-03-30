import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId, ApiError } from "@/lib/api-helpers";

/** PUT — Editar movimentação (quantidade, motivo, data) */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);
    const body = await request.json();

    const mov = await prisma.movimentacaoEstoque.findUnique({
      where: { id: idNum },
      include: { produto: true },
    });
    if (!mov) throw new ApiError("Movimentação não encontrada.", 404);

    // Calcular diferença para ajustar estoque
    const oldQty = mov.quantidade;
    const newQty = body.quantidade !== undefined ? Number(body.quantidade) : oldQty;
    const diff = newQty - oldQty;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.movimentacaoEstoque.update({
        where: { id: idNum },
        data: {
          ...(body.quantidade !== undefined && { quantidade: newQty }),
          ...(body.motivo !== undefined && { motivo: body.motivo }),
          ...(body.data !== undefined && { data: body.data }),
          ...(body.saldoFinal !== undefined && { saldoFinal: body.saldoFinal }),
        },
        include: { produto: true },
      });

      // Ajustar estoqueAtual se a quantidade mudou (só para tipo "estoque")
      if (diff !== 0 && mov.produto.tipoEstoque === "estoque") {
        await tx.produto.update({
          where: { id: mov.produtoId },
          data: { estoqueAtual: { increment: diff } },
        });
      }

      return updated;
    });

    return NextResponse.json(result);
  });
}

/** DELETE — Excluir movimentação e reverter estoque */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);

    const mov = await prisma.movimentacaoEstoque.findUnique({
      where: { id: idNum },
      include: { produto: true },
    });
    if (!mov) throw new ApiError("Movimentação não encontrada.", 404);

    await prisma.$transaction(async (tx) => {
      await tx.movimentacaoEstoque.delete({ where: { id: idNum } });

      // Reverter estoqueAtual (só para tipo "estoque")
      if (mov.produto.tipoEstoque === "estoque") {
        await tx.produto.update({
          where: { id: mov.produtoId },
          data: { estoqueAtual: { decrement: mov.quantidade } },
        });
      }
    });

    return NextResponse.json({ message: "Movimentação excluída." });
  });
}
