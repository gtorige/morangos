import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const formasPagamento = await prisma.formaPagamento.findMany({
      orderBy: { nome: "asc" },
    });
    return NextResponse.json(formasPagamento);
  } catch (error) {
    console.error("Erro ao buscar formas de pagamento:", error);
    return NextResponse.json(
      { error: "Erro ao buscar formas de pagamento" },
      { status: 500 }
    );
  }
}
