// Generic hooks
export { useFetch } from "./use-fetch";
export { useLocalStorage, useLocalStorageString } from "./use-local-storage";
export { useColumnConfig, type ColumnDef } from "./use-column-config";
export { useCrud } from "./use-crud";

// Domain hooks
export { useClientes } from "./use-clientes";
export { useEstoque } from "./use-estoque";
export { useContas, type ContaForm, type Conta, type Fornecedor, type Categoria, type Subcategoria } from "./use-contas";
export {
  usePedidos,
  getPeriodoDates,
  defaultFilters,
  emptyFilters,
  type Pedido,
  type PedidoFilters,
  type PeriodoKey,
} from "./use-pedidos";
