import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";

export async function GET() {
  return withAuth(async () => {
    const today = new Date().toISOString().slice(0, 10);

    const [pedidosVencidos, contasHoje, contasAtrasadas, contasProximas] =
      await Promise.all([
        prisma.pedido.findMany({
          where: {
            statusEntrega: "Entregue",
            situacaoPagamento: "Pendente",
            dataEntrega: { lt: today },
          },
          include: { cliente: true },
          orderBy: { dataEntrega: "asc" },
        }),
        prisma.conta.findMany({
          where: { situacao: "Pendente", vencimento: today },
          include: { fornecedor: true },
        }),
        prisma.conta.findMany({
          where: { situacao: "Pendente", vencimento: { lt: today } },
          include: { fornecedor: true },
          orderBy: { vencimento: "asc" },
        }),
        (() => {
          const futureDate = new Date(today + "T00:00:00");
          futureDate.setDate(futureDate.getDate() + 5);
          const futureStr = futureDate.toISOString().slice(0, 10);
          return prisma.conta.findMany({
            where: {
              situacao: "Pendente",
              vencimento: { gt: today, lte: futureStr },
            },
            include: { fornecedor: true },
            orderBy: { vencimento: "asc" },
          });
        })(),
      ]);

    const nowDate = new Date(today + "T00:00:00");
    const dayMs = 1000 * 60 * 60 * 24;

    const pagamentosVencidos = pedidosVencidos.map((p) => ({
      id: p.id,
      cliente: p.cliente.nome,
      total: p.total,
      diasVencido: Math.floor(
        (nowDate.getTime() - new Date(p.dataEntrega + "T00:00:00").getTime()) / dayMs
      ),
      dataEntrega: p.dataEntrega,
    }));

    const contasVencendo = contasHoje.map((c) => ({
      id: c.id,
      fornecedor: c.fornecedor?.nome || c.fornecedorNome || "—",
      valor: c.valor,
      vencimento: c.vencimento,
      diasParaVencer: 0,
    }));

    const contasVencidas = contasAtrasadas.map((c) => ({
      id: c.id,
      fornecedor: c.fornecedor?.nome || c.fornecedorNome || "—",
      valor: c.valor,
      vencimento: c.vencimento,
      diasVencido: Math.floor(
        (nowDate.getTime() - new Date(c.vencimento + "T00:00:00").getTime()) / dayMs
      ),
    }));

    const contasProximasVencer = contasProximas.map((c) => ({
      id: c.id,
      fornecedor: c.fornecedor?.nome || c.fornecedorNome || "—",
      valor: c.valor,
      vencimento: c.vencimento,
      diasParaVencer: Math.floor(
        (new Date(c.vencimento + "T00:00:00").getTime() - nowDate.getTime()) / dayMs
      ),
    }));

    return NextResponse.json({
      pagamentosVencidos,
      contasVencendo,
      contasVencidas,
      contasProximasVencer,
    });
  });
}
