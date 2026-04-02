import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";

// ── Types ──

export interface EstoqueDiaItem {
  produtoId: number;
  nome: string;
  classe?: string | null;
  tipoEstoque: string;
  colhidoHoje?: number;
  vendidoHoje?: number;
  reservadoHoje?: number;
  disponivel: number;
  estoqueAtual?: number;
  estoqueMinimo?: number;
  alertaEstoqueBaixo?: boolean;
  unidadeVenda: string;
  pesoUnitarioGramas: number | null;
}

export interface AlertaEstoque {
  produtoId: number;
  nome: string;
  estoqueAtual: number;
  estoqueMinimo: number;
  nivel: "zerado" | "baixo";
}

export interface CongelamentoInput {
  produtoFrescoId: number;
  produtoCongeladoId: number;
  quantidadeKg: number;
  perdaKg?: number | null;
  data?: string | null;
  observacao?: string | null;
}

export interface MovimentacaoInput {
  produtoId: number;
  tipo: string;
  quantidade: number;
  unidade?: string | null;
  lote?: string | null;
  motivo?: string | null;
  referencia?: string | null;
  data?: string | null;
}

export interface ColheitaInput {
  produtoId: number;
  quantidade: number;
  data?: string | null;
  observacao?: string | null;
}

// ── Estoque do Dia ──

/**
 * Calcula a visão consolidada do estoque para uma data.
 * Agrega colheitas, vendas, reservas e saídas manuais para produtos diários,
 * e retorna estoque atual para produtos de estoque.
 */
export async function calcularEstoqueDia(data: string): Promise<EstoqueDiaItem[]> {
  const produtos = await prisma.produto.findMany({ orderBy: { nome: "asc" } });
  const produtoMap = new Map(produtos.map((p) => [p.id, p]));

  // Queries 2-5 em paralelo (independentes após ter produtos)
  const [colheitas, pedidosTodos, saidasDiarias] = await Promise.all([
    prisma.colheita.findMany({ where: { data } }),
    // Merge entregues + pendentes numa query só
    prisma.pedido.findMany({
      where: { dataEntrega: data, statusEntrega: { in: ["Entregue", "Pendente", "Em rota"] } },
      include: { itens: true },
    }),
    prisma.movimentacaoEstoque.findMany({
      where: { data, tipo: { in: ["congelamento", "descarte", "consumo"] } },
    }),
  ]);

  const colheitaMap = aggregateByProduto(colheitas, (c) => c.quantidade);

  // Separar entregues e pendentes em memória
  const pedidosEntregues = pedidosTodos.filter((p) => p.statusEntrega === "Entregue");
  const pedidosPendentes = pedidosTodos.filter((p) => p.statusEntrega !== "Entregue");
  const vendidoMap = aggregateItensToKg(pedidosEntregues, produtoMap);
  const reservadoMap = aggregateItensToKg(pedidosPendentes, produtoMap);
  const saidaManualMap = new Map<number, number>();
  for (const mov of saidasDiarias) {
    const prod = produtoMap.get(mov.produtoId);
    if (prod?.tipoEstoque === "diario") {
      saidaManualMap.set(mov.produtoId, (saidaManualMap.get(mov.produtoId) || 0) + Math.abs(mov.quantidade));
    }
  }

  return produtos.map((prod) => {
    if (prod.tipoEstoque === "diario") {
      const colhido = colheitaMap.get(prod.id) || 0;
      const vendido = vendidoMap.get(prod.id) || 0;
      const reservado = reservadoMap.get(prod.id) || 0;
      const saidaManual = saidaManualMap.get(prod.id) || 0;
      return {
        produtoId: prod.id,
        nome: prod.nome,
        classe: prod.classe,
        tipoEstoque: "diario",
        colhidoHoje: colhido,
        vendidoHoje: vendido,
        reservadoHoje: reservado,
        disponivel: colhido - vendido - reservado - saidaManual,
        unidadeVenda: prod.unidadeVenda,
        pesoUnitarioGramas: prod.pesoUnitarioGramas,
      };
    } else {
      return {
        produtoId: prod.id,
        nome: prod.nome,
        tipoEstoque: "estoque",
        estoqueAtual: prod.estoqueAtual,
        estoqueMinimo: prod.estoqueMinimo,
        disponivel: prod.estoqueAtual,
        alertaEstoqueBaixo: prod.estoqueMinimo > 0 && prod.estoqueAtual <= prod.estoqueMinimo,
        unidadeVenda: prod.unidadeVenda,
        pesoUnitarioGramas: prod.pesoUnitarioGramas,
      };
    }
  });
}

