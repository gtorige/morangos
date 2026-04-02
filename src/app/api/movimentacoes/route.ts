import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { movimentacaoCreateSchema } from "@/lib/schemas";
import { registrarMovimentacao } from "@/lib/services/estoque-service";

/** POST — Registrar movimentação manual de estoque */
export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const body = await parseBody(request, movimentacaoCreateSchema);
    const result = await registrarMovimentacao({
      produtoId: body.produtoId,
      tipo: body.tipo,
      quantidade: body.quantidade,
      unidade: body.unidade,
      lote: body.lote,
      motivo: body.motivo,
      referencia: body.referencia,
      data: body.data,
    });
    return NextResponse.json(result, { status: 201 });
  });
}

/** GET — Listar movimentações com filtros */
export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get("tipo");
    const produtoId = searchParams.get("produtoId");
    const dataDe = searchParams.get("dataDe");
    const dataAte = searchParams.get("dataAte");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);

    const where: Record<string, unknown> = {};
    if (tipo && tipo !== "todos") where.tipo = tipo;
    if (produtoId) where.produtoId = parseInt(produtoId);
    if (dataDe || dataAte) {
      where.data = {
        ...(dataDe ? { gte: dataDe } : {}),
        ...(dataAte ? { lte: dataAte } : {}),
      };
    }

    const movimentacoes = await prisma.movimentacaoEstoque.findMany({
      where,
      include: { produto: true },
      orderBy: [{ data: "desc" }, { id: "desc" }],
      take: limit,
    });

    return NextResponse.json(movimentacoes);
  });
}
