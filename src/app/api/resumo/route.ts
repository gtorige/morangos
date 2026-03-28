import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get("periodo") || "dia";
    const dataParam =
      searchParams.get("data") || new Date().toISOString().slice(0, 10);

    // Support custom date range
    let dataInicio: string;
    let dataFim: string;
    let dataInicioAnterior: string;
    let dataFimAnterior: string;

    if (periodo === "custom") {
      dataInicio = searchParams.get("dataInicio") || dataParam;
      dataFim = searchParams.get("dataFim") || dataParam;
      // Previous range: same duration before dataInicio
      const days = daysBetween(dataInicio, dataFim);
      const prevEnd = addDays(dataInicio, -1);
      const prevStart = addDays(prevEnd, -(days - 1));
      dataInicioAnterior = prevStart;
      dataFimAnterior = prevEnd;
    } else {
      const range = getDateRange(periodo, dataParam);
      dataInicio = range.dataInicio;
      dataFim = range.dataFim;
      const prev = getPreviousRange(periodo, dataParam);
      dataInicioAnterior = prev.dataInicio;
      dataFimAnterior = prev.dataFim;
    }

    // Current period orders
    const pedidos = await prisma.pedido.findMany({
      where: {
        dataEntrega: { gte: dataInicio, lte: dataFim },
      },
      include: {
        cliente: true,
        formaPagamento: true,
        itens: { include: { produto: true } },
      },
    });

    // Previous period orders
    const pedidosAnterior = await prisma.pedido.findMany({
      where: {
        dataEntrega: { gte: dataInicioAnterior, lte: dataFimAnterior },
      },
      include: {
        cliente: true,
        itens: { include: { produto: true } },
      },
    });

    // --- KPIs current ---
    const totalPedidos = pedidos.length;
    const totalVendido = pedidos.reduce((acc, p) => acc + p.total, 0);
    const totalRecebido = pedidos.reduce((acc, p) => acc + p.valorPago, 0);
    const totalPendente = totalVendido - totalRecebido;
    const totalTaxaEntrega = pedidos.reduce(
      (acc, p) => acc + p.taxaEntrega,
      0
    );
    const ticketMedio = totalPedidos > 0 ? totalVendido / totalPedidos : 0;

    // --- KPIs previous ---
    const totalVendidoAnterior = pedidosAnterior.reduce(
      (acc, p) => acc + p.total,
      0
    );
    const totalPedidosAnterior = pedidosAnterior.length;
    const totalRecebidoAnterior = pedidosAnterior.reduce(
      (acc, p) => acc + p.valorPago,
      0
    );
    const ticketMedioAnterior =
      totalPedidosAnterior > 0
        ? totalVendidoAnterior / totalPedidosAnterior
        : 0;

    // --- Sales by product ---
    const produtoMap = new Map<
      number,
      { produto: string; quantidade: number; total: number }
    >();
    for (const pedido of pedidos) {
      for (const item of pedido.itens) {
        const existing = produtoMap.get(item.produtoId);
        if (existing) {
          existing.quantidade += item.quantidade;
          existing.total += item.subtotal;
        } else {
          produtoMap.set(item.produtoId, {
            produto: item.produto.nome,
            quantidade: item.quantidade,
            total: item.subtotal,
          });
        }
      }
    }
    const vendasPorProduto = Array.from(produtoMap.values()).sort(
      (a, b) => b.total - a.total
    );

    // --- Top clients ---
    const clienteMap = new Map<
      number,
      { cliente: string; bairro: string; pedidos: number; total: number; ticketMedio: number }
    >();
    for (const pedido of pedidos) {
      const existing = clienteMap.get(pedido.clienteId);
      if (existing) {
        existing.pedidos += 1;
        existing.total += pedido.total;
        existing.ticketMedio = existing.total / existing.pedidos;
      } else {
        clienteMap.set(pedido.clienteId, {
          cliente: pedido.cliente.nome,
          bairro: pedido.cliente.bairro || "",
          pedidos: 1,
          total: pedido.total,
          ticketMedio: pedido.total,
        });
      }
    }
    const topClientes = Array.from(clienteMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // --- Sales by bairro ---
    const bairroMap = new Map<
      string,
      { bairro: string; pedidos: number; total: number }
    >();
    for (const pedido of pedidos) {
      const bairro = pedido.cliente.bairro || "Sem bairro";
      const existing = bairroMap.get(bairro);
      if (existing) {
        existing.pedidos += 1;
        existing.total += pedido.total;
      } else {
        bairroMap.set(bairro, { bairro, pedidos: 1, total: pedido.total });
      }
    }
    const vendasPorBairro = Array.from(bairroMap.values()).sort(
      (a, b) => b.total - a.total
    );

    // --- Payment method breakdown ---
    const pagamentoMap = new Map<string, { forma: string; pedidos: number; total: number }>();
    for (const pedido of pedidos) {
      const forma = pedido.formaPagamento?.nome || "Não informado";
      const existing = pagamentoMap.get(forma);
      if (existing) {
        existing.pedidos += 1;
        existing.total += pedido.total;
      } else {
        pagamentoMap.set(forma, { forma, pedidos: 1, total: pedido.total });
      }
    }
    const vendasPorPagamento = Array.from(pagamentoMap.values()).sort(
      (a, b) => b.total - a.total
    );

    // --- Delivery status breakdown ---
    const statusMap: Record<string, number> = {
      Pendente: 0,
      "Em rota": 0,
      Entregue: 0,
      Cancelado: 0,
    };
    for (const pedido of pedidos) {
      statusMap[pedido.statusEntrega] =
        (statusMap[pedido.statusEntrega] || 0) + 1;
    }

    // --- Daily breakdown ---
    const vendasPorDia: { data: string; total: number; pedidos: number }[] = [];
    const diaMap = new Map<string, { total: number; pedidos: number }>();
    for (const pedido of pedidos) {
      const existing = diaMap.get(pedido.dataEntrega);
      if (existing) {
        existing.total += pedido.total;
        existing.pedidos += 1;
      } else {
        diaMap.set(pedido.dataEntrega, {
          total: pedido.total,
          pedidos: 1,
        });
      }
    }
    const sorted = Array.from(diaMap.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    for (const [data, vals] of sorted) {
      vendasPorDia.push({ data, ...vals });
    }

    // --- Monthly breakdown (for year view) ---
    const vendasPorMes: { mes: number; mesNome: string; total: number; pedidos: number }[] = [];
    const vendasPorMesAnterior: { mes: number; mesNome: string; total: number; pedidos: number }[] = [];
    const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    if (periodo === "ano") {
      const mesMap = new Map<number, { total: number; pedidos: number }>();
      for (const pedido of pedidos) {
        const month = parseInt(pedido.dataEntrega.split("-")[1]) - 1;
        const existing = mesMap.get(month);
        if (existing) {
          existing.total += pedido.total;
          existing.pedidos += 1;
        } else {
          mesMap.set(month, { total: pedido.total, pedidos: 1 });
        }
      }
      for (let m = 0; m < 12; m++) {
        const vals = mesMap.get(m) || { total: 0, pedidos: 0 };
        vendasPorMes.push({ mes: m, mesNome: mesesNomes[m], ...vals });
      }

      // Previous year monthly
      const mesMapAnterior = new Map<number, { total: number; pedidos: number }>();
      for (const pedido of pedidosAnterior) {
        const month = parseInt(pedido.dataEntrega.split("-")[1]) - 1;
        const existing = mesMapAnterior.get(month);
        if (existing) {
          existing.total += pedido.total;
          existing.pedidos += 1;
        } else {
          mesMapAnterior.set(month, { total: pedido.total, pedidos: 1 });
        }
      }
      for (let m = 0; m < 12; m++) {
        const vals = mesMapAnterior.get(m) || { total: 0, pedidos: 0 };
        vendasPorMesAnterior.push({ mes: m, mesNome: mesesNomes[m], ...vals });
      }
    }

    // --- Financial: contas a pagar ---
    const todasContas = await prisma.conta.findMany();
    const contasPendentes = todasContas.filter((c) => c.situacao === "Pendente");
    const contasPagas = todasContas.filter((c) => c.situacao === "Pago");
    const totalContasPendentes = contasPendentes.reduce((a, c) => a + c.valor, 0);
    const totalContasPagas = contasPagas.reduce((a, c) => a + c.valor, 0);
    const contasVencidas = contasPendentes.filter((c) => c.vencimento <= new Date().toISOString().slice(0, 10));
    const totalContasVencidas = contasVencidas.reduce((a, c) => a + c.valor, 0);

    const financeiro = {
      receita: totalVendido,
      recebido: totalRecebido,
      aReceber: totalPendente,
      despesas: totalContasPagas + totalContasPendentes,
      despesasPagas: totalContasPagas,
      despesasPendentes: totalContasPendentes,
      despesasVencidas: totalContasVencidas,
      lucroEstimado: totalVendido - (totalContasPagas + totalContasPendentes),
      fluxoCaixa: totalRecebido - totalContasPagas,
      contasPendentesQtd: contasPendentes.length,
      contasVencidasQtd: contasVencidas.length,
    };

    // --- Variações ---
    const variacaoVendas =
      totalVendidoAnterior > 0
        ? ((totalVendido - totalVendidoAnterior) / totalVendidoAnterior) * 100
        : 0;
    const variacaoPedidos =
      totalPedidosAnterior > 0
        ? ((totalPedidos - totalPedidosAnterior) / totalPedidosAnterior) * 100
        : 0;
    const variacaoRecebido =
      totalRecebidoAnterior > 0
        ? ((totalRecebido - totalRecebidoAnterior) / totalRecebidoAnterior) * 100
        : 0;
    const variacaoTicketMedio =
      ticketMedioAnterior > 0
        ? ((ticketMedio - ticketMedioAnterior) / ticketMedioAnterior) * 100
        : 0;

    return NextResponse.json({
      periodo,
      dataInicio,
      dataFim,
      totalPedidos,
      totalVendido,
      totalRecebido,
      totalPendente,
      totalTaxaEntrega,
      ticketMedio,
      comparativo: {
        dataInicioAnterior,
        dataFimAnterior,
        totalVendidoAnterior,
        totalPedidosAnterior,
        totalRecebidoAnterior,
        ticketMedioAnterior,
        variacaoVendas,
        variacaoPedidos,
        variacaoRecebido,
        variacaoTicketMedio,
      },
      vendasPorProduto,
      topClientes,
      vendasPorBairro,
      vendasPorPagamento,
      statusEntregas: statusMap,
      vendasPorDia,
      vendasPorMes,
      vendasPorMesAnterior,
      financeiro,
    });
  } catch (error) {
    console.error("Erro ao buscar resumo:", error);
    return NextResponse.json(
      { error: "Erro ao buscar resumo" },
      { status: 500 }
    );
  }
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string) {
  const da = new Date(a + "T12:00:00");
  const db = new Date(b + "T12:00:00");
  return Math.round((db.getTime() - da.getTime()) / 86400000) + 1;
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

function getDateRange(periodo: string, data: string) {
  const d = new Date(data + "T12:00:00");

  if (periodo === "semana") {
    const dayOfWeek = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { dataInicio: toDateStr(monday), dataFim: toDateStr(sunday) };
  }

  if (periodo === "mes") {
    const year = d.getFullYear();
    const month = d.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    return { dataInicio: toDateStr(first), dataFim: toDateStr(last) };
  }

  if (periodo === "ano") {
    const year = d.getFullYear();
    return {
      dataInicio: `${year}-01-01`,
      dataFim: `${year}-12-31`,
    };
  }

  return { dataInicio: data, dataFim: data };
}

function getPreviousRange(periodo: string, data: string) {
  const d = new Date(data + "T12:00:00");

  if (periodo === "semana") {
    const prev = new Date(d);
    prev.setDate(d.getDate() - 7);
    return getDateRange("semana", toDateStr(prev));
  }

  if (periodo === "mes") {
    const prev = new Date(d);
    prev.setMonth(d.getMonth() - 1);
    return getDateRange("mes", toDateStr(prev));
  }

  if (periodo === "ano") {
    const prevYear = d.getFullYear() - 1;
    return {
      dataInicio: `${prevYear}-01-01`,
      dataFim: `${prevYear}-12-31`,
    };
  }

  const prev = new Date(d);
  prev.setDate(d.getDate() - 1);
  return { dataInicio: toDateStr(prev), dataFim: toDateStr(prev) };
}
