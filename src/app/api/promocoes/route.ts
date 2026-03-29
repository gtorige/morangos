import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { promocaoCreateSchema } from "@/lib/schemas";

export async function GET() {
  return withAuth(async () => {
    const promocoes = await prisma.promocao.findMany({
      include: { produto: true },
      orderBy: { dataInicio: "desc" },
    });
    return NextResponse.json(promocoes);
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const data = await parseBody(request, promocaoCreateSchema);
    const promocao = await prisma.promocao.create({
      data,
      include: { produto: true },
    });
    return NextResponse.json(promocao, { status: 201 });
  });
}
