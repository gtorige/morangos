import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { recorrenteCreateSchema } from "@/lib/schemas";
import { generateRecurringOrders, addDaysStr } from "@/lib/services/pedido-service";
import { RECORRENTE_INCLUDE } from "@/lib/constants";

export async function GET() {
  return withAuth(async () => {
    const recorrentes = await prisma.pedidoRecorrente.findMany({
      include: RECORRENTE_INCLUDE,
      orderBy: { id: "desc" },
    });
    return NextResponse.json(recorrentes);
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const body = await parseBody(request, recorrenteCreateSchema);
    const { itens, skipDate, ...data } = body;

    const recorrente = await prisma.pedidoRecorrente.create({
      data: {
        clienteId: data.clienteId,
        formaPagamentoId: data.formaPagamentoId || null,
        diasSemana: data.diasSemana,
        dataInicio: data.dataInicio,
        dataFim: data.dataFim || null,
        taxaEntrega: data.taxaEntrega,
        observacoes: data.observacoes || "",
        ativo: true,
        itens: {
          create: itens.map((i) => ({
            produtoId: i.produtoId,
            quantidade: i.quantidade,
            precoManual: i.precoManual ?? null,
          })),
        },
      },
      include: { cliente: true, itens: { include: { produto: true } } },
    });

    const fimStr = data.dataFim || addDaysStr(data.dataInicio, 90);

    const pedidosCriados = await generateRecurringOrders({
      recorrenteId: recorrente.id,
      clienteId: data.clienteId,
      formaPagamentoId: data.formaPagamentoId || null,
      diasSemana: data.diasSemana,
      dataInicio: data.dataInicio,
      dataFim: fimStr,
      taxaEntrega: data.taxaEntrega,
      observacoes: data.observacoes || "",
      itens: recorrente.itens,
      skipDate: skipDate || null,
    });

    return NextResponse.json(
      {
        ...recorrente,
        pedidosCriados,
        dataFimGerada: fimStr,
      },
      { status: 201 }
    );
  });
}
