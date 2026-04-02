import type { PrismaClient } from "@prisma/client";
import { checkOptimisticLock, ApiError } from "@/lib/api-helpers";
import { PEDIDO_INCLUDE } from "@/lib/constants";
import type { PedidoItemInput } from "@/lib/schemas";

/** Prisma interactive transaction client (subset of PrismaClient used inside $transaction). */
type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

// ─── Path 1: Update items ─────────────────────────────────────────────

/**
 * Replace all items in a pedido and recalculate total.
 * Must run inside a `prisma.$transaction`.
 */
export async function updatePedidoItens(
  tx: Tx,
  idNum: number,
  itens: PedidoItemInput[],
  pedidoData: Record<string, unknown>,
  bodyUpdatedAt: string | undefined
) {
  const itensTotal = itens.reduce(
    (acc, item) =>
      acc + (item.subtotal ?? item.precoUnitario! * item.quantidade),
    0
  );

  const existing = await tx.pedido.findUnique({
    where: { id: idNum },
    select: { updatedAt: true, taxaEntrega: true },
  });
  const newUpdatedAt = checkOptimisticLock(bodyUpdatedAt, existing?.updatedAt);

  const taxaEntrega =
    (pedidoData.taxaEntrega as number | undefined) ?? existing?.taxaEntrega ?? 0;
  const total = itensTotal + taxaEntrega;

  await tx.pedidoItem.deleteMany({ where: { pedidoId: idNum } });

  return tx.pedido.update({
    where: { id: idNum },
    data: {
      ...pedidoData,
      total,
      updatedAt: newUpdatedAt,
      itens: {
        create: itens.map((item) => ({
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          precoUnitario: item.precoUnitario!,
          subtotal: item.subtotal ?? item.precoUnitario! * item.quantidade,
        })),
      },
    },
    include: PEDIDO_INCLUDE,
  });
}

// ─── Path 2 / DELETE: Revert stock movements ──────────────────────────

/**
 * Reverse all stock movements linked to a pedido (type "pedido").
 * Shared by the revert-from-Entregue path and the DELETE handler.
 * Must run inside a `prisma.$transaction`.
 */
export async function reverterEstoquePedido(tx: Tx, idNum: number) {
  const movs = await tx.movimentacaoEstoque.findMany({
    where: { referencia: String(idNum), tipo: "pedido" },
    include: { produto: true },
  });

  // Aggregate decrements per product (mov.quantidade is negative, so decrement adds back)
  const restores = new Map<number, number>();
  for (const mov of movs) {
    if (mov.produto.tipoEstoque === "estoque") {
      restores.set(mov.produtoId, (restores.get(mov.produtoId) || 0) + mov.quantidade);
    }
  }

  await Promise.all([
    ...Array.from(restores.entries()).map(([produtoId, qty]) =>
      tx.produto.update({ where: { id: produtoId }, data: { estoqueAtual: { decrement: qty } } })
    ),
    tx.movimentacaoEstoque.deleteMany({
      where: { referencia: String(idNum), tipo: "pedido" },
    }),
  ]);
}

// ─── Path 3: Mark as Entregue ─────────────────────────────────────────

/**
 * Mark a pedido as "Entregue": check stock, create movements, debit stock.
 * Must run inside a `prisma.$transaction`.
 */
