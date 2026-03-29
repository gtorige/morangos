import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { categoriaSchema } from "@/lib/schemas";

export async function GET() {
  return withAuth(async () => {
    const categorias = await prisma.categoria.findMany({
      orderBy: { nome: "asc" },
      include: { _count: { select: { contas: true } } },
    });
    return NextResponse.json(categorias);
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const data = await parseBody(request, categoriaSchema);
    const categoria = await prisma.categoria.create({
      data: { nome: data.nome.trim() },
    });
    return NextResponse.json(categoria, { status: 201 });
  });
}
