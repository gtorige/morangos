import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  return withAuth(async () => {
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
  });
}
