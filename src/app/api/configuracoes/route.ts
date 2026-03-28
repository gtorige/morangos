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
    const chave = searchParams.get("chave");

    if (chave) {
      const config = await prisma.configuracao.findUnique({
        where: { chave },
      });
      return NextResponse.json(config);
    }

    const configs = await prisma.configuracao.findMany();
    return NextResponse.json(configs);
  } catch (error) {
    console.error("Erro ao buscar configurações:", error);
    return NextResponse.json(
      { error: "Erro ao buscar configurações" },
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
    const { chave, valor } = body;

    if (!chave || typeof chave !== "string" || !chave.trim()) {
      return NextResponse.json({ error: "Chave é obrigatória." }, { status: 400 });
    }
    if (valor === undefined || valor === null || (typeof valor === "string" && !valor.trim())) {
      return NextResponse.json({ error: "Valor é obrigatório." }, { status: 400 });
    }

    const config = await prisma.configuracao.upsert({
      where: { chave },
      update: { valor },
      create: { chave, valor },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("Erro ao salvar configuração:", error);
    return NextResponse.json(
      { error: "Erro ao salvar configuração" },
      { status: 500 }
    );
  }
}
