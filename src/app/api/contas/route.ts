import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const contas = await prisma.conta.findMany({
      orderBy: { vencimento: "asc" },
    });
    return NextResponse.json(contas);
  } catch (error) {
    console.error("Erro ao buscar contas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar contas" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.fornecedorNome && (body.valor === undefined || body.valor === null)) {
      return NextResponse.json({ error: "Fornecedor ou valor é obrigatório" }, { status: 400 });
    }
    const conta = await prisma.conta.create({ data: body });
    return NextResponse.json(conta, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar conta:", error);
    return NextResponse.json(
      { error: "Erro ao criar conta" },
      { status: 500 }
    );
  }
}
