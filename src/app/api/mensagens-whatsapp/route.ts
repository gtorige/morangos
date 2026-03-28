import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const mensagens = await prisma.mensagemWhatsApp.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json(mensagens);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { nome, texto } = await request.json();
  if (!nome?.trim() || !texto?.trim()) {
    return NextResponse.json({ error: "Nome e texto são obrigatórios." }, { status: 400 });
  }
  const mensagem = await prisma.mensagemWhatsApp.create({ data: { nome: nome.trim(), texto: texto.trim() } });
  return NextResponse.json(mensagem, { status: 201 });
}
