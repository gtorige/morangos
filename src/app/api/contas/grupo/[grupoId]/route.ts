import { NextRequest, NextResponse } from "next/server";
import { withAuth, parseId } from "@/lib/api-helpers";
import { editarGrupoParcelas } from "@/lib/services/conta-service";
import { z } from "zod";

const grupoEditSchema = z.object({
  fornecedorNome: z.string().optional(),
  categoria: z.string().optional(),
  categoriaId: z.number().int().positive().optional().nullable(),
  subcategoriaId: z.number().int().positive().optional().nullable(),
  tipoFinanceiro: z.string().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ grupoId: string }> }
) {
  return withAuth(async () => {
    const { grupoId } = await params;
    const idNum = parseId(grupoId);
    const body = grupoEditSchema.parse(await request.json());
    const updated = await editarGrupoParcelas(idNum, body);
    return NextResponse.json(updated);
  });
}
