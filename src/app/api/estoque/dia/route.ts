import { NextRequest, NextResponse } from "next/server";
import { withAuth, parseDateParam } from "@/lib/api-helpers";
import { calcularEstoqueDia } from "@/lib/services/estoque-service";

/** GET — Visão consolidada do estoque do dia para todos os produtos */
export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const data = parseDateParam(searchParams.get("data"));
    const estoque = await calcularEstoqueDia(data);
    return NextResponse.json(estoque);
  });
}
