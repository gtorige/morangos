import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const recorrentes = await prisma.pedidoRecorrente.findMany({
      include: {
        cliente: true,
        formaPagamento: true,
        itens: { include: { produto: true } },
        _count: { select: { pedidosGerados: true } },
      },
      orderBy: { id: "desc" },
    });
    return NextResponse.json(recorrentes);
  } catch (error) {
    console.error("Erro ao buscar recorrentes:", error);
    return NextResponse.json({ error: "Erro ao buscar recorrentes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const { itens, ...data } = body;

    const recorrente = await prisma.pedidoRecorrente.create({
      data: {
        clienteId: data.clienteId,
        formaPagamentoId: data.formaPagamentoId || null,
        diasSemana: data.diasSemana,
        dataInicio: data.dataInicio,
        dataFim: data.dataFim || null,
        taxaEntrega: data.taxaEntrega || 0,
        observacoes: data.observacoes || "",
        ativo: true,
        itens: {
          create: itens.map((i: { produtoId: number; quantidade: number; precoManual?: number | null }) => ({
            produtoId: i.produtoId,
            quantidade: i.quantidade,
            precoManual: i.precoManual ?? null,
          })),
        },
      },
      include: { cliente: true, itens: { include: { produto: true } } },
    });

    // Auto-generate all orders for the validity period
    const diasArr = data.diasSemana.split(",").map(Number);
    const inicio = new Date(data.dataInicio + "T12:00:00");
    // Default: 90 days if no end date
    const fimStr = data.dataFim || addDaysStr(data.dataInicio, 90);
    const fim = new Date(fimStr + "T12:00:00");

    let pedidosCriados = 0;
    const current = new Date(inicio);
    const skipDate = data.skipDate || null;

    while (current <= fim) {
      const dayOfWeek = current.getDay();
      if (diasArr.includes(dayOfWeek)) {
        const dateStr = current.toISOString().slice(0, 10);

        // Skip date that already has a manually created order
        if (skipDate && dateStr === skipDate) {
          current.setDate(current.getDate() + 1);
          continue;
        }

        // Build items with current prices
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
        const total = totalItens + (data.taxaEntrega || 0);

        await prisma.pedido.create({
          data: {
            clienteId: data.clienteId,
            dataPedido: dateStr,
            dataEntrega: dateStr,
            formaPagamentoId: data.formaPagamentoId || null,
            total,
            valorPago: 0,
            situacaoPagamento: "Pendente",
            statusEntrega: "Pendente",
            taxaEntrega: data.taxaEntrega || 0,
            observacoes: data.observacoes ? `[Recorrente] ${data.observacoes}` : "[Recorrente]",
            recorrenteId: recorrente.id,
            itens: { create: pedidoItens },
          },
        });
        pedidosCriados++;
      }
      current.setDate(current.getDate() + 1);
    }

    return NextResponse.json({
      ...recorrente,
      pedidosCriados,
      dataFimGerada: fimStr,
    }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar recorrente:", error);
    return NextResponse.json({ error: "Erro ao criar recorrente" }, { status: 500 });
  }
}

function addDaysStr(dateStr: string, days: number) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
