import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../../auth";

interface ItemInput {
  produtoId: number;
  quantidade: number;
  precoManual?: number | null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await params;
    const idNum = parseInt(id);
    if (isNaN(idNum)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const body = await request.json();
    const { itens, ...data } = body;

    // Wrap update + delete items + create items + delete old orders in a transaction
    const { pendingOrderCount } = await prisma.$transaction(async (tx) => {
      // Update main record
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

      // Replace items if provided
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

      // ── Regenerate pending orders ──
      // 1. Delete all undelivered orders from this recurrence
      const pendingOrders = await tx.pedido.findMany({
        where: {
          recorrenteId: idNum,
          statusEntrega: { notIn: ["Entregue", "Cancelado"] },
        },
        select: { id: true },
      });

      const orderIds = pendingOrders.map(po => po.id);
      if (orderIds.length > 0) {
        await tx.pedidoItem.deleteMany({ where: { pedidoId: { in: orderIds } } });
        await tx.pedido.deleteMany({ where: { id: { in: orderIds } } });
      }

      return { pendingOrderCount: pendingOrders.length };
    });

    // 2. Get updated recurrence with items
    const recorrente = await prisma.pedidoRecorrente.findUnique({
      where: { id: idNum },
      include: { itens: { include: { produto: true } } },
    });

    if (!recorrente || !recorrente.ativo) {
      return NextResponse.json(recorrente);
    }

    // 3. Regenerate orders for the remaining period
    const today = new Date().toISOString().slice(0, 10);
    const diasArr = recorrente.diasSemana.split(",").map(Number);
    const inicio = recorrente.dataInicio > today ? recorrente.dataInicio : today;
    const fimStr = recorrente.dataFim || addDaysStr(today, 90);

    const current = new Date(inicio + "T12:00:00");
    const fim = new Date(fimStr + "T12:00:00");
    let pedidosCriados = 0;

    while (current <= fim) {
      const dayOfWeek = current.getDay();
      if (diasArr.includes(dayOfWeek)) {
        const dateStr = current.toISOString().slice(0, 10);

        // Check if already has a delivered/cancelled order for this date
        const existing = await prisma.pedido.findFirst({
          where: { recorrenteId: idNum, dataEntrega: dateStr },
        });
        if (!existing) {
          const pedidoItens = recorrente.itens.map((item) => {
            const preco = item.precoManual ?? item.produto.preco;
            return {
              produtoId: item.produtoId,
              quantidade: item.quantidade,
              precoUnitario: preco,
              subtotal: preco * item.quantidade,
            };
          });

          const totalItens = pedidoItens.reduce((a, i) => a + i.subtotal, 0);
          const total = totalItens + recorrente.taxaEntrega;

          await prisma.pedido.create({
            data: {
              clienteId: recorrente.clienteId,
              dataPedido: dateStr,
              dataEntrega: dateStr,
              formaPagamentoId: recorrente.formaPagamentoId,
              total,
              valorPago: 0,
              situacaoPagamento: "Pendente",
              statusEntrega: "Pendente",
              taxaEntrega: recorrente.taxaEntrega,
              observacoes: recorrente.observacoes ? `[Recorrente] ${recorrente.observacoes}` : "[Recorrente]",
              recorrenteId: idNum,
              itens: { create: pedidoItens },
            },
          });
          pedidosCriados++;
        }
      }
      current.setDate(current.getDate() + 1);
    }

    const updated = await prisma.pedidoRecorrente.findUnique({
      where: { id: idNum },
      include: { cliente: true, itens: { include: { produto: true } }, _count: { select: { pedidosGerados: true } } },
    });

    return NextResponse.json({ ...updated, pedidosRegenerados: pedidosCriados, pedidosDeletados: pendingOrderCount });
  } catch (error) {
    console.error("Erro ao atualizar recorrente:", error);
    return NextResponse.json({ error: "Erro ao atualizar recorrente" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await params;
    const idNum = parseInt(id);
    if (isNaN(idNum)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }

    const pendingOrderCount = await prisma.$transaction(async (tx) => {
      const pendingOrders = await tx.pedido.findMany({
        where: {
          recorrenteId: idNum,
          statusEntrega: { notIn: ["Entregue", "Cancelado"] },
        },
        select: { id: true },
      });

      // Delete pending orders (items cascade)
      const orderIds = pendingOrders.map(po => po.id);
      if (orderIds.length > 0) {
        await tx.pedidoItem.deleteMany({ where: { pedidoId: { in: orderIds } } });
        await tx.pedido.deleteMany({ where: { id: { in: orderIds } } });
      }

      // Unlink delivered/cancelled orders
      await tx.pedido.updateMany({
        where: { recorrenteId: idNum },
        data: { recorrenteId: null },
      });

      await tx.pedidoRecorrente.delete({ where: { id: idNum } });

      return pendingOrders.length;
    });

    return NextResponse.json({ success: true, pedidosDeletados: pendingOrderCount });
  } catch (error) {
    console.error("Erro ao excluir recorrente:", error);
    return NextResponse.json({ error: "Erro ao excluir recorrente" }, { status: 500 });
  }
}

function addDaysStr(dateStr: string, days: number) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
