import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const contas = await prisma.conta.findMany({
      orderBy: { vencimento: "asc" },
    });
    return NextResponse.json(contas);
  } catch (error) {
    console.error("Erro ao buscar contas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar contas" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const { fornecedorId, fornecedorNome, categoria, categoriaId, subcategoriaId, tipoFinanceiro, valor, vencimento, situacao, parcelas, parcelaNumero, parcelaGrupoId } = body;
    if (!fornecedorNome && (valor === undefined || valor === null)) {
      return NextResponse.json({ error: "Fornecedor ou valor é obrigatório" }, { status: 400 });
    }
    const conta = await prisma.conta.create({
      data: { fornecedorId, fornecedorNome, categoria, categoriaId, subcategoriaId: subcategoriaId ?? null, tipoFinanceiro: tipoFinanceiro ?? "", valor, vencimento, situacao, parcelas: parcelas ?? 1, parcelaNumero: parcelaNumero ?? 1, parcelaGrupoId: parcelaGrupoId ?? null },
    });
    return NextResponse.json(conta, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar conta:", error);
    return NextResponse.json(
      { error: "Erro ao criar conta" },
      { status: 500 }
    );
  }
}
