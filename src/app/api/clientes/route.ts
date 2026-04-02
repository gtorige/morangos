import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { clienteCreateSchema } from "@/lib/schemas";
import { parsePagination, paginatedResponse, UNPAGINATED_LIMIT } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const busca = searchParams.get("busca");
    const pagination = parsePagination(searchParams);

    const where = busca
      ? {
          OR: [
            { nome: { contains: busca } },
            { telefone: { contains: busca } },
            { rua: { contains: busca } },
            { bairro: { contains: busca } },
            { cidade: { contains: busca } },
          ],
        }
      : undefined;

    if (pagination) {
      const [clientes, total] = await Promise.all([
        prisma.cliente.findMany({
          where,
          orderBy: { nome: "asc" },
          skip: pagination.skip,
          take: pagination.take,
        }),
        prisma.cliente.count({ where }),
      ]);
      return NextResponse.json(paginatedResponse(clientes, total, pagination));
    }

    // Sem paginação (retrocompatível, com limite de segurança)
    const clientes = await prisma.cliente.findMany({
      where,
      orderBy: { nome: "asc" },
      take: UNPAGINATED_LIMIT,
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
