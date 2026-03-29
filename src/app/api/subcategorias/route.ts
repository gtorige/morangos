import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api-helpers";
import { subcategoriaCreateSchema } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const categoriaId = searchParams.get("categoriaId");

    const subcategorias = await prisma.subcategoria.findMany({
      where: categoriaId ? { categoriaId: parseId(categoriaId) } : undefined,
      include: { _count: { select: { contas: true } } },
      orderBy: { nome: "asc" },
    });
    return NextResponse.json(subcategorias);
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const data = await parseBody(request, subcategoriaCreateSchema);
    const subcategoria = await prisma.subcategoria.create({
      data,
      include: { _count: { select: { contas: true } } },
    });
    return NextResponse.json(subcategoria, { status: 201 });
  });
}
