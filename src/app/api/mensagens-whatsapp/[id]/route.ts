import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../../auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const { nome, texto } = await request.json();
  if (!nome?.trim() || !texto?.trim()) {
    return NextResponse.json({ error: "Nome e texto são obrigatórios." }, { status: 400 });
  }
  const mensagem = await prisma.mensagemWhatsApp.update({
    where: { id: Number(id) },
    data: { nome: nome.trim(), texto: texto.trim() },
  });
  return NextResponse.json(mensagem);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  await prisma.mensagemWhatsApp.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
