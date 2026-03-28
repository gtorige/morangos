export function calcSubtotal(
  quantidade: number,
  precoUnitario: number,
  tipo?: string,
  leveQuantidade?: number | null,
  pagueQuantidade?: number | null,
  quantidadeMinima?: number | null,
  precoPromocional?: number | null
): number {
  if (tipo === "leve_x_pague_y" && leveQuantidade && pagueQuantidade && quantidade >= leveQuantidade) {
    const groups = Math.floor(quantidade / leveQuantidade);
    const remainder = quantidade % leveQuantidade;
    return (groups * pagueQuantidade + remainder) * precoUnitario;
  }
  if (tipo === "quantidade_minima" && quantidadeMinima && precoPromocional != null && quantidade >= quantidadeMinima) {
    return quantidade * precoPromocional;
  }
  return quantidade * precoUnitario;
}
