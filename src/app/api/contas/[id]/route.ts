import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId, checkOptimisticLock } from "@/lib/api-helpers";
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
    const body = await parseBody(request, contaUpdateSchema);
    const { updatedAt: bodyUpdatedAt, ...data } = body;

    // Optimistic locking atômico dentro da transação
    const conta = await prisma.$transaction(async (tx) => {
      const existing = await tx.conta.findUnique({ where: { id: idNum }, select: { updatedAt: true } });
      const newUpdatedAt = checkOptimisticLock(bodyUpdatedAt, existing?.updatedAt);
      return tx.conta.update({
        where: { id: idNum },
        data: { ...data, updatedAt: newUpdatedAt },
      });
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

    // Wrap in transaction to prevent race conditions on group delete
    await prisma.$transaction(async (tx) => {
      const conta = await tx.conta.findUnique({
        where: { id: idNum },
        select: { parcelaGrupoId: true },
      });

      if (!conta) return;

      if (conta.parcelaGrupoId) {
        // Conta pertence a um grupo — excluir todas as parcelas do grupo
        await tx.conta.deleteMany({
          where: { parcelaGrupoId: conta.parcelaGrupoId },
        });
      } else {
        // Verificar se outras contas apontam para esta como grupo
        const dependents = await tx.conta.count({
          where: { parcelaGrupoId: idNum, id: { not: idNum } },
        });
        if (dependents > 0) {
          // Esta conta é âncora — excluir todo o grupo
          await tx.conta.deleteMany({
            where: { parcelaGrupoId: idNum },
          });
        } else {
          await tx.conta.delete({ where: { id: idNum } });
        }
      }
    });

    return NextResponse.json({ message: "Conta excluída com sucesso" });
  });
}
