import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { clienteCreateSchema } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  return withAuth(async () => {
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
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const data = await parseBody(request, clienteCreateSchema);
    const cliente = await prisma.cliente.create({ data });
    return NextResponse.json(cliente, { status: 201 });
  });
}
