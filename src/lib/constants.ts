// ─── Status constants ───────────────────────────────────────────────────

export const SITUACAO_PAGAMENTO = ["Pendente", "Pago"] as const;
export const STATUS_ENTREGA = ["Pendente", "Em rota", "Entregue", "Cancelado"] as const;

export type SituacaoPagamento = (typeof SITUACAO_PAGAMENTO)[number];
export type StatusEntrega = (typeof STATUS_ENTREGA)[number];

// ─── Prisma includes ────────────────────────────────────────────────────

export const PEDIDO_INCLUDE = {
  cliente: true,
  formaPagamento: true,
  itens: { include: { produto: true } },
} as const;

export const RECORRENTE_INCLUDE = {
  cliente: true,
  formaPagamento: true,
  itens: { include: { produto: true } },
  _count: { select: { pedidosGerados: true } },
} as const;
