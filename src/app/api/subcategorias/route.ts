import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const categoriaId = searchParams.get("categoriaId");

    const subcategorias = await prisma.subcategoria.findMany({
      where: categoriaId ? { categoriaId: Number(categoriaId) } : undefined,
      include: { _count: { select: { contas: true } } },
      orderBy: { nome: "asc" },
    });
    return NextResponse.json(subcategorias);
  } catch (error) {
    console.error("Erro ao buscar subcategorias:", error);
    return NextResponse.json({ error: "Erro ao buscar subcategorias" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const { nome, categoriaId } = body;
    if (!nome || !categoriaId) {
      return NextResponse.json({ error: "Nome e categoria são obrigatórios" }, { status: 400 });
    }
    const subcategoria = await prisma.subcategoria.create({
      data: { nome, categoriaId: Number(categoriaId) },
      include: { _count: { select: { contas: true } } },
    });
    return NextResponse.json(subcategoria, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar subcategoria:", error);
    return NextResponse.json({ error: "Erro ao criar subcategoria" }, { status: 500 });
  }
}
