import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../../auth";

export async function POST(request: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const { senhaAtual, novaSenha } = body;

  if (!senhaAtual || !novaSenha) {
    return NextResponse.json(
      { error: "Senha atual e nova senha são obrigatórias." },
      { status: 400 }
    );
  }

  if (novaSenha.length < 4) {
    return NextResponse.json(
      { error: "Nova senha deve ter pelo menos 4 caracteres." },
      { status: 400 }
    );
  }

  const user = await prisma.usuario.findUnique({ where: { id: parseInt(userId) } });
  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  const valid = await bcrypt.compare(senhaAtual, user.senha);
  if (!valid) {
    return NextResponse.json({ error: "Senha atual incorreta." }, { status: 400 });
  }

  const hash = await bcrypt.hash(novaSenha, 10);
  await prisma.usuario.update({ where: { id: user.id }, data: { senha: hash } });

  return NextResponse.json({ success: true });
}