// ── Alertas ──

/**
 * Retorna alertas de estoque baixo/zerado para produtos tipo "estoque".
 */
export async function getAlertasEstoque(): Promise<AlertaEstoque[]> {
  const produtos = await prisma.produto.findMany({
    where: { tipoEstoque: "estoque", estoqueMinimo: { gt: 0 } },
  });

  const alertas: AlertaEstoque[] = [];
  for (const p of produtos) {
    if (p.estoqueAtual === 0) {
      alertas.push({ produtoId: p.id, nome: p.nome, estoqueAtual: p.estoqueAtual, estoqueMinimo: p.estoqueMinimo, nivel: "zerado" });
    } else if (p.estoqueAtual <= p.estoqueMinimo) {
      alertas.push({ produtoId: p.id, nome: p.nome, estoqueAtual: p.estoqueAtual, estoqueMinimo: p.estoqueMinimo, nivel: "baixo" });
    }
  }
  return alertas;
}

// ── Congelamento ──

/**
 * Registra congelamento: gera movimentações de saída (fresco), entrada (congelado),
 * e opcionalmente descarte (perda), todas no mesmo lote.
 */
export async function registrarCongelamento(input: CongelamentoInput) {
  const data = input.data ?? new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const perdaKg = input.perdaKg ?? 0;

  return prisma.$transaction(async (tx) => {
    // Validar produtos dentro da transação
    const [fresco, congelado] = await Promise.all([
      tx.produto.findUnique({ where: { id: input.produtoFrescoId } }),
      tx.produto.findUnique({ where: { id: input.produtoCongeladoId } }),
    ]);
    if (!fresco) throw new ApiError("Produto fresco não encontrado.", 404);
    if (!congelado) throw new ApiError("Produto congelado não encontrado.", 404);
    if (congelado.tipoEstoque !== "estoque") {
      throw new ApiError("Produto congelado deve ser do tipo 'estoque'.", 400);
    }

    // Calcular unidades congeladas (descontando perda)
    const pesoKgPorUnidade = congelado.pesoUnitarioGramas ? congelado.pesoUnitarioGramas / 1000 : 1;
    const kgUtil = input.quantidadeKg - perdaKg;
    const unidadesCongeladas = Math.floor(kgUtil / pesoKgPorUnidade);
    if (unidadesCongeladas <= 0) {
      throw new ApiError("Quantidade insuficiente para gerar pelo menos 1 unidade congelada (após descontar perda).", 400);
    }

    // Gerar número de lote sequencial dentro da transação
    const lote = await gerarProximoLote(tx);
    // 1. Saída do fresco (em kg)
    const movSaida = await tx.movimentacaoEstoque.create({
      data: {
        produtoId: input.produtoFrescoId,
        tipo: "congelamento",
        quantidade: -input.quantidadeKg,
        unidade: "kg",
        lote,
        saldoInicial: 0,
        saldoFinal: 0,
        motivo: input.observacao || `Congelamento ${lote}`,
        data,
        criadoEm: now,
      },
    });

    // 2. Entrada do congelado (em unidades)
    const saldoInicial = congelado.estoqueAtual;
    const saldoFinal = saldoInicial + unidadesCongeladas;
    const movEntrada = await tx.movimentacaoEstoque.create({
      data: {
        produtoId: input.produtoCongeladoId,
        tipo: "congelamento",
        quantidade: unidadesCongeladas,
        unidade: "un",
        lote,
        saldoInicial,
        saldoFinal,
        motivo: "auto",
        data,
        criadoEm: now,
      },
    });

    // 3. Atualizar estoque do congelado
    await tx.produto.update({
      where: { id: input.produtoCongeladoId },
      data: { estoqueAtual: { increment: unidadesCongeladas } },
    });

    // 4. Registrar perda/descarte (se houver)
    let movPerda = null;
    if (perdaKg > 0) {
      movPerda = await tx.movimentacaoEstoque.create({
        data: {
          produtoId: input.produtoFrescoId,
          tipo: "descarte",
          quantidade: -perdaKg,
          unidade: "kg",
          lote,
          saldoInicial: 0,
          saldoFinal: 0,
          motivo: `Perda no congelamento ${lote}`,
          data,
          criadoEm: now,
        },
      });
    }

    return { lote, saida: movSaida, entrada: movEntrada, perda: movPerda, unidadesCongeladas, perdaKg };
  });
}

