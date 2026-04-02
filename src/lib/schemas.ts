import { z } from "zod";

// ─── Reusable primitives ────────────────────────────────────────────────

const str = (max = 500) => z.string().max(max);
const reqStr = (max = 500) => str(max).min(1);
const optStr = (max = 500) => str(max).optional().default("");
const posInt = () => z.number().int().positive();
const posFloat = () => z.number().positive();
const dateStr = () =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (YYYY-MM-DD)");
const optDateStr = () => dateStr().optional().nullable();
const idParam = () =>
  z.string().transform((v) => {
    const n = parseInt(v, 10);
    if (isNaN(n) || n <= 0) throw new Error("ID inválido");
    return n;
  });

// ─── Cliente ────────────────────────────────────────────────────────────

export const clienteCreateSchema = z.object({
  nome: reqStr(200),
  telefone: optStr(20),
  cep: optStr(10),
  rua: optStr(200),
  numero: optStr(20),
  bairro: optStr(100),
  cidade: optStr(100),
  enderecoAlternativo: optStr(500),
  observacoes: optStr(1000),
});

export const clienteUpdateSchema = clienteCreateSchema.partial();

// ─── Produto ────────────────────────────────────────────────────────────

export const tipoEstoque = z.enum(["diario", "estoque"]);
export const unidadeVenda = z.enum(["unidade", "kg", "caixa", "bandeja"]);

export const classeEnum = z.enum(["A", "B", "C"]);

export const produtoCreateSchema = z.object({
  nome: reqStr(200),
  preco: posFloat(),
  classe: classeEnum.optional().nullable(),
  tipoEstoque: tipoEstoque.optional().default("diario"),
  pesoUnitarioGramas: z.number().min(0).optional().nullable(),
  estoqueMinimo: z.number().int().min(0).optional().default(0),
  estoqueAtual: z.number().int().min(0).optional().default(0),
  unidadeVenda: unidadeVenda.optional().default("unidade"),
});

export const produtoUpdateSchema = produtoCreateSchema.partial();

// ─── Promoção ───────────────────────────────────────────────────────────

export const tipoPromocao = z.enum([
  "desconto",
  "leve_x_pague_y",
  "quantidade_minima",
  "compra_parceira",
]);

export const promocaoCreateSchema = z.object({
  nome: reqStr(200),
  produtoId: posInt(),
  tipo: tipoPromocao.default("desconto"),
  precoPromocional: z.number().min(0).default(0),
  leveQuantidade: z.number().int().min(0).optional().nullable(),
  pagueQuantidade: z.number().int().min(0).optional().nullable(),
  quantidadeMinima: z.number().int().min(0).optional().nullable(),
  produtoId2: z.number().int().positive().optional().nullable(),
  dataInicio: dateStr(),
  dataFim: dateStr(),
  ativo: z.boolean().default(true),
});

export const promocaoUpdateSchema = promocaoCreateSchema.partial();

// ─── Pedido ─────────────────────────────────────────────────────────────

export const situacaoPagamento = z.enum(["Pendente", "Pago"]);
export const statusEntrega = z.enum(["Pendente", "Em rota", "Entregue", "Cancelado"]);

export const pedidoItemInput = z.object({
  produtoId: posInt(),
  quantidade: z.number().positive(),
  precoUnitario: z.number().min(0).optional(),
  subtotal: z.number().min(0).optional(),
});

export const pedidoCreateSchema = z.object({
  clienteId: posInt(),
  dataEntrega: dateStr().optional(),
  formaPagamentoId: z.number().int().positive().optional().nullable(),
  observacoes: optStr(1000),
  taxaEntrega: z.number().min(0).optional().default(0),
  itens: z.array(pedidoItemInput).min(1, "Pedido deve ter ao menos um item"),
});

export const pedidoUpdateSchema = z.object({
  clienteId: posInt().optional(),
  dataEntrega: dateStr().optional(),
  formaPagamentoId: z.number().int().positive().optional().nullable(),
  observacoes: str(1000).optional(),
  taxaEntrega: z.number().min(0).optional(),
  situacaoPagamento: situacaoPagamento.optional(),
  statusEntrega: statusEntrega.optional(),
  valorPago: z.number().min(0).optional(),
  ordemRota: z.number().int().min(0).optional().nullable(),
  itens: z.array(pedidoItemInput).min(1).optional(),
  updatedAt: z.string().optional(),
});

export const pedidoBulkSchema = z.object({
  ids: z.array(posInt()).min(1, "IDs são obrigatórios"),
  action: z.enum([
    "entregue",
    "pago",
    "cancelado",
    "pendente_entrega",
    "pendente_pagamento",
  ]),
  dataEntrega: dateStr().optional(),
});

// ─── Conta ──────────────────────────────────────────────────────────────

export const contaCreateSchema = z.object({
  fornecedorId: z.number().int().positive().optional().nullable(),
  fornecedorNome: optStr(200),
  categoria: optStr(100),
  categoriaId: z.number().int().positive().optional().nullable(),
  subcategoriaId: z.number().int().positive().optional().nullable(),
  tipoFinanceiro: optStr(50),
  valor: z.number(),
  vencimento: dateStr(),
  situacao: str(50).optional().default("Pendente"),
  parcelas: z.number().int().min(1).optional().default(1),
  parcelaNumero: z.number().int().min(1).optional().default(1),
  parcelaGrupoId: z.number().int().positive().optional().nullable(),
});

