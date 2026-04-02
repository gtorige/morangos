import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { contaCreateSchema } from "@/lib/schemas";
import { criarContaComParcelas } from "@/lib/services/conta-service";
import { parsePagination, paginatedResponse, UNPAGINATED_LIMIT } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);

    if (pagination) {
      const [contas, total] = await Promise.all([
        prisma.conta.findMany({
          orderBy: { vencimento: "asc" },
          skip: pagination.skip,
          take: pagination.take,
        }),
        prisma.conta.count(),
      ]);
      return NextResponse.json(paginatedResponse(contas, total, pagination));
    }

    // Sem paginacao (retrocompativel, com limite de seguranca)
    const contas = await prisma.conta.findMany({
      orderBy: { vencimento: "asc" },
      take: UNPAGINATED_LIMIT,
    });
    return NextResponse.json(contas);
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const data = await parseBody(request, contaCreateSchema);

    // Se parcelas > 1, usar o service para criar todas em transacao
    if (data.parcelas && data.parcelas > 1) {
      const parcelas = await criarContaComParcelas(data);
      return NextResponse.json(parcelas, { status: 201 });
    }

    // Conta simples (1 parcela)
    const conta = await prisma.conta.create({ data });
    return NextResponse.json(conta, { status: 201 });
  });
}