// ── Movimentação Manual ──

/**
 * Registra movimentação manual de estoque com validação de saldo
 * e atualização automática de estoqueAtual para produtos tipo "estoque".
 */
export async function registrarMovimentacao(input: MovimentacaoInput) {
  const data = input.data ?? new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  // Determinar sinal da quantidade
  let qty = input.quantidade;
  if (["pedido", "consumo", "descarte"].includes(input.tipo)) {
    qty = -Math.abs(qty);
  } else if (input.tipo === "entrada" || input.tipo === "colheita") {
    qty = Math.abs(qty);
  }

  return prisma.$transaction(async (tx) => {
    // Ler produto dentro da transação para check atômico
    const produto = await tx.produto.findUnique({ where: { id: input.produtoId } });
    if (!produto) throw new ApiError("Produto não encontrado.", 404);

    // Verificar estoque para saídas em produtos tipo "estoque"
    if (produto.tipoEstoque === "estoque" && qty < 0 && produto.estoqueAtual + qty < 0) {
      throw new ApiError(`Estoque insuficiente. Atual: ${produto.estoqueAtual}, solicitado: ${Math.abs(qty)}`, 409);
    }

    const saldoInicial = produto.estoqueAtual;
    const saldoFinal = saldoInicial + qty;

    const mov = await tx.movimentacaoEstoque.create({
      data: {
        produtoId: input.produtoId,
        tipo: input.tipo,
        quantidade: qty,
        unidade: input.unidade || "un",
        lote: input.lote,
        saldoInicial,
        saldoFinal,
        motivo: input.motivo,
        referencia: input.referencia,
        data,
        criadoEm: now,
      },
      include: { produto: true },
    });

    if (produto.tipoEstoque === "estoque") {
      await tx.produto.update({
        where: { id: input.produtoId },
        data: { estoqueAtual: { increment: qty } },
      });
    }

    return mov;
  });
}

// ── Colheita ──

/**
 * Registra/atualiza colheita diária (upsert por produto+data).
 * Cria/atualiza MovimentacaoEstoque correspondente em transação.
 */