export const contaUpdateSchema = z.object({
  fornecedorId: z.number().int().positive().optional().nullable(),
  fornecedorNome: str(200).optional(),
  categoria: str(100).optional(),
  categoriaId: z.number().int().positive().optional().nullable(),
  subcategoriaId: z.number().int().positive().optional().nullable(),
  tipoFinanceiro: str(50).optional(),
  valor: z.number().optional(),
  vencimento: dateStr().optional(),
  situacao: str(50).optional(),
  parcelas: z.number().int().min(1).optional(),
  parcelaNumero: z.number().int().min(1).optional(),
  parcelaGrupoId: z.number().int().positive().optional().nullable(),
  updatedAt: z.string().optional(),
});

// ─── Fornecedor ─────────────────────────────────────────────────────────

export const fornecedorSchema = z.object({
  nome: reqStr(200),
});

// ─── Categoria / Subcategoria ───────────────────────────────────────────

export const categoriaSchema = z.object({
  nome: reqStr(100),
});

export const subcategoriaCreateSchema = z.object({
  nome: reqStr(100),
  categoriaId: posInt(),
});

// ─── Recorrente ─────────────────────────────────────────────────────────

export const recorrenteItemInput = z.object({
  produtoId: posInt(),
  quantidade: z.number().positive(),
  precoManual: z.number().min(0).optional().nullable(),
});

export const recorrenteCreateSchema = z.object({
  clienteId: posInt(),
  formaPagamentoId: z.number().int().positive().optional().nullable(),
  diasSemana: reqStr(20),
  dataInicio: dateStr(),
  dataFim: optDateStr(),
  taxaEntrega: z.number().min(0).optional().default(0),
  observacoes: optStr(1000),
  skipDate: dateStr().optional().nullable(),
  itens: z.array(recorrenteItemInput).min(1, "Deve ter ao menos um item"),
});

export const recorrenteUpdateSchema = recorrenteCreateSchema.partial().extend({
  ativo: z.boolean().optional(),
});

// ─── Locais Frequentes ──────────────────────────────────────────────────

export const localFrequenteSchema = z.object({
  nome: reqStr(200),
  endereco: optStr(500),
  plusCode: optStr(50),
});

// ─── Mensagens WhatsApp ─────────────────────────────────────────────────

export const mensagemWhatsAppSchema = z.object({
  nome: reqStr(200),
  texto: reqStr(2000),
});

// ─── Configurações ──────────────────────────────────────────────────────

export const configuracaoSchema = z.object({
  chave: reqStr(100),
  valor: reqStr(2000),
});

// ─── Colheita ──────────────────────────────────────────────────────────

export const colheitaCreateSchema = z.object({
  produtoId: posInt(),
  quantidade: z.number().min(0),
  data: dateStr().optional(),
  observacao: str(500).optional().nullable(),
});

// ─── Movimentação de Estoque ───────────────────────────────────────────

export const tipoMovimentacao = z.enum([
  "colheita", "entrada", "pedido", "congelamento", "consumo", "descarte", "ajuste",
]);

export const movimentacaoCreateSchema = z.object({
  produtoId: posInt(),
  tipo: tipoMovimentacao,
  quantidade: z.number(),
  unidade: z.enum(["un", "kg"]).optional().default("un"),
  lote: str(50).optional().nullable(),
  motivo: str(500).optional().nullable(),
  referencia: str(100).optional().nullable(),
  data: dateStr().optional(),
});

// ─── Congelamento ──────────────────────────────────────────────────────

export const congelamentoCreateSchema = z.object({
  produtoFrescoId: posInt(),
  produtoCongeladoId: posInt(),
  quantidadeKg: z.number().positive(),
  perdaKg: z.number().min(0).optional().default(0),
  data: dateStr().optional(),
  observacao: str(500).optional().nullable(),
});

// ─── Helpers ────────────────────────────────────────────────────────────

export { idParam };

export type ClienteCreate = z.infer<typeof clienteCreateSchema>;
export type ProdutoCreate = z.infer<typeof produtoCreateSchema>;
export type PedidoCreate = z.infer<typeof pedidoCreateSchema>;
export type PedidoUpdate = z.infer<typeof pedidoUpdateSchema>;
export type PedidoItemInput = z.infer<typeof pedidoItemInput>;
export type PedidoBulk = z.infer<typeof pedidoBulkSchema>;
export type ContaCreate = z.infer<typeof contaCreateSchema>;
export type PromocaoCreate = z.infer<typeof promocaoCreateSchema>;
export type RecorrenteCreate = z.infer<typeof recorrenteCreateSchema>;
export type RecorrenteItemInput = z.infer<typeof recorrenteItemInput>;
export type ColheitaCreate = z.infer<typeof colheitaCreateSchema>;
export type MovimentacaoCreate = z.infer<typeof movimentacaoCreateSchema>;
export type CongelamentoCreate = z.infer<typeof congelamentoCreateSchema>;
