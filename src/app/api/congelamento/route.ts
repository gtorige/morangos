import { NextRequest, NextResponse } from "next/server";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { congelamentoCreateSchema } from "@/lib/schemas";
import { registrarCongelamento } from "@/lib/services/estoque-service";

/** POST — Registrar congelamento (gera movimentações com mesmo lote) */
export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const body = await parseBody(request, congelamentoCreateSchema);
    const result = await registrarCongelamento({
      produtoFrescoId: body.produtoFrescoId,
      produtoCongeladoId: body.produtoCongeladoId,
      quantidadeKg: body.quantidadeKg,
      perdaKg: body.perdaKg,
      data: body.data,
      observacao: body.observacao,
    });
    return NextResponse.json(result, { status: 201 });
  });
}
