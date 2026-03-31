import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ApiError } from "@/lib/api-helpers";
import { movimentacaoCreateSchema } from "@/lib/schemas";

/** POST — Registrar movimentação manual de estoque */
export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const body = await parseBody(request, movimentacaoCreateSchema);
    const data = body.data || new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    const produto = await prisma.produto.findUnique({ where: { id: body.produtoId } });
    if (!produto) throw new ApiError("Produto não encontrado.", 404);

    // Determinar sinal da quantidade
    let qty = body.quantidade;
    if (["pedido", "consumo", "descarte"].includes(body.tipo)) {
      qty = -Math.abs(qty); // Sempre saída
    } else if (body.tipo === "entrada" || body.tipo === "colheita") {
      qty = Math.abs(qty); // Sempre entrada
    }
    // "ajuste" pode ser positivo ou negativo conforme enviado

    // Verificar estoque para saídas em produtos tipo "estoque"
    if (produto.tipoEstoque === "estoque" && qty < 0 && produto.estoqueAtual + qty < 0) {
      throw new ApiError(`Estoque insuficiente. Atual: ${produto.estoqueAtual}, solicitado: ${Math.abs(qty)}`, 409);
    }

    const saldoInicial = produto.estoqueAtual;
    const saldoFinal = saldoInicial + qty;

    const result = await prisma.$transaction(async (tx) => {
      const mov = await tx.movimentacaoEstoque.create({
        data: {
          produtoId: body.produtoId,
          tipo: body.tipo,
          quantidade: qty,
          unidade: body.unidade || "un",
          lote: body.lote,
          saldoInicial,
          saldoFinal,
          motivo: body.motivo,
          referencia: body.referencia,
          data,
          criadoEm: now,
        },
        include: { produto: true },
      });

      // Atualizar estoqueAtual para produtos tipo "estoque"
      if (produto.tipoEstoque === "estoque") {
        await tx.produto.update({
          where: { id: body.produtoId },
          data: { estoqueAtual: { increment: qty } },
        });
      }

      return mov;
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
