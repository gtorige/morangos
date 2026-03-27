import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const admin = await prisma.usuario.findFirst({ where: { isAdmin: true } });
  return NextResponse.json({ hasAdmin: !!admin });
}

export async function POST(request: Request) {
  const admin = await prisma.usuario.findFirst({ where: { isAdmin: true } });
  if (admin) {
    return NextResponse.json(
      { error: "Administrador já existe." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { username, senha, nome } = body;

  if (!username || !senha) {
    return NextResponse.json(
      { error: "Usuário e senha são obrigatórios." },
      { status: 400 }
    );
  }

  if (senha.length < 4) {
    return NextResponse.json(
      { error: "Senha deve ter pelo menos 4 caracteres." },
      { status: 400 }
    );
  }

  const hash = await bcrypt.hash(senha, 10);

  const user = await prisma.usuario.create({
    data: {
      username,
      nome: nome || username,
      senha: hash,
      isAdmin: true,
    },
  });

  return NextResponse.json({ id: user.id, username: user.username });
}
