import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId, parseBody, ApiError } from "@/lib/api-helpers";

const movimentacaoUpdateSchema = z.object({
  quantidade: z.number().optional(),
  motivo: z.string().max(500).optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** PUT — Editar movimentação (quantidade, motivo, data) */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);
    const body = await parseBody(request, movimentacaoUpdateSchema);

    const mov = await prisma.movimentacaoEstoque.findUnique({
      where: { id: idNum },
      include: { produto: true },
    });
    if (!mov) throw new ApiError("Movimentação não encontrada.", 404);

    // Calcular diferença para ajustar estoque
    const oldQty = mov.quantidade;
    const newQty = body.quantidade !== undefined ? body.quantidade : oldQty;
    const diff = newQty - oldQty;

    const result = await prisma.$transaction(async (tx) => {
      // Recalcular saldoFinal baseado no saldoInicial original
      const saldoFinal = mov.saldoInicial + newQty;

      const updated = await tx.movimentacaoEstoque.update({
        where: { id: idNum },
        data: {
          ...(body.quantidade !== undefined && { quantidade: newQty, saldoFinal }),
          ...(body.motivo !== undefined && { motivo: body.motivo }),
          ...(body.data !== undefined && { data: body.data }),
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
      // Negate the movement: positive movements (entries) subtract, negative (exits) add back
      if (mov.produto.tipoEstoque === "estoque") {
        await tx.produto.update({
          where: { id: mov.produtoId },
          data: { estoqueAtual: { increment: -mov.quantidade } },
        });
      }
    });

    return NextResponse.json({ message: "Movimentação excluída." });
  });
}
