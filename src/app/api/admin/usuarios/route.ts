import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../../auth";

export async function GET() {
  try {
    const session = await auth();
    if (!(session?.user as { isAdmin?: boolean })?.isAdmin) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const usuarios = await prisma.usuario.findMany({
      select: { id: true, username: true, nome: true, isAdmin: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(usuarios);
  } catch (e) {
    console.error("Erro ao buscar usuários:", e);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!(session?.user as { isAdmin?: boolean })?.isAdmin) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const body = await request.json();
    const { username, nome, senha, isAdmin } = body;

    if (!username?.trim() || !senha) {
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

    const exists = await prisma.usuario.findUnique({
      where: { username: username.trim() },
    });
    if (exists) {
      return NextResponse.json(
        { error: "Esse nome de usuário já existe." },
        { status: 400 }
      );
    }

    const hash = await bcrypt.hash(senha, 10);

    const user = await prisma.usuario.create({
      data: {
        username: username.trim(),
        nome: nome?.trim() || username.trim(),
        senha: hash,
        isAdmin: !!isAdmin,
      },
    });

    return NextResponse.json({
      id: user.id,
      username: user.username,
      nome: user.nome,
      isAdmin: user.isAdmin,
    });
  } catch (e) {
    console.error("Erro ao criar usuário:", e);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
