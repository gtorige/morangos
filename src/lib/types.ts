// ─── Shared frontend model types ────────────────────────────────────────
// These match the API response shapes (Prisma models + includes).

export interface Cliente {
  id: number;
  nome: string;
  telefone: string;
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  enderecoAlternativo: string;
  observacoes: string;
}

export interface Produto {
  id: number;
  nome: string;
  preco: number;
  tipoEstoque: string;
  pesoUnitarioGramas: number | null;
  estoqueMinimo: number;
  estoqueAtual: number;
  unidadeVenda: string;
}

export interface Colheita {
  id: number;
  produtoId: number;
  produto?: Produto;
  quantidade: number;
  data: string;
  observacao: string | null;
  criadoEm: string;
}

export interface MovimentacaoEstoque {
  id: number;
  produtoId: number;
  produto?: Produto;
  tipo: string;
  quantidade: number;
  unidade: string;
  lote: string | null;
  saldoInicial: number;
  saldoFinal: number;
  motivo: string | null;
  referencia: string | null;
  data: string;
  criadoEm: string;
}

export interface EstoqueDia {
  produtoId: number;
  nome: string;
  tipoEstoque: string;
  colhidoHoje?: number;
  vendidoHoje?: number;
  estoqueAtual?: number;
  estoqueMinimo?: number;
  disponivel: number;
  alertaEstoqueBaixo?: boolean;
  unidadeVenda: string;
  pesoUnitarioGramas?: number | null;
}

export interface FormaPagamento {
  id: number;
  nome: string;
}

export interface Promocao {
  id: number;
  nome: string;
  produtoId: number;
  produto?: Produto;
  tipo: string;
  precoPromocional: number;
  leveQuantidade: number | null;
  pagueQuantidade: number | null;
  quantidadeMinima: number | null;
  produtoId2: number | null;
  dataInicio: string;
  dataFim: string;
  ativo: boolean;
}

export interface PedidoItem {
  id: number;
  produtoId: number;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  produto: Produto;
}

/** Form-level item (string inputs for controlled components) */
export interface ItemPedidoForm {
  produtoId: string;
  quantidade: string;
  precoUnitario: number;
  subtotal: number;
  precoManual: boolean;
}

export interface Pedido {
  id: number;
  clienteId: number;
  dataPedido: string;
  dataEntrega: string;
  formaPagamentoId: number | null;
  total: number;
  valorPago: number;
  taxaEntrega: number;
  situacaoPagamento: string;
  statusEntrega: string;
  ordemRota: number | null;
  observacoes: string;
  recorrenteId: number | null;
  cliente: Cliente;
  formaPagamento: FormaPagamento | null;
  itens: PedidoItem[];
}

export interface Fornecedor {
  id: number;
  nome: string;
  _count?: { contas: number };
}

export interface Categoria {
  id: number;
  nome: string;
  _count?: { contas: number };
}

export interface Subcategoria {
  id: number;
  nome: string;
  categoriaId: number;
  _count?: { contas: number };
}

export interface Conta {
  id: number;
  fornecedorId: number | null;
  fornecedorNome: string;
  categoria: string;
  categoriaId: number | null;
  subcategoriaId: number | null;
  tipoFinanceiro: string;
  valor: number;
  vencimento: string;
  situacao: string;
  parcelas: number;
  parcelaNumero: number;
  parcelaGrupoId: number | null;
  fornecedor?: Fornecedor | null;
}

export interface RecorrenteItem {
  id: number;
  produtoId: number;
  quantidade: number;
  precoManual: number | null;
  produto: Produto;
}

export interface PedidoRecorrente {
  id: number;
  clienteId: number;
  formaPagamentoId: number | null;
  diasSemana: string;
  dataInicio: string;
  dataFim: string | null;
  taxaEntrega: number;
  observacoes: string;
  ativo: boolean;
  cliente: Cliente;
  formaPagamento?: FormaPagamento | null;
  itens: RecorrenteItem[];
  _count?: { pedidosGerados: number };
}
