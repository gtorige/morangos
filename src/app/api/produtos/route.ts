import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { produtoCreateSchema } from "@/lib/schemas";

export async function GET() {
  return withAuth(async () => {
    const produtos = await prisma.produto.findMany({
      orderBy: { nome: "asc" },
    });
    const res = NextResponse.json(produtos);
    res.headers.set("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res;
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const data = await parseBody(request, produtoCreateSchema);
    const produto = await prisma.produto.create({ data });
    return NextResponse.json(produto, { status: 201 });
  });
}
