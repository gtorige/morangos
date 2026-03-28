import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const produtos = await prisma.produto.findMany({
      orderBy: { nome: "asc" },
    });
    return NextResponse.json(produtos);
  } catch (error) {
    console.error("Erro ao buscar produtos:", error);
    return NextResponse.json(
      { error: "Erro ao buscar produtos" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    if (!body.nome || typeof body.nome !== "string" || !body.nome.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }
    if (body.preco === undefined || body.preco === null || Number(body.preco) <= 0 || isNaN(Number(body.preco))) {
      return NextResponse.json({ error: "Preço é obrigatório e deve ser maior que 0" }, { status: 400 });
    }
    const { nome, preco } = body;
    const produto = await prisma.produto.create({ data: { nome, preco } });
    return NextResponse.json(produto, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar produto:", error);
    return NextResponse.json(
      { error: "Erro ao criar produto" },
      { status: 500 }
    );
  }
}
