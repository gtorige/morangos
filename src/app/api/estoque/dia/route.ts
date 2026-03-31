import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";

/** GET — Visão consolidada do estoque do dia para todos os produtos */
export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const data = searchParams.get("data") || new Date().toISOString().slice(0, 10);

    const produtos = await prisma.produto.findMany({ orderBy: { nome: "asc" } });

    // Colheitas do dia (para produtos tipo "diario")
    const colheitas = await prisma.colheita.findMany({
      where: { data },
    });
    const colheitaMap = new Map<number, number>();
    for (const c of colheitas) {
      colheitaMap.set(c.produtoId, (colheitaMap.get(c.produtoId) || 0) + c.quantidade);
    }

    // Pedidos do dia com status "Entregue" (para calcular vendido)
    const pedidos = await prisma.pedido.findMany({
      where: { dataEntrega: data, statusEntrega: "Entregue" },
      include: { itens: true },
    });
    // Converter vendido de unidades para kg (colheita é registrada em kg)
    const produtoMap = new Map(produtos.map(p => [p.id, p]));
    const vendidoMap = new Map<number, number>();
    for (const p of pedidos) {
      for (const item of p.itens) {
        const prod = produtoMap.get(item.produtoId);
        // Converter para kg se produto diário com pesoUnitarioGramas
        const qtdKg = (prod?.tipoEstoque === "diario" && prod.pesoUnitarioGramas)
          ? (item.quantidade * prod.pesoUnitarioGramas) / 1000
          : item.quantidade;
        vendidoMap.set(item.produtoId, (vendidoMap.get(item.produtoId) || 0) + qtdKg);
      }
    }

    // Também incluir pedidos pendentes para "reservado"
    const pedidosPendentes = await prisma.pedido.findMany({
      where: { dataEntrega: data, statusEntrega: { in: ["Pendente", "Em rota"] } },
      include: { itens: true },
    });
    const reservadoMap = new Map<number, number>();
    for (const p of pedidosPendentes) {
      for (const item of p.itens) {
        const prod = produtoMap.get(item.produtoId);
        const qtdKg = (prod?.tipoEstoque === "diario" && prod.pesoUnitarioGramas)
          ? (item.quantidade * prod.pesoUnitarioGramas) / 1000
          : item.quantidade;
        reservadoMap.set(item.produtoId, (reservadoMap.get(item.produtoId) || 0) + qtdKg);
      }
    }

    const estoque = produtos.map((prod) => {
      if (prod.tipoEstoque === "diario") {
        const colhido = colheitaMap.get(prod.id) || 0;
        const vendido = vendidoMap.get(prod.id) || 0;
        const reservado = reservadoMap.get(prod.id) || 0;
        const disponivel = colhido - vendido - reservado;
        return {
          produtoId: prod.id,
          nome: prod.nome,
          tipoEstoque: "diario",
          colhidoHoje: colhido,
          vendidoHoje: vendido,
          reservadoHoje: reservado,
          disponivel,
          unidadeVenda: prod.unidadeVenda,
          pesoUnitarioGramas: prod.pesoUnitarioGramas,
        };
      } else {
        return {
          produtoId: prod.id,
          nome: prod.nome,
          tipoEstoque: "estoque",
          estoqueAtual: prod.estoqueAtual,
          estoqueMinimo: prod.estoqueMinimo,
          disponivel: prod.estoqueAtual,
          alertaEstoqueBaixo: prod.estoqueMinimo > 0 && prod.estoqueAtual <= prod.estoqueMinimo,
          unidadeVenda: prod.unidadeVenda,
          pesoUnitarioGramas: prod.pesoUnitarioGramas,
        };
      }
    });

    return NextResponse.json(estoque);
  });
}
