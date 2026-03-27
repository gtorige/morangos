import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = body.data || new Date().toISOString().slice(0, 10);

    // Get day of week (0=Sunday, 1=Monday...6=Saturday)
    const date = new Date(data + "T12:00:00");
    const dayOfWeek = date.getDay();

    // Find active recorrentes that match this day
    const recorrentes = await prisma.pedidoRecorrente.findMany({
      where: {
        ativo: true,
        dataInicio: { lte: data },
      },
      include: {
        itens: { include: { produto: true } },
      },
    });

    // Filter by day of week and valid end date
    const matching = recorrentes.filter((r) => {
      const dias = r.diasSemana.split(",").map(Number);
      if (!dias.includes(dayOfWeek)) return false;
      if (r.dataFim && r.dataFim < data) return false;
      return true;
    });

    let created = 0;
    let skipped = 0;

    for (const rec of matching) {
      // Check if already generated for this date
      const existing = await prisma.pedido.findFirst({
        where: {
          recorrenteId: rec.id,
          dataEntrega: data,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Calculate totals using current product prices
      const itens = rec.itens.map((item) => ({
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        precoUnitario: item.produto.preco,
        subtotal: item.produto.preco * item.quantidade,
      }));

      const totalItens = itens.reduce((a, i) => a + i.subtotal, 0);
      const total = totalItens + rec.taxaEntrega;

      await prisma.pedido.create({
        data: {
          clienteId: rec.clienteId,
          dataPedido: data,
          dataEntrega: data,
          formaPagamentoId: rec.formaPagamentoId,
          total,
          valorPago: 0,
          situacaoPagamento: "Pendente",
          statusEntrega: "Pendente",
          taxaEntrega: rec.taxaEntrega,
          observacoes: rec.observacoes ? `[Recorrente] ${rec.observacoes}` : "[Recorrente]",
          recorrenteId: rec.id,
          itens: { create: itens },
        },
      });

      created++;
    }

    return NextResponse.json({
      data,
      diaSemana: dayOfWeek,
      recorrentesAtivos: matching.length,
      pedidosCriados: created,
      pedidosIgnorados: skipped,
    });
  } catch (error) {
    console.error("Erro ao gerar pedidos recorrentes:", error);
    return NextResponse.json({ error: "Erro ao gerar pedidos" }, { status: 500 });
  }
}