export async function marcarPedidoEntregue(
  tx: Tx,
  idNum: number,
  pedidoData: Record<string, unknown>,
  bodyUpdatedAt: string | undefined
) {
  // Single read: full pedido + optimistic lock
  const pedidoAtual = await tx.pedido.findUnique({
    where: { id: idNum },
    include: { cliente: true, itens: { include: { produto: true } } },
  });
  if (!pedidoAtual) throw new ApiError("Pedido não encontrado", 404);
  const newUpdatedAt = checkOptimisticLock(bodyUpdatedAt, pedidoAtual.updatedAt);

  // Already delivered — just update fields
  if (pedidoAtual.statusEntrega === "Entregue") {
    return tx.pedido.update({
      where: { id: idNum },
      data: { ...pedidoData, updatedAt: newUpdatedAt },
      include: PEDIDO_INCLUDE,
    });
  }

  // Batch: read all products at once (avoid N+1)
  const produtoIds = [...new Set(pedidoAtual.itens.map((i) => i.produtoId))];
  const produtos = await tx.produto.findMany({
    where: { id: { in: produtoIds } },
  });
  const produtoMap = new Map(produtos.map((p) => [p.id, p]));
  const itensComProduto = pedidoAtual.itens.map((item) => ({
    ...item,
    produto: produtoMap.get(item.produtoId)!,
  }));

  // Check stock sufficiency
  const itensEstoque = itensComProduto.filter(
    (item) => item.produto.tipoEstoque === "estoque"
  );
  const deficit: {
    produto: string;
    necessario: number;
    disponivel: number;
    falta: number;
  }[] = [];
  for (const item of itensEstoque) {
    if (item.produto.estoqueAtual < item.quantidade) {
      deficit.push({
        produto: item.produto.nome,
        necessario: item.quantidade,
        disponivel: item.produto.estoqueAtual,
        falta: item.quantidade - item.produto.estoqueAtual,
      });
    }
  }
  if (deficit.length > 0) {
    throw new ApiError(
      `Estoque insuficiente: ${deficit.map((d) => `${d.produto} (falta ${d.falta})`).join(", ")}`,
      409
    );
  }

  // Batch: pre-load harvests and daily outputs for "diario" items (avoid N+1)
  const itensDiarios = itensComProduto.filter(
    (i) => i.produto.tipoEstoque === "diario"
  );
  const diarioProdutoIds = [
    ...new Set(itensDiarios.map((i) => i.produtoId)),
  ];

  const colheitaMapDia = new Map<number, number>();
  const saidaMapDia = new Map<number, number>();
  if (diarioProdutoIds.length > 0) {
    const [colheitasBatch, saidasBatch] = await Promise.all([
      tx.colheita.findMany({
        where: {
          produtoId: { in: diarioProdutoIds },
          data: pedidoAtual.dataEntrega,
        },
      }),
      tx.movimentacaoEstoque.findMany({
        where: {
          produtoId: { in: diarioProdutoIds },
          data: pedidoAtual.dataEntrega,
          tipo: "pedido",
        },
      }),
    ]);
    for (const c of colheitasBatch) {
      colheitaMapDia.set(
        c.produtoId,
        (colheitaMapDia.get(c.produtoId) || 0) + c.quantidade
      );
    }
    for (const m of saidasBatch) {
      saidaMapDia.set(
        m.produtoId,
        (saidaMapDia.get(m.produtoId) || 0) + Math.abs(m.quantidade)
      );
    }
  }

  // Create stock movements + update stock in parallel
  const now = new Date().toISOString();
  const motivo = `Pedido #${idNum} — ${pedidoAtual.cliente?.nome || ""}`.trim();

  const movimentacoes = itensComProduto.map((item) => {
    if (item.produto.tipoEstoque === "estoque") {
      const saldoInicial = item.produto.estoqueAtual;
      return {
        produtoId: item.produtoId,
        tipo: "pedido" as const,
        quantidade: -item.quantidade,
        unidade: "un",
        saldoInicial,
        saldoFinal: saldoInicial - item.quantidade,
        motivo,
        referencia: String(idNum),
        data: pedidoAtual.dataEntrega,
        criadoEm: now,
      };
    } else {
      const pesoKg = item.produto.pesoUnitarioGramas
        ? (item.quantidade * item.produto.pesoUnitarioGramas) / 1000
        : item.quantidade;
      const unidade = item.produto.pesoUnitarioGramas ? "kg" : "un";
      const colhido = colheitaMapDia.get(item.produtoId) || 0;
      const jaSaiu = saidaMapDia.get(item.produtoId) || 0;
      const saldoInicial = colhido - jaSaiu;
      return {
        produtoId: item.produtoId,
        tipo: "pedido" as const,
        quantidade: -pesoKg,
        unidade,
        saldoInicial,
        saldoFinal: saldoInicial - pesoKg,
        motivo,
        referencia: String(idNum),
        data: pedidoAtual.dataEntrega,
        criadoEm: now,
      };
    }
  });

  // Batch create all movements + batch update stock in parallel
  const stockDecrements = new Map<number, number>();
  for (const item of itensComProduto) {
    if (item.produto.tipoEstoque === "estoque") {
      stockDecrements.set(item.produtoId, (stockDecrements.get(item.produtoId) || 0) + item.quantidade);
    }
  }

  await Promise.all([
    tx.movimentacaoEstoque.createMany({ data: movimentacoes }),
    ...Array.from(stockDecrements.entries()).map(([produtoId, qty]) =>
      tx.produto.update({ where: { id: produtoId }, data: { estoqueAtual: { decrement: qty } } })
    ),
  ]);

  return tx.pedido.update({
    where: { id: idNum },
    data: { ...pedidoData, updatedAt: newUpdatedAt },
    include: PEDIDO_INCLUDE,
  });
}

// ─── Path 4: Simple update ────────────────────────────────────────────

/**
 * Update pedido fields (no item changes, no stock operations).
 * Must run inside a `prisma.$transaction`.
 */
export async function updatePedidoSimples(
  tx: Tx,
  idNum: number,
  pedidoData: Record<string, unknown>,
  bodyUpdatedAt: string | undefined
) {
  const lockCheck = await tx.pedido.findUnique({
    where: { id: idNum },
    select: { updatedAt: true },
  });
  const newUpdatedAt = checkOptimisticLock(bodyUpdatedAt, lockCheck?.updatedAt);

  return tx.pedido.update({
    where: { id: idNum },
    data: { ...pedidoData, updatedAt: newUpdatedAt },
    include: PEDIDO_INCLUDE,
  });
}
