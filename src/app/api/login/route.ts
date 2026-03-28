import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { encode } from "@auth/core/jwt";

const COOKIE_NAME = "authjs.session-token";
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Preencha usuário e senha." },
        { status: 400 }
      );
    }

    const user = await prisma.usuario.findUnique({
      where: { username: String(username) },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuário ou senha incorretos." },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(String(password), user.senha);
    if (!valid) {
      return NextResponse.json(
        { error: "Usuário ou senha incorretos." },
        { status: 401 }
      );
    }

    const secret = process.env.AUTH_SECRET!;
    const token = await encode({
      token: {
        sub: String(user.id),
        id: String(user.id),
        name: user.nome,
        email: user.username,
        username: user.username,
        isAdmin: user.isAdmin,
      },
      secret,
      salt: COOKIE_NAME,
      maxAge: MAX_AGE,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
      maxAge: MAX_AGE,
    });

    return response;
  } catch (err) {
    console.error("[/api/login]", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
