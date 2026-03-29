import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api-helpers";
import { mensagemWhatsAppSchema } from "@/lib/schemas";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);
    const data = await parseBody(request, mensagemWhatsAppSchema);

    const mensagem = await prisma.mensagemWhatsApp.update({
      where: { id: idNum },
      data: { nome: data.nome.trim(), texto: data.texto.trim() },
    });
    return NextResponse.json(mensagem);
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);

    await prisma.mensagemWhatsApp.delete({ where: { id: idNum } });
    return NextResponse.json({ ok: true });
  });
}
