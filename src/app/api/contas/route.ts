import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { contaCreateSchema } from "@/lib/schemas";

export async function GET() {
  return withAuth(async () => {
    const contas = await prisma.conta.findMany({
      orderBy: { vencimento: "asc" },
    });
    return NextResponse.json(contas);
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const data = await parseBody(request, contaCreateSchema);
    const conta = await prisma.conta.create({ data });
    return NextResponse.json(conta, { status: 201 });
  });
}
