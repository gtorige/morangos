import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";

export async function GET() {
  return withAuth(async () => {
    const formasPagamento = await prisma.formaPagamento.findMany({
      orderBy: { nome: "asc" },
    });
    const res = NextResponse.json(formasPagamento);
    res.headers.set("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res;
  });
}
