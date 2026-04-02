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

    // Current period orders (capped to prevent memory issues on large date ranges)
    const RESUMO_LIMIT = 5000;
    const pedidos = await prisma.pedido.findMany({
      where: {
        dataEntrega: { gte: dataInicio, lte: dataFim },
      },
      include: {
        cliente: true,
        formaPagamento: true,
        itens: { include: { produto: true } },
      },
      take: RESUMO_LIMIT,
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
      take: RESUMO_LIMIT,
    });

    // --- Filter: only delivered orders count as revenue ---
    const entregues = pedidos.filter((p) => p.statusEntrega === "Entregue");
    const entreguesAnterior = pedidosAnterior.filter((p) => p.statusEntrega === "Entregue");
    const pedidosPendentesEntrega = pedidos.filter(
      (p) => p.statusEntrega !== "Entregue" && p.statusEntrega !== "Cancelado"
    );
    const pedidosAtivos = pedidos.filter((p) => p.statusEntrega !== "Cancelado");

    // --- KPIs current (revenue from delivered only) ---
    const totalPedidos = entregues.length;
    const totalEntregues = entregues.length;
    const totalVendido = entregues.reduce((acc, p) => acc + p.total, 0);
    const totalRecebido = entregues.filter((p) => p.situacaoPagamento === "Pago").reduce((acc, p) => acc + p.total, 0);
    const totalPendente = totalVendido - totalRecebido;
    const totalTaxaEntrega = entregues.reduce(
      (acc, p) => acc + p.taxaEntrega,
      0
    );
    const ticketMedio = totalEntregues > 0 ? totalVendido / totalEntregues : 0;

    // --- Projected KPIs (entregues + pendentes de entrega) ---
    const totalPedidosProjetado = pedidosAtivos.length;
    const totalAEntregarValor = pedidosPendentesEntrega.reduce((acc, p) => acc + p.total, 0);
    const totalVendasProjetado = totalVendido + totalAEntregarValor;
    const totalACobrar = entregues.filter((p) => p.situacaoPagamento !== "Pago").reduce((acc, p) => acc + p.total, 0);
    const ticketMedioProjetado = totalPedidosProjetado > 0 ? totalVendasProjetado / totalPedidosProjetado : 0;

    // --- KPIs previous (revenue from delivered only) ---
    const totalVendidoAnterior = entreguesAnterior.reduce(
      (acc, p) => acc + p.total,
      0
    );
    const totalPedidosAnterior = entreguesAnterior.length;
    const totalEntreguesAnterior = entreguesAnterior.length;
    const totalRecebidoAnterior = entreguesAnterior.filter((p) => p.situacaoPagamento === "Pago").reduce((acc, p) => acc + p.total, 0);
    const ticketMedioAnterior =
      totalEntreguesAnterior > 0
        ? totalVendidoAnterior / totalEntreguesAnterior
        : 0;

    // --- Sales by product (delivered only) ---
    const produtoMap = new Map<
      number,
      { produto: string; quantidade: number; total: number }
    >();
    for (const pedido of entregues) {
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

    // --- Sales by product projected (entregues + pendentes) ---
    const produtoMapProj = new Map<number, { produto: string; quantidade: number; total: number }>();
    for (const pedido of [...entregues, ...pedidosPendentesEntrega]) {
      for (const item of pedido.itens) {
        const existing = produtoMapProj.get(item.produtoId);
        if (existing) {
          existing.quantidade += item.quantidade;
          existing.total += item.subtotal;
        } else {
          produtoMapProj.set(item.produtoId, {
            produto: item.produto.nome,
            quantidade: item.quantidade,
            total: item.subtotal,
          });
        }
      }
    }
    const vendasPorProdutoProjetado = Array.from(produtoMapProj.values()).sort(
      (a, b) => b.total - a.total
    );

    // --- Top clients (delivered only) ---
    const clienteMap = new Map<
      number,
      { cliente: string; bairro: string; pedidos: number; total: number; ticketMedio: number }
    >();
    for (const pedido of entregues) {
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

    // --- Top clients projected (entregues + pendentes) ---
    const clienteMapProj = new Map<number, { cliente: string; bairro: string; pedidos: number; total: number; ticketMedio: number }>();
    for (const pedido of [...entregues, ...pedidosPendentesEntrega]) {
      const existing = clienteMapProj.get(pedido.clienteId);
      if (existing) {
        existing.pedidos += 1;
        existing.total += pedido.total;
        existing.ticketMedio = existing.total / existing.pedidos;
      } else {
        clienteMapProj.set(pedido.clienteId, {
          cliente: pedido.cliente.nome,
          bairro: pedido.cliente.bairro || "",
          pedidos: 1,
          total: pedido.total,
          ticketMedio: pedido.total,
        });
      }
    }
    const topClientesProjetado = Array.from(clienteMapProj.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // --- Sales by bairro (delivered only) ---
    const bairroMap = new Map<
      string,
      { bairro: string; pedidos: number; total: number }
    >();
    for (const pedido of entregues) {
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

    // --- Sales by bairro projected (entregues + pendentes) ---
    const bairroMapProj = new Map<string, { bairro: string; pedidos: number; total: number }>();
    for (const pedido of [...entregues, ...pedidosPendentesEntrega]) {
      const bairro = pedido.cliente.bairro || "Sem bairro";
      const existing = bairroMapProj.get(bairro);
      if (existing) {
        existing.pedidos += 1;
        existing.total += pedido.total;
      } else {
        bairroMapProj.set(bairro, { bairro, pedidos: 1, total: pedido.total });
      }
    }
    const vendasPorBairroProjetado = Array.from(bairroMapProj.values()).sort(
      (a, b) => b.total - a.total
    );

    // --- Payment method breakdown (delivered only) ---
    const pagamentoMap = new Map<string, { forma: string; pedidos: number; total: number }>();
    for (const pedido of entregues) {
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

    // --- Payment method breakdown projected (entregues + pendentes de entrega) ---
    const pagamentoMapProj = new Map<string, { forma: string; pedidos: number; total: number }>();
    for (const pedido of [...entregues, ...pedidosPendentesEntrega]) {
      const forma = pedido.formaPagamento?.nome || "Não informado";
      const existing = pagamentoMapProj.get(forma);
      if (existing) {
        existing.pedidos += 1;
        existing.total += pedido.total;
      } else {
        pagamentoMapProj.set(forma, { forma, pedidos: 1, total: pedido.total });
      }
    }
    const vendasPorPagamentoProjetado = Array.from(pagamentoMapProj.values()).sort(
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

    // --- Daily breakdown (delivered only) ---
    const vendasPorDia: { data: string; total: number; pedidos: number }[] = [];
    const diaMap = new Map<string, { total: number; pedidos: number }>();
    for (const pedido of entregues) {
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
    const vendasPorMesTodos: { mes: number; mesNome: string; total: number; pedidos: number }[] = [];
    const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    if (periodo === "ano") {
      const mesMap = new Map<number, { total: number; pedidos: number }>();
      for (const pedido of entregues) {
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

      // All active orders per month (excluding cancelled - "projetado")
      const mesMapTodos = new Map<number, { total: number; pedidos: number }>();
      for (const pedido of pedidosAtivos) {
        const month = parseInt(pedido.dataEntrega.split("-")[1]) - 1;
        const existing = mesMapTodos.get(month);
        if (existing) {
          existing.total += pedido.total;
          existing.pedidos += 1;
        } else {
          mesMapTodos.set(month, { total: pedido.total, pedidos: 1 });
        }
      }
      for (let m = 0; m < 12; m++) {
        const vals = mesMapTodos.get(m) || { total: 0, pedidos: 0 };
        vendasPorMesTodos.push({ mes: m, mesNome: mesesNomes[m], ...vals });
      }

      // Previous year monthly (delivered only)
      const mesMapAnterior = new Map<number, { total: number; pedidos: number }>();
      for (const pedido of entreguesAnterior) {
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

    // --- Financial: contas a pagar (filtered by period) ---
    const hoje = new Date().toISOString().slice(0, 10);
    const contasNoPeriodo = await prisma.conta.findMany({
      where: {
        vencimento: { gte: dataInicio, lte: dataFim },
      },
      include: { subcategoriaRef: true },
    });
    const contasPagas = contasNoPeriodo.filter((c) => c.situacao === "Pago");
    const contasPendentes = contasNoPeriodo.filter((c) => c.situacao === "Pendente");
    const contasVencidas = contasPendentes.filter((c) => c.vencimento <= hoje);

    const despesasRealizadas = contasPagas.reduce((a, c) => a + c.valor, 0);
    const contasPendentesNaoVencidas = contasPendentes.filter((c) => c.vencimento > hoje);
    const despesasProjetadas = contasPendentesNaoVencidas.reduce((a, c) => a + c.valor, 0);
    const despesasVencidas = contasVencidas.reduce((a, c) => a + c.valor, 0);

    // --- Category breakdown (with subcategories) ---
    const categoriaMap = new Map<string, { realizado: number; projetado: number; vencido: number; subcategorias: Map<string, { realizado: number; projetado: number; vencido: number }> }>();
    for (const conta of contasNoPeriodo) {
      const cat = conta.categoria || "Sem categoria";
      const subNome = conta.subcategoriaRef?.nome || "";
      const existing = categoriaMap.get(cat) || { realizado: 0, projetado: 0, vencido: 0, subcategorias: new Map() };
      if (conta.situacao === "Pago") {
        existing.realizado += conta.valor;
      } else if (conta.vencimento <= hoje) {
        existing.vencido += conta.valor;
      } else {
        existing.projetado += conta.valor;
      }
      if (subNome) {
        const subExisting = existing.subcategorias.get(subNome) || { realizado: 0, projetado: 0, vencido: 0 };
        if (conta.situacao === "Pago") {
          subExisting.realizado += conta.valor;
        } else if (conta.vencimento <= hoje) {
          subExisting.vencido += conta.valor;
        } else {
          subExisting.projetado += conta.valor;
        }
        existing.subcategorias.set(subNome, subExisting);
      }
      categoriaMap.set(cat, existing);
    }
    const despesasPorCategoria = Array.from(categoriaMap.entries())
      .map(([categoria, vals]) => ({
        categoria,
        realizado: vals.realizado,
        projetado: vals.projetado,
        vencido: vals.vencido,
        subcategorias: Array.from(vals.subcategorias.entries())
          .map(([nome, sub]) => ({ nome, realizado: sub.realizado, projetado: sub.projetado, vencido: sub.vencido }))
          .sort((a, b) => (b.realizado + b.projetado + b.vencido) - (a.realizado + a.projetado + a.vencido)),
      }))
      .sort((a, b) => (b.realizado + b.projetado + b.vencido) - (a.realizado + a.projetado + a.vencido));

    // --- Despesas por mês (only in "ano" period) ---
    const despesasPorMes: { mes: number; mesNome: string; pagas: number; pendentes: number }[] = [];
    if (periodo === "ano") {
      const desMesMap = new Map<number, { pagas: number; pendentes: number }>();
      for (const conta of contasNoPeriodo) {
        const month = parseInt(conta.vencimento.split("-")[1]) - 1;
        const existing = desMesMap.get(month) || { pagas: 0, pendentes: 0 };
        if (conta.situacao === "Pago") existing.pagas += conta.valor;
        else existing.pendentes += conta.valor;
        desMesMap.set(month, existing);
      }
      for (let m = 0; m < 12; m++) {
        const vals = desMesMap.get(m) || { pagas: 0, pendentes: 0 };
        despesasPorMes.push({ mes: m, mesNome: mesesNomes[m], ...vals });
      }
    }

    // --- Inadimplência GLOBAL (sem filtro de período) ---
    // Busca todos os pedidos entregues, não pagos, com data de entrega passada
    const pedidosInadimplentes = await prisma.pedido.findMany({
      where: {
        statusEntrega: "Entregue",
        situacaoPagamento: { not: "Pago" },
        dataEntrega: { lt: hoje },
      },
      include: { cliente: true },
    });
    const inadimplentesGlobal = pedidosInadimplentes
      .map((p) => {
        const diffMs = new Date(hoje + "T12:00:00").getTime() - new Date(p.dataEntrega + "T12:00:00").getTime();
        const diasAtraso = Math.round(diffMs / 86400000);
        return {
          pedidoId: p.id,
          clienteId: p.clienteId,
          cliente: p.cliente.nome,
          bairro: p.cliente.bairro || "",
          valor: p.total,
          dataEntrega: p.dataEntrega,
          diasAtraso,
        };
      })
      .sort((a, b) => b.diasAtraso - a.diasAtraso);
    const totalInadimplente = inadimplentesGlobal.reduce((a, p) => a + p.valor, 0);

    const financeiro = {
      receita: totalVendido,
      recebido: totalRecebido,
      aReceber: totalPendente,
      despesas: despesasRealizadas + despesasProjetadas + despesasVencidas,
      despesasPagas: despesasRealizadas,
      despesasPendentes: despesasProjetadas,
      despesasVencidas,
      despesasRealizadas,
      despesasProjetadas,
      lucroEstimado: totalVendido - (despesasRealizadas + despesasProjetadas + despesasVencidas),
      fluxoCaixa: totalRecebido - despesasRealizadas,
      receitaProjetada: totalVendasProjetado,
      aEntregarValor: totalAEntregarValor,
      aCobrar: totalACobrar,
      fluxoCaixaProjetado: totalVendasProjetado - (despesasRealizadas + despesasProjetadas + despesasVencidas),
      lucroEstimadoProjetado: totalVendasProjetado - (despesasRealizadas + despesasProjetadas + despesasVencidas),
      contasPendentesQtd: contasPendentesNaoVencidas.length,
      contasVencidasQtd: contasVencidas.length,
      despesasPorCategoria,
      despesasPorMes,
    };

    const inadimplencia = {
      total: totalInadimplente,
      quantidade: inadimplentesGlobal.length,
      clientes: inadimplentesGlobal,
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
      totalEntregues,
      totalVendido,
      totalRecebido,
      totalPendente,
      totalTaxaEntrega,
      ticketMedio,
      totalPedidosProjetado,
      totalVendasProjetado,
      totalAEntregarValor,
      totalACobrar,
      ticketMedioProjetado,
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
      vendasPorProdutoProjetado,
      topClientes,
      topClientesProjetado,
      vendasPorBairro,
      vendasPorBairroProjetado,
      vendasPorPagamento,
      vendasPorPagamentoProjetado,
      statusEntregas: statusMap,
      vendasPorDia,
      vendasPorMes,
      vendasPorMesAnterior,
      vendasPorMesTodos,
      financeiro,
      inadimplencia,
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