export async function registrarColheita(input: ColheitaInput) {
  const data = input.data ?? new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  return prisma.$transaction(async (tx) => {
    // Todas as leituras dentro da transação para atomicidade
    const produto = await tx.produto.findUnique({ where: { id: input.produtoId } });
    if (!produto) throw new ApiError("Produto não encontrado.", 404);
    if (produto.tipoEstoque !== "diario") {
      throw new ApiError("Colheita só pode ser registrada para produtos do tipo 'diário'.", 400);
    }

    const [existing, existingMov] = await Promise.all([
      tx.colheita.findFirst({
        where: { produtoId: input.produtoId, data },
      }),
      tx.movimentacaoEstoque.findFirst({
        where: { produtoId: input.produtoId, data, tipo: "colheita" },
      }),
    ]);

    if (input.quantidade <= 0 && existing) {
      // Remover colheita + movimentação
      await tx.colheita.delete({ where: { id: existing.id } });
      if (existingMov) {
        await tx.movimentacaoEstoque.delete({ where: { id: existingMov.id } });
      }
      return null;
    }

    if (existing) {
      // Atualizar colheita existente
      const colheita = await tx.colheita.update({
        where: { id: existing.id },
        data: { quantidade: input.quantidade, observacao: input.observacao ?? existing.observacao },
        include: { produto: true },
      });

      const outrasColheitas = await tx.colheita.findMany({
        where: { produtoId: input.produtoId, data, id: { not: existing.id } },
      });
      const saldoAntes = outrasColheitas.reduce((s, c) => s + c.quantidade, 0);

      if (existingMov) {
        await tx.movimentacaoEstoque.update({
          where: { id: existingMov.id },
          data: {
            quantidade: input.quantidade,
            saldoInicial: saldoAntes,
            saldoFinal: saldoAntes + input.quantidade,
            motivo: input.observacao || "Colheita do dia",
          },
        });
      } else {
        await tx.movimentacaoEstoque.create({
          data: {
            produtoId: input.produtoId, tipo: "colheita", quantidade: input.quantidade,
            unidade: "kg", saldoInicial: saldoAntes, saldoFinal: saldoAntes + input.quantidade,
            motivo: input.observacao || "Colheita do dia",
            referencia: String(colheita.id), data, criadoEm: now,
          },
        });
      }

      return colheita;
    }

    if (input.quantidade > 0) {
      // Criar nova colheita
      const colheita = await tx.colheita.create({
        data: {
          produtoId: input.produtoId, quantidade: input.quantidade,
          data, observacao: input.observacao, criadoEm: now,
        },
        include: { produto: true },
      });

      const outrasColheitas = await tx.colheita.findMany({
        where: { produtoId: input.produtoId, data, id: { not: colheita.id } },
      });
      const saldoAntes = outrasColheitas.reduce((s, c) => s + c.quantidade, 0);

      await tx.movimentacaoEstoque.create({
        data: {
          produtoId: input.produtoId, tipo: "colheita", quantidade: input.quantidade,
          unidade: "kg", saldoInicial: saldoAntes, saldoFinal: saldoAntes + input.quantidade,
          motivo: input.observacao || "Colheita do dia",
          referencia: String(colheita.id), data, criadoEm: now,
        },
      });

      return colheita;
    }

    return null;
  });
}

// ── Helpers internos ──

/** Agrega valores de itens de pedido em kg por produtoId (converte unidades → kg para produtos diários) */
function aggregateItensToKg(
  pedidos: { itens: { produtoId: number; quantidade: number }[] }[],
  produtoMap: Map<number, { tipoEstoque: string; pesoUnitarioGramas: number | null }>
): Map<number, number> {
  const map = new Map<number, number>();
  for (const p of pedidos) {
    for (const item of p.itens) {
      const prod = produtoMap.get(item.produtoId);
      const qtdKg = (prod?.tipoEstoque === "diario" && prod.pesoUnitarioGramas)
        ? (item.quantidade * prod.pesoUnitarioGramas) / 1000
        : item.quantidade;
      map.set(item.produtoId, (map.get(item.produtoId) || 0) + qtdKg);
    }
  }
  return map;
}

/** Agrega registros por produtoId usando uma função extratora */
function aggregateByProduto<T extends { produtoId: number }>(
  items: T[],
  getValue: (item: T) => number
): Map<number, number> {
  const map = new Map<number, number>();
  for (const item of items) {
    map.set(item.produtoId, (map.get(item.produtoId) || 0) + getValue(item));
  }
  return map;
}

/** Gera próximo número de lote sequencial (#C01, #C02, ...) */
async function gerarProximoLote(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<string> {
  const ultimoLote = await tx.movimentacaoEstoque.findFirst({
    where: { lote: { startsWith: "#C" } },
    orderBy: { id: "desc" },
  });
  let num = 1;
  if (ultimoLote?.lote) {
    const match = ultimoLote.lote.match(/#C(\d+)/);
    if (match) num = parseInt(match[1]) + 1;
  }
  return `#C${String(num).padStart(2, "0")}`;
}
