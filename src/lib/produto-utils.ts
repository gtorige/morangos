/**
 * Extrair peso em gramas do nome do produto.
 * Ex: "Morango Classe A 500g" → 500, "Morango 1kg" → 1000
 */
export function extrairPesoDoNome(nome: string): number | null {
  const match = nome.match(/(\d+(?:[.,]\d+)?)\s*(kg|g)/i);
  if (!match) return null;
  const valor = parseFloat(match[1].replace(",", "."));
  const unidade = match[2].toLowerCase();
  return unidade === "kg" ? valor * 1000 : valor;
}

/**
 * Extrair peso em kg do nome do produto.
 * Ex: "Morango Classe A 500g" → 0.5, "Morango 1kg" → 1.0
 */
export function extrairPesoKgDoNome(nome: string): number | null {
  const gramas = extrairPesoDoNome(nome);
  return gramas !== null ? gramas / 1000 : null;
}

/**
 * Extrair classe do nome do produto.
 * Ex: "Morango Classe A 1kg" → "A", "Geleia 250ml" → null
 */
export function extrairClasseDoNome(nome: string): string | null {
  const match = nome.match(/classe\s+([A-C])/i);
  return match ? match[1].toUpperCase() : null;
}

/** Tipos de estoque */
export type TipoEstoque = "diario" | "estoque";

/** Tipos de movimentação de estoque */
export type TipoMovimentacao =
  | "colheita"
  | "entrada"
  | "pedido"
  | "congelamento"
  | "consumo"
  | "descarte"
  | "ajuste";

/** Configuração visual para cada tipo de movimentação */
export const TIPO_MOVIMENTACAO_CONFIG: Record<
  TipoMovimentacao,
  { label: string; badgeClass: string }
> = {
  colheita: { label: "Colheita", badgeClass: "bg-green-500/10 text-green-500 border-green-500/20" },
  entrada: { label: "Entrada", badgeClass: "bg-green-500/10 text-green-500 border-green-500/20" },
  pedido: { label: "Saída/Pedido", badgeClass: "bg-red-500/10 text-red-500 border-red-500/20" },
  congelamento: { label: "Congelamento", badgeClass: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  consumo: { label: "Consumo", badgeClass: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  descarte: { label: "Descarte", badgeClass: "bg-red-500/10 text-red-500 border-red-500/20" },
  ajuste: { label: "Ajuste", badgeClass: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
};
