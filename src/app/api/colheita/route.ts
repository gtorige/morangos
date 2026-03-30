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

    // Upsert: se já existe colheita do mesmo produto+data, atualiza
    const existing = await prisma.colheita.findFirst({
      where: { produtoId: body.produtoId, data },
    });

    let colheita;
    if (body.quantidade <= 0 && existing) {
      // Quantidade 0 ou negativa = remover colheita
      await prisma.colheita.delete({ where: { id: existing.id } });
      colheita = null;
    } else if (existing) {
      colheita = await prisma.colheita.update({
        where: { id: existing.id },
        data: { quantidade: body.quantidade, observacao: body.observacao ?? existing.observacao },
        include: { produto: true },
      });
    } else if (body.quantidade > 0) {
      colheita = await prisma.colheita.create({
        data: {
          produtoId: body.produtoId,
          quantidade: body.quantidade,
          data,
          observacao: body.observacao,
          criadoEm: now,
        },
        include: { produto: true },
      });
    }

    return NextResponse.json({ colheita, data });
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
