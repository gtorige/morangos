import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
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
    const body = await request.json();
    if (!body.nome || typeof body.nome !== "string" || !body.nome.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }
    const cliente = await prisma.cliente.create({ data: body });
    return NextResponse.json(cliente, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar cliente:", error);
    return NextResponse.json(
      { error: "Erro ao criar cliente" },
      { status: 500 }
    );
  }
}
