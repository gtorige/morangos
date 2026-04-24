import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api-helpers";
import { recorrenteUpdateSchema } from "@/lib/schemas";
import { generateRecurringOrders, addDaysStr } from "@/lib/services/pedido-service";
import { todayStr } from "@/lib/formatting";

interface ItemInput {
  produtoId: number;
  quantidade: number;
  precoManual?: number | null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);
    const body = await parseBody(request, recorrenteUpdateSchema);
    const { itens, ...data } = body;

    // Wrap update + delete items + create items + delete old orders in a transaction
    const { pendingOrderCount } = await prisma.$transaction(async (tx) => {
      await tx.pedidoRecorrente.update({
        where: { id: idNum },
        data: {
          clienteId: data.clienteId,
          formaPagamentoId: data.formaPagamentoId || null,
          diasSemana: data.diasSemana,
          dataInicio: data.dataInicio,
          dataFim: data.dataFim || null,
          taxaEntrega: data.taxaEntrega ?? 0,
          observacoes: data.observacoes ?? "",
          ativo: data.ativo ?? true,
        },
      });

      if (itens) {
        await tx.pedidoRecorrenteItem.deleteMany({
          where: { pedidoRecorrenteId: idNum },
        });
        await tx.pedidoRecorrenteItem.createMany({
          data: (itens as ItemInput[]).map((i) => ({
            pedidoRecorrenteId: idNum,
            produtoId: i.produtoId,
            quantidade: i.quantidade,
            precoManual: i.precoManual ?? null,
          })),
        });
      }

      const pendingOrders = await tx.pedido.findMany({
        where: {
          recorrenteId: idNum,
          statusEntrega: { notIn: ["Entregue", "Cancelado"] },
        },
        select: { id: true },
      });

      const orderIds = pendingOrders.map((po) => po.id);
      if (orderIds.length > 0) {
        await tx.pedidoItem.deleteMany({ where: { pedidoId: { in: orderIds } } });
        await tx.pedido.deleteMany({ where: { id: { in: orderIds } } });
      }

      return { pendingOrderCount: pendingOrders.length };
    });

    const recorrente = await prisma.pedidoRecorrente.findUnique({
      where: { id: idNum },
      include: { itens: { include: { produto: true } } },
    });

    if (!recorrente || !recorrente.ativo) {
      return NextResponse.json(recorrente);
    }

    const today = todayStr();
    const inicio = recorrente.dataInicio > today ? recorrente.dataInicio : today;
    const fimStr = recorrente.dataFim || addDaysStr(today, 90);

    const pedidosCriados = await generateRecurringOrders({
      recorrenteId: idNum,
      clienteId: recorrente.clienteId,
      formaPagamentoId: recorrente.formaPagamentoId,
      diasSemana: recorrente.diasSemana,
      dataInicio: inicio,
      dataFim: fimStr,
      taxaEntrega: recorrente.taxaEntrega,
      observacoes: recorrente.observacoes,
      itens: recorrente.itens,
    });

    const updated = await prisma.pedidoRecorrente.findUnique({
      where: { id: idNum },
      include: {
        cliente: true,
        itens: { include: { produto: true } },
        _count: { select: { pedidosGerados: true } },
      },
    });

    return NextResponse.json({
      ...updated,
      pedidosRegenerados: pedidosCriados,
      pedidosDeletados: pendingOrderCount,
    });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);

    // Optional body: { keepOrderIds?: number[] } — orders the user wants to keep
    let keepOrderIds: number[] = [];
    try {
      const body = await request.json();
      if (Array.isArray(body.keepOrderIds)) {
        keepOrderIds = body.keepOrderIds;
      }
    } catch {
      // No body or invalid JSON — delete all pending (default behavior)
    }

    const keepSet = new Set(keepOrderIds);

    const pendingOrderCount = await prisma.$transaction(async (tx) => {
      const pendingOrders = await tx.pedido.findMany({
        where: {
          recorrenteId: idNum,
          statusEntrega: { notIn: ["Entregue", "Cancelado"] },
        },
        select: { id: true },
      });

      // Only delete orders NOT in the keep list
      const orderIdsToDelete = pendingOrders
        .map((po) => po.id)
        .filter((oid) => !keepSet.has(oid));

      if (orderIdsToDelete.length > 0) {
        await tx.pedidoItem.deleteMany({ where: { pedidoId: { in: orderIdsToDelete } } });
        await tx.pedido.deleteMany({ where: { id: { in: orderIdsToDelete } } });
      }

      // Unlink all remaining orders (kept + delivered/cancelled)
      await tx.pedido.updateMany({
        where: { recorrenteId: idNum },
        data: { recorrenteId: null },
      });

      await tx.pedidoRecorrente.delete({ where: { id: idNum } });

      return { deleted: orderIdsToDelete.length, kept: keepOrderIds.length, total: pendingOrders.length };
    });

    return NextResponse.json({ success: true, pedidosDeletados: pendingOrderCount.deleted, pedidosMantidos: pendingOrderCount.kept });
  });
}
