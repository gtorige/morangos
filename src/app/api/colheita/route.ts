import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { colheitaCreateSchema } from "@/lib/schemas";

/** POST — Registrar/atualizar colheita diária (upsert por produto+data) */
export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const body = await parseBody(request, colheitaCreateSchema);
    const data = body.data || new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    // Validar que produto é tipo "diario"
    const produto = await prisma.produto.findUnique({ where: { id: body.produtoId } });
    if (!produto) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
    if (produto.tipoEstoque !== "diario") {
      return NextResponse.json({ error: "Colheita só pode ser registrada para produtos do tipo 'diário'." }, { status: 400 });
    }

    // Upsert colheita + criar/atualizar MovimentacaoEstoque em transação
    const existing = await prisma.colheita.findFirst({
      where: { produtoId: body.produtoId, data },
    });

    const result = await prisma.$transaction(async (tx) => {
      let colheita;

      // Buscar movimentação de colheita existente para este produto+data
      const existingMov = await tx.movimentacaoEstoque.findFirst({
        where: { produtoId: body.produtoId, data, tipo: "colheita" },
      });

      if (body.quantidade <= 0 && existing) {
        // Remover colheita + movimentação
        await tx.colheita.delete({ where: { id: existing.id } });
        if (existingMov) {
          await tx.movimentacaoEstoque.delete({ where: { id: existingMov.id } });
        }
        colheita = null;
      } else if (existing) {
        // Atualizar colheita
        colheita = await tx.colheita.update({
          where: { id: existing.id },
          data: { quantidade: body.quantidade, observacao: body.observacao ?? existing.observacao },
          include: { produto: true },
        });
        // Calcular saldo (colheita anterior + saídas do dia)
        const outrasColheitas = await tx.colheita.findMany({
          where: { produtoId: body.produtoId, data, id: { not: existing.id } },
        });
        const saldoAntes = outrasColheitas.reduce((s, c) => s + c.quantidade, 0);

        if (existingMov) {
          await tx.movimentacaoEstoque.update({
            where: { id: existingMov.id },
            data: {
              quantidade: body.quantidade,
              saldoInicial: saldoAntes,
              saldoFinal: saldoAntes + body.quantidade,
              motivo: body.observacao || "Colheita do dia",
            },
          });
        } else {
          await tx.movimentacaoEstoque.create({
            data: {
              produtoId: body.produtoId, tipo: "colheita", quantidade: body.quantidade,
              unidade: "kg", saldoInicial: saldoAntes, saldoFinal: saldoAntes + body.quantidade,
              motivo: body.observacao || "Colheita do dia",
              referencia: String(colheita.id), data, criadoEm: now,
            },
          });
        }
      } else if (body.quantidade > 0) {
        // Criar colheita + movimentação
        colheita = await tx.colheita.create({
          data: {
            produtoId: body.produtoId, quantidade: body.quantidade,
            data, observacao: body.observacao, criadoEm: now,
          },
          include: { produto: true },
        });
        // Saldo = outras colheitas do dia (se houver)
        const outrasColheitas2 = await tx.colheita.findMany({
          where: { produtoId: body.produtoId, data, id: { not: colheita.id } },
        });
        const saldoAntes2 = outrasColheitas2.reduce((s, c) => s + c.quantidade, 0);
        await tx.movimentacaoEstoque.create({
          data: {
            produtoId: body.produtoId, tipo: "colheita", quantidade: body.quantidade,
            unidade: "kg", saldoInicial: saldoAntes2, saldoFinal: saldoAntes2 + body.quantidade,
            motivo: body.observacao || "Colheita do dia",
            referencia: String(colheita.id), data, criadoEm: now,
          },
        });
      }

      return colheita;
    });

    return NextResponse.json({ colheita: result, data });
  });
}

/** GET — Listar colheitas de um dia */
export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const data = searchParams.get("data") || new Date().toISOString().slice(0, 10);

    const colheitas = await prisma.colheita.findMany({
      where: { data },
      include: { produto: true },
      orderBy: { produtoId: "asc" },
    });

    return NextResponse.json(colheitas);
  });
}
