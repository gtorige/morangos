import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";

/** GET — Alertas de estoque baixo/zerado (para banner global) */
export async function GET() {
  return withAuth(async () => {
    // Produtos tipo "estoque" com estoque baixo ou zerado
    const produtosEstoque = await prisma.produto.findMany({
      where: {
        tipoEstoque: "estoque",
        estoqueMinimo: { gt: 0 },
      },
    });

    const alertas: { produtoId: number; nome: string; estoqueAtual: number; estoqueMinimo: number; nivel: "zerado" | "baixo" }[] = [];

    for (const p of produtosEstoque) {
      if (p.estoqueAtual === 0) {
        alertas.push({ produtoId: p.id, nome: p.nome, estoqueAtual: p.estoqueAtual, estoqueMinimo: p.estoqueMinimo, nivel: "zerado" });
      } else if (p.estoqueAtual <= p.estoqueMinimo) {
        alertas.push({ produtoId: p.id, nome: p.nome, estoqueAtual: p.estoqueAtual, estoqueMinimo: p.estoqueMinimo, nivel: "baixo" });
      }
    }

    return NextResponse.json(alertas);
  });
}
