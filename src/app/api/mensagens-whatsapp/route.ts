import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { mensagemWhatsAppSchema } from "@/lib/schemas";

export async function GET() {
  return withAuth(async () => {
    const mensagens = await prisma.mensagemWhatsApp.findMany({
      orderBy: { id: "asc" },
    });
    return NextResponse.json(mensagens);
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const data = await parseBody(request, mensagemWhatsAppSchema);
    const mensagem = await prisma.mensagemWhatsApp.create({
      data: { nome: data.nome.trim(), texto: data.texto.trim() },
    });
    return NextResponse.json(mensagem, { status: 201 });
  });
}
