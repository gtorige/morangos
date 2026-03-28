export function calcSubtotal(
  quantidade: number,
  precoUnitario: number,
  tipo?: string,
  leveQuantidade?: number | null,
  pagueQuantidade?: number | null
): number {
  if (tipo === "leve_x_pague_y" && leveQuantidade && pagueQuantidade && quantidade >= leveQuantidade) {
    const groups = Math.floor(quantidade / leveQuantidade);
    const remainder = quantidade % leveQuantidade;
    return (groups * pagueQuantidade + remainder) * precoUnitario;
  }
  return quantidade * precoUnitario;
}
