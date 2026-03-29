import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { fornecedorSchema } from "@/lib/schemas";

export async function GET() {
  return withAuth(async () => {
    const fornecedores = await prisma.fornecedor.findMany({
      orderBy: { nome: "asc" },
      include: { _count: { select: { contas: true } } },
    });
    return NextResponse.json(fornecedores);
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const data = await parseBody(request, fornecedorSchema);
    const fornecedor = await prisma.fornecedor.create({ data });
    return NextResponse.json(fornecedor, { status: 201 });
  });
}
