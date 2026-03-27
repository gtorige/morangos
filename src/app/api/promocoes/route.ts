import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const promocoes = await prisma.promocao.findMany({
      include: { produto: true },
      orderBy: { dataInicio: "desc" },
    });
    return NextResponse.json(promocoes);
  } catch (error) {
    console.error("Erro ao buscar promoções:", error);
    return NextResponse.json(
      { error: "Erro ao buscar promoções" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const promocao = await prisma.promocao.create({
      data: body,
      include: { produto: true },
    });
    return NextResponse.json(promocao, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar promoção:", error);
    return NextResponse.json(
      { error: "Erro ao criar promoção" },
      { status: 500 }
    );
  }
}
