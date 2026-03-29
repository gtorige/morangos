import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { produtoCreateSchema } from "@/lib/schemas";

export async function GET() {
  return withAuth(async () => {
    const produtos = await prisma.produto.findMany({
      orderBy: { nome: "asc" },
    });
    return NextResponse.json(produtos);
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const data = await parseBody(request, produtoCreateSchema);
    const produto = await prisma.produto.create({ data });
    return NextResponse.json(produto, { status: 201 });
  });
}
