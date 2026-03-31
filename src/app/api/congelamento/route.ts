import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ApiError } from "@/lib/api-helpers";
import { congelamentoCreateSchema } from "@/lib/schemas";

/** POST — Registrar congelamento (gera duas movimentações com mesmo lote) */
export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const body = await parseBody(request, congelamentoCreateSchema);
    const data = body.data || new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    // Validar produtos
    const [fresco, congelado] = await Promise.all([
      prisma.produto.findUnique({ where: { id: body.produtoFrescoId } }),
      prisma.produto.findUnique({ where: { id: body.produtoCongeladoId } }),
    ]);
    if (!fresco) throw new ApiError("Produto fresco não encontrado.", 404);
    if (!congelado) throw new ApiError("Produto congelado não encontrado.", 404);
    if (congelado.tipoEstoque !== "estoque") {
      throw new ApiError("Produto congelado deve ser do tipo 'estoque'.", 400);
    }

    // Calcular unidades congeladas
    const pesoKgPorUnidade = congelado.pesoUnitarioGramas ? congelado.pesoUnitarioGramas / 1000 : 1;
    const unidadesCongeladas = Math.floor(body.quantidadeKg / pesoKgPorUnidade);
    if (unidadesCongeladas <= 0) {
      throw new ApiError("Quantidade insuficiente para gerar pelo menos 1 unidade congelada.", 400);
    }

    // Gerar número de lote sequencial
    const ultimoLote = await prisma.movimentacaoEstoque.findFirst({
      where: { lote: { startsWith: "#C" } },
      orderBy: { id: "desc" },
    });
    let loteNum = 1;
    if (ultimoLote?.lote) {
      const match = ultimoLote.lote.match(/#C(\d+)/);
      if (match) loteNum = parseInt(match[1]) + 1;
    }
    const lote = `#C${String(loteNum).padStart(2, "0")}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Saída do fresco (em kg)
      const movSaida = await tx.movimentacaoEstoque.create({
        data: {
          produtoId: body.produtoFrescoId,
          tipo: "congelamento",
          quantidade: -body.quantidadeKg,
          unidade: "kg",
          lote,
          saldoInicial: 0, // Fresco não tem saldo persistente
          saldoFinal: 0,
          motivo: body.observacao || `Congelamento ${lote}`,
          data,
          criadoEm: now,
        },
      });

      // 2. Entrada do congelado (em unidades)
      const saldoInicial = congelado.estoqueAtual;
      const saldoFinal = saldoInicial + unidadesCongeladas;
      const movEntrada = await tx.movimentacaoEstoque.create({
        data: {
          produtoId: body.produtoCongeladoId,
          tipo: "congelamento",
          quantidade: unidadesCongeladas,
          unidade: "un",
          lote,
          saldoInicial,
          saldoFinal,
          motivo: "auto",
          data,
          criadoEm: now,
        },
      });

      // 3. Atualizar estoque do congelado
      await tx.produto.update({
        where: { id: body.produtoCongeladoId },
        data: { estoqueAtual: { increment: unidadesCongeladas } },
      });

      // 4. Registrar perda/descarte (se houver), atrelada ao mesmo lote
      let movPerda = null;
      const perdaKg = body.perdaKg || 0;
      if (perdaKg > 0) {
        movPerda = await tx.movimentacaoEstoque.create({
          data: {
            produtoId: body.produtoFrescoId,
            tipo: "descarte",
            quantidade: -perdaKg,
            unidade: "kg",
            lote,
            saldoInicial: 0,
            saldoFinal: 0,
            motivo: `Perda no congelamento ${lote}`,
            data,
            criadoEm: now,
          },
        });
      }

      return { lote, saida: movSaida, entrada: movEntrada, perda: movPerda, unidadesCongeladas, perdaKg };
    });

    return NextResponse.json(result, { status: 201 });
  });
}
