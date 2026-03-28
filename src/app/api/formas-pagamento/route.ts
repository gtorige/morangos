import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

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
