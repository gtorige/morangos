import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    if (!q) {
      return NextResponse.json({ clientes: [], produtos: [] });
    }

    const [clientes, produtos] = await Promise.all([
      prisma.cliente.findMany({
        where: {
          OR: [
            { nome: { contains: q } },
            { telefone: { contains: q } },
            { rua: { contains: q } },
            { bairro: { contains: q } },
          ],
        },
        orderBy: { nome: "asc" },
        take: 50,
      }),
      prisma.produto.findMany({
        where: {
          nome: { contains: q },
        },
        orderBy: { nome: "asc" },
        take: 50,
      }),
    ]);

    return NextResponse.json({ clientes, produtos });
  } catch (error) {
    console.error("Erro ao buscar:", error);
    return NextResponse.json({ error: "Erro ao buscar" }, { status: 500 });
  }
}
