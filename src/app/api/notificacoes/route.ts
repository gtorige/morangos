import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const today = new Date().toISOString().slice(0, 10);

    // Pedidos entregues com pagamento pendente e dataEntrega < hoje
    const pedidosVencidos = await prisma.pedido.findMany({
      where: {
        statusEntrega: "Entregue",
        situacaoPagamento: "Pendente",
        dataEntrega: { lt: today },
      },
      include: { cliente: true },
      orderBy: { dataEntrega: "asc" },
    });

    const pagamentosVencidos = pedidosVencidos.map((p) => {
      const entrega = new Date(p.dataEntrega + "T00:00:00");
      const now = new Date(today + "T00:00:00");
      const diasVencido = Math.floor(
        (now.getTime() - entrega.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: p.id,
        cliente: p.cliente.nome,
        total: p.total,
        diasVencido,
        dataEntrega: p.dataEntrega,
      };
    });

    // Contas que vencem hoje
    const contasHoje = await prisma.conta.findMany({
      where: {
        situacao: "Pendente",
        vencimento: today,
      },
      include: { fornecedor: true },
    });

    const contasVencendo = contasHoje.map((c) => ({
      id: c.id,
      fornecedor: c.fornecedor?.nome || c.fornecedorNome || "—",
      valor: c.valor,
      vencimento: c.vencimento,
      diasParaVencer: 0,
    }));

    // Contas vencidas (vencimento < hoje)
    const contasAtrasadas = await prisma.conta.findMany({
      where: {
        situacao: "Pendente",
        vencimento: { lt: today },
      },
      include: { fornecedor: true },
      orderBy: { vencimento: "asc" },
    });

    const contasVencidas = contasAtrasadas.map((c) => {
      const venc = new Date(c.vencimento + "T00:00:00");
      const now = new Date(today + "T00:00:00");
      const diasVencido = Math.floor(
        (now.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: c.id,
        fornecedor: c.fornecedor?.nome || c.fornecedorNome || "—",
        valor: c.valor,
        vencimento: c.vencimento,
        diasVencido,
      };
    });

    // Contas próximas a vencer (próximos 5 dias, excluindo hoje que já está em contasVencendo)
    const futureDate = new Date(today + "T00:00:00");
    futureDate.setDate(futureDate.getDate() + 5);
    const futureStr = futureDate.toISOString().slice(0, 10);

    const contasProximas = await prisma.conta.findMany({
      where: {
        situacao: "Pendente",
        vencimento: { gt: today, lte: futureStr },
      },
      include: { fornecedor: true },
      orderBy: { vencimento: "asc" },
    });

    const contasProximasVencer = contasProximas.map((c) => {
      const venc = new Date(c.vencimento + "T00:00:00");
      const now = new Date(today + "T00:00:00");
      const diasParaVencer = Math.floor(
        (venc.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: c.id,
        fornecedor: c.fornecedor?.nome || c.fornecedorNome || "—",
        valor: c.valor,
        vencimento: c.vencimento,
        diasParaVencer,
      };
    });

    return NextResponse.json({
      pagamentosVencidos,
      contasVencendo,
      contasVencidas,
      contasProximasVencer,
    });
  } catch (error) {
    console.error("Erro ao buscar notificações:", error);
    return NextResponse.json(
      { error: "Erro ao buscar notificações" },
      { status: 500 }
    );
  }
}
