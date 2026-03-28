import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const locais = await prisma.localFrequente.findMany({
      orderBy: { nome: "asc" },
    });
    return NextResponse.json(locais);
  } catch (error) {
    console.error("Erro ao buscar locais frequentes:", error);
    return NextResponse.json(
      { error: "Erro ao buscar locais frequentes" },
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
    if (!body.nome || typeof body.nome !== "string" || !body.nome.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    const local = await prisma.localFrequente.create({
      data: {
        nome: body.nome.trim(),
        endereco: body.endereco?.trim() || "",
        plusCode: body.plusCode?.trim() || "",
      },
    });
    return NextResponse.json(local, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar local frequente:", error);
    return NextResponse.json(
      { error: "Erro ao criar local frequente" },
      { status: 500 }
    );
  }
}
