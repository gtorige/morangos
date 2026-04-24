import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, ApiError } from "@/lib/api-helpers";
import { todayStr } from "@/lib/formatting";

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const body = await request.json();
    const data = body.data || todayStr();

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      throw new ApiError("Data inválida. Formato esperado: YYYY-MM-DD", 400);
    }

    const date = new Date(data + "T12:00:00");
    if (isNaN(date.getTime())) {
      throw new ApiError("Data inválida.", 400);
    }
    const dayOfWeek = date.getDay();

    const recorrentes = await prisma.pedidoRecorrente.findMany({
      where: {
        ativo: true,
        dataInicio: { lte: data },
      },
      include: {
        itens: { include: { produto: true } },
      },
    });

    const matching = recorrentes.filter((r) => {
      const dias = r.diasSemana.split(",").map(Number);
      if (!dias.includes(dayOfWeek)) return false;
      if (r.dataFim && r.dataFim < data) return false;
      return true;
    });

    let created = 0;
    let skipped = 0;

    for (const rec of matching) {
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

      const itens = rec.itens.map((item) => {
        const preco = item.precoManual ?? item.produto.preco;
        return {
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          precoUnitario: preco,
          subtotal: preco * item.quantidade,
        };
      });

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
          observacoes: rec.observacoes
            ? `[Recorrente] ${rec.observacoes}`
            : "[Recorrente]",
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
  });
}
