import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../../../auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const currentUser = session?.user as { id?: string; isAdmin?: boolean };

    const { id } = await params;
    const idNum = parseInt(id);

    if (isNaN(idNum)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }

    // Users can change their own password, admins can change anyone's
    if (String(idNum) !== currentUser?.id && !currentUser?.isAdmin) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const body = await request.json();
    const { senha, senhaAtual } = body;

    if (!senha || senha.length < 4) {
      return NextResponse.json(
        { error: "Nova senha deve ter pelo menos 4 caracteres." },
        { status: 400 }
      );
    }

    // Require current password when changing own password
    if (String(idNum) === currentUser?.id) {
      if (!senhaAtual) {
        return NextResponse.json(
          { error: "Senha atual é obrigatória." },
          { status: 400 }
        );
      }
      const user = await prisma.usuario.findUnique({ where: { id: idNum } });
      if (!user || !(await bcrypt.compare(senhaAtual, user.senha))) {
        return NextResponse.json(
          { error: "Senha atual incorreta." },
          { status: 400 }
        );
      }
    }

    const hash = await bcrypt.hash(senha, 10);
    await prisma.usuario.update({ where: { id: idNum }, data: { senha: hash } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Erro ao atualizar usuário:", e);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const currentUser = session?.user as { id?: string; isAdmin?: boolean };

    if (!currentUser?.isAdmin) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { id } = await params;
    const idNum = parseInt(id);

    if (isNaN(idNum)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }

    if (String(idNum) === currentUser.id) {
      return NextResponse.json(
        { error: "Você não pode excluir seu próprio usuário." },
        { status: 400 }
      );
    }

    await prisma.usuario.delete({ where: { id: idNum } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Erro ao excluir usuário:", e);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
