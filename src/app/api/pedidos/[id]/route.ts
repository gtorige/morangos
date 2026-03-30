import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api-helpers";
import { pedidoUpdateSchema } from "@/lib/schemas";
import { PEDIDO_INCLUDE } from "@/lib/constants";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);

    const pedido = await prisma.pedido.findUnique({
      where: { id: idNum },
      include: PEDIDO_INCLUDE,
    });

    if (!pedido) {
      return NextResponse.json(
        { error: "Pedido não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(pedido);
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);
    const body = await parseBody(request, pedidoUpdateSchema);
    const { itens, ...pedidoData } = body;

    if (itens) {
      const total = itens.reduce(
        (acc, item) =>
          acc + (item.subtotal ?? item.precoUnitario! * item.quantidade),
        0
      );

      const pedido = await prisma.$transaction(async (tx) => {
        await tx.pedidoItem.deleteMany({
          where: { pedidoId: idNum },
        });

        return tx.pedido.update({
          where: { id: idNum },
          data: {
            ...pedidoData,
            total,
            itens: {
              create: itens.map((item) => ({
                produtoId: item.produtoId,
                quantidade: item.quantidade,
                precoUnitario: item.precoUnitario!,
                subtotal: item.subtotal ?? item.precoUnitario! * item.quantidade,
              })),
            },
          },
          include: PEDIDO_INCLUDE,
        });
      });

      return NextResponse.json(pedido);
    }

    // Se está marcando como "Entregue", debitar estoque de produtos tipo "estoque"
    if (pedidoData.statusEntrega === "Entregue") {
      const pedidoAtual = await prisma.pedido.findUnique({
        where: { id: idNum },
        include: { cliente: true, itens: { include: { produto: true } } },
      });
      if (!pedidoAtual) {
        return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
      }

      // Só debitar se o pedido NÃO estava como Entregue antes (evitar debitar duas vezes)
      if (pedidoAtual.statusEntrega !== "Entregue") {
        const itensEstoque = pedidoAtual.itens.filter(
          (item) => item.produto.tipoEstoque === "estoque"
        );

        // Verificar estoque suficiente
        const deficit: { produto: string; necessario: number; disponivel: number; falta: number }[] = [];
        for (const item of itensEstoque) {
          if (item.produto.estoqueAtual < item.quantidade) {
            deficit.push({
              produto: item.produto.nome,
              necessario: item.quantidade,
              disponivel: item.produto.estoqueAtual,
              falta: item.quantidade - item.produto.estoqueAtual,
            });
          }
        }
        if (deficit.length > 0) {
          return NextResponse.json(
            { error: "Estoque insuficiente", deficit },
            { status: 409 }
          );
        }

        // Debitar estoque em transação + criar movimentações para TODOS os itens
        const now = new Date().toISOString();
        const pedidoAtualizado = await prisma.$transaction(async (tx) => {
          for (const item of pedidoAtual.itens) {
            if (item.produto.tipoEstoque === "estoque") {
              // Produto acumulado: debitar estoqueAtual
              const saldoInicial = item.produto.estoqueAtual;
              await tx.movimentacaoEstoque.create({
                data: {
                  produtoId: item.produtoId,
                  tipo: "pedido",
                  quantidade: -item.quantidade,
                  unidade: "un",
                  saldoInicial,
                  saldoFinal: saldoInicial - item.quantidade,
                  motivo: `Pedido #${idNum} — ${pedidoAtual.cliente?.nome || ""}`.trim(),
                  referencia: String(idNum),
                  data: pedidoAtual.dataEntrega,
                  criadoEm: now,
                },
              });
              await tx.produto.update({
                where: { id: item.produtoId },
                data: { estoqueAtual: { decrement: item.quantidade } },
              });
            } else {
              // Produto diário: criar movimentação de saída (não altera estoqueAtual)
              const pesoKg = item.produto.pesoUnitarioGramas
                ? (item.quantidade * item.produto.pesoUnitarioGramas) / 1000
                : item.quantidade;
              await tx.movimentacaoEstoque.create({
                data: {
                  produtoId: item.produtoId,
                  tipo: "pedido",
                  quantidade: -pesoKg,
                  unidade: item.produto.pesoUnitarioGramas ? "kg" : "un",
                  saldoInicial: 0,
                  saldoFinal: 0,
                  motivo: `Pedido #${idNum} — ${pedidoAtual.cliente?.nome || ""}`.trim(),
                  referencia: String(idNum),
                  data: pedidoAtual.dataEntrega,
                  criadoEm: now,
                },
              });
            }
          }

          return tx.pedido.update({
            where: { id: idNum },
            data: pedidoData,
            include: PEDIDO_INCLUDE,
          });
        });

        return NextResponse.json(pedidoAtualizado);
      }
    }

    const pedido = await prisma.pedido.update({
      where: { id: idNum },
      data: pedidoData,
      include: PEDIDO_INCLUDE,
    });

    return NextResponse.json(pedido);
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const idNum = parseId(id);

    await prisma.$transaction(async (tx) => {
      await tx.pedidoItem.deleteMany({ where: { pedidoId: idNum } });
      await tx.pedido.delete({ where: { id: idNum } });
    });

    return NextResponse.json({ message: "Pedido excluído com sucesso" });
  });
}
