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
    const busca = searchParams.get("busca");

    const clientes = await prisma.cliente.findMany({
      where: busca
        ? {
            OR: [
              { nome: { contains: busca } },
              { telefone: { contains: busca } },
              { rua: { contains: busca } },
              { bairro: { contains: busca } },
              { cidade: { contains: busca } },
            ],
          }
        : undefined,
      orderBy: { nome: "asc" },
    });

    return NextResponse.json(clientes);
  } catch (error) {
    console.error("Erro ao buscar clientes:", error);
    return NextResponse.json(
      { error: "Erro ao buscar clientes" },
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
    const { nome, telefone, cep, rua, numero, bairro, cidade, enderecoAlternativo, observacoes } = body;
    if (!nome?.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
    }
    const cliente = await prisma.cliente.create({
      data: { nome, telefone: telefone || "", cep: cep || "", rua: rua || "", numero: numero || "", bairro: bairro || "", cidade: cidade || "", enderecoAlternativo: enderecoAlternativo || "", observacoes: observacoes || "" },
    });
    return NextResponse.json(cliente, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar cliente:", error);
    return NextResponse.json(
      { error: "Erro ao criar cliente" },
      { status: 500 }
    );
  }
}
