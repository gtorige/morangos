import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseDateParam } from "@/lib/api-helpers";
import { colheitaCreateSchema } from "@/lib/schemas";
import { registrarColheita } from "@/lib/services/estoque-service";
import { todayStr } from "@/lib/formatting";

/** POST — Registrar/atualizar colheita diária (upsert por produto+data) */
export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const body = await parseBody(request, colheitaCreateSchema);
    const result = await registrarColheita({
      produtoId: body.produtoId,
      quantidade: body.quantidade,
      data: body.data,
      observacao: body.observacao,
    });
    return NextResponse.json({ colheita: result, data: body.data || todayStr() });
  });
}

/** GET — Listar colheitas de um dia */
export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const data = parseDateParam(searchParams.get("data"));

    const colheitas = await prisma.colheita.findMany({
      where: { data },
      include: { produto: true },
      orderBy: { produtoId: "asc" },
    });

    return NextResponse.json(colheitas);
  });
}
