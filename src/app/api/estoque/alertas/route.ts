import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { getAlertasEstoque } from "@/lib/services/estoque-service";

/** GET — Alertas de estoque baixo/zerado (para banner global) */
export async function GET() {
  return withAuth(async () => {
    const alertas = await getAlertasEstoque();
    return NextResponse.json(alertas);
  });
}
