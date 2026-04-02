import { prisma } from "@/lib/prisma";
import type { PedidoItemInput } from "@/lib/schemas";
import { todayStr, addDays, dateToStr } from "@/lib/formatting";

interface ProcessedItem {
  produtoId: number;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

/**
 * Process order items: resolve product prices, apply active promotions.
 * Returns processed items with calculated subtotals.
 */
export async function processOrderItems(
  itens: PedidoItemInput[],
  dataEntrega?: string
): Promise<{ itensProcessados: ProcessedItem[]; total: number; taxaEntrega?: number }> {
  const hoje = dataEntrega || todayStr();
  const produtoIds = itens.map((i) => i.produtoId);

  const [allProdutos, allPromocoes] = await Promise.all([
    prisma.produto.findMany({ where: { id: { in: produtoIds } } }),
    prisma.promocao.findMany({
      where: {
        produtoId: { in: produtoIds },
        ativo: true,
        dataInicio: { lte: hoje },
        dataFim: { gte: hoje },
      },
    }),
  ]);

  const produtoMap = new Map(allProdutos.map((p) => [p.id, p]));
  // Group all promotions by product (supports multiple promos per product)
  const promocoesMap = new Map<number, typeof allPromocoes>();
  for (const p of allPromocoes) {
    const list = promocoesMap.get(p.produtoId) ?? [];
    list.push(p);
    promocoesMap.set(p.produtoId, list);
  }

  const itensProcessados: ProcessedItem[] = itens.map((item) => {
    // If a non-zero precoUnitario override is provided, use it directly
    if (item.precoUnitario !== undefined && item.precoUnitario !== 0) {
      return {
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        subtotal: item.precoUnitario * item.quantidade,
      };
    }

    const produtoId = item.produtoId;
    const promos = promocoesMap.get(produtoId) ?? [];
    const produto = produtoMap.get(produtoId);
    const precoBase = produto?.preco ?? 0;

    // For quantidade_minima: find the best matching tier (highest quantidadeMinima that item qualifies for)
    const bestQuantidadeMinima = promos
      .filter((p) => p.tipo === "quantidade_minima" && p.quantidadeMinima != null && item.quantidade >= p.quantidadeMinima)
      .sort((a, b) => (b.quantidadeMinima ?? 0) - (a.quantidadeMinima ?? 0))[0] ?? null;

    // Priority: quantidade_minima (best tier) > desconto > leve_x_pague_y
    // compra_parceira is handled in second pass, not here
    const promocao = bestQuantidadeMinima
      ?? promos.find((p) => p.tipo === "desconto")
      ?? promos.find((p) => p.tipo === "leve_x_pague_y")
      ?? null;

    let precoUnitario: number;
    let subtotal: number;

    if (promocao && promocao.tipo === "leve_x_pague_y") {
      const leveQuantidade = promocao.leveQuantidade ?? 0;
      const pagueQuantidade = promocao.pagueQuantidade ?? 0;
      precoUnitario = precoBase;

      if (leveQuantidade > 0 && pagueQuantidade > 0) {
        const gruposCompletos = Math.floor(item.quantidade / leveQuantidade);
        const resto = item.quantidade % leveQuantidade;
        const qtdCobrada = gruposCompletos * pagueQuantidade + resto;
        subtotal = qtdCobrada * precoUnitario;
      } else {
        subtotal = precoUnitario * item.quantidade;
      }
    } else if (promocao && promocao.tipo === "quantidade_minima") {
      const min = promocao.quantidadeMinima ?? 0;
      precoUnitario =
        min > 0 && item.quantidade >= min ? promocao.precoPromocional : precoBase;
      subtotal = precoUnitario * item.quantidade;
    } else if (promocao && promocao.tipo === "compra_parceira") {
      // Bundle: handled in second pass
      precoUnitario = precoBase;
      subtotal = precoUnitario * item.quantidade;
    } else if (promocao && (promocao.tipo === "desconto" || promocao.precoPromocional)) {
      precoUnitario = promocao.precoPromocional;
      subtotal = precoUnitario * item.quantidade;
    } else {
      precoUnitario = precoBase;
      subtotal = precoUnitario * item.quantidade;
    }

    return { produtoId, quantidade: item.quantidade, precoUnitario, subtotal };
  });

  // Second pass: apply "compra_parceira" (bundle) promotions
  // NOTE: Existing DB records may still have tipo="compra_casada". A data migration is needed
  // to update those records to "compra_parceira".
  const produtoIdSet = new Set(produtoIds);
  for (const promocao of allPromocoes) {
    if (promocao.tipo !== "compra_parceira" || !promocao.produtoId2) continue;
    if (!produtoIdSet.has(promocao.produtoId)) continue;
    const targetItem = itensProcessados.find((i) => i.produtoId === promocao.produtoId2);
    if (!targetItem) continue;
    targetItem.precoUnitario = promocao.precoPromocional;
    targetItem.subtotal = promocao.precoPromocional * targetItem.quantidade;
  }

  const total = itensProcessados.reduce((acc, item) => acc + item.subtotal, 0);

  return { itensProcessados, total };
}

/**
 * Generate recurring orders for a date range.
 */
export async function generateRecurringOrders(opts: {
  recorrenteId: number;
  clienteId: number;
  formaPagamentoId: number | null;
  diasSemana: string;
  dataInicio: string;
  dataFim: string;
  taxaEntrega: number;
  observacoes: string;
  itens: Array<{
    produtoId: number;
    quantidade: number;
    precoManual: number | null;
    produto: { preco: number };
  }>;
  skipDate?: string | null;
}): Promise<number> {
  const diasArr = opts.diasSemana.split(",").map(Number);
  const inicio = new Date(opts.dataInicio + "T12:00:00");
  const fim = new Date(opts.dataFim + "T12:00:00");

  // Collect all target dates first
  const targetDates: string[] = [];
  const current = new Date(inicio);
  while (current <= fim) {
    if (diasArr.includes(current.getDay())) {
      const dateStr = dateToStr(current);
      if (!(opts.skipDate && dateStr === opts.skipDate)) {
        targetDates.push(dateStr);
      }
    }
    current.setDate(current.getDate() + 1);
  }

  if (targetDates.length === 0) return 0;

  // All-or-nothing: create all recurring orders in a single transaction
  return prisma.$transaction(async (tx) => {
    let pedidosCriados = 0;

    // Batch check which dates already have orders
    const existingPedidos = await tx.pedido.findMany({
      where: { recorrenteId: opts.recorrenteId, dataEntrega: { in: targetDates } },
      select: { dataEntrega: true },
    });
    const existingDates = new Set(existingPedidos.map((p) => p.dataEntrega));

    for (const dateStr of targetDates) {
      if (existingDates.has(dateStr)) continue;

      const pedidoItens = opts.itens.map((item) => {
        const preco = item.precoManual ?? item.produto.preco;
        return {
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          precoUnitario: preco,
          subtotal: preco * item.quantidade,
        };
      });

      const totalItens = pedidoItens.reduce((a, i) => a + i.subtotal, 0);
      const total = totalItens + opts.taxaEntrega;

      await tx.pedido.create({
        data: {
          clienteId: opts.clienteId,
          dataPedido: dateStr,
          dataEntrega: dateStr,
          formaPagamentoId: opts.formaPagamentoId,
          total,
          valorPago: 0,
          situacaoPagamento: "Pendente",
          statusEntrega: "Pendente",
          taxaEntrega: opts.taxaEntrega,
          observacoes: opts.observacoes
            ? `[Recorrente] ${opts.observacoes}`
            : "[Recorrente]",
          recorrenteId: opts.recorrenteId,
          itens: { create: pedidoItens },
        },
      });
      pedidosCriados++;
    }

    return pedidosCriados;
  });
}

/** @deprecated Use addDays from @/lib/formatting instead */
export const addDaysStr = addDays;
