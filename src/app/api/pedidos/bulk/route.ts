import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { pedidoBulkSchema } from "@/lib/schemas";

export async function PATCH(request: NextRequest) {
  return withAuth(async () => {
    const { ids, action, dataEntrega } = await parseBody(
      request,
      pedidoBulkSchema
    );

    if (action === "pago") {
      const pedidos = await prisma.pedido.findMany({
        where: { id: { in: ids } },
        select: { id: true, total: true, valorPago: true },
      });

      await prisma.$transaction(
        pedidos.map((p) =>
          prisma.pedido.update({
            where: { id: p.id },
            data: {
              situacaoPagamento: "Pago",
              valorPago: Math.max(p.valorPago, p.total),
              ...(dataEntrega ? { dataEntrega } : {}),
            },
          })
        )
      );

      return NextResponse.json({
        message: `${pedidos.length} pedidos atualizados.`,
        count: pedidos.length,
      });
    }

    // Ações que alteram statusEntrega precisam de lógica de estoque
    if (action === "entregue") {
      const pedidos = await prisma.pedido.findMany({
        where: { id: { in: ids }, statusEntrega: { not: "Entregue" } },
        include: { cliente: true, itens: { include: { produto: true } } },
      });

      const now = new Date().toISOString();
      let count = 0;
      const erros: string[] = [];

      for (const pedido of pedidos) {
        const itensEstoque = pedido.itens.filter(
          (item) => item.produto.tipoEstoque === "estoque"
        );

        // Verificar estoque suficiente
        const semEstoque = itensEstoque.some(
          (item) => item.produto.estoqueAtual < item.quantidade
        );
        if (semEstoque) {
          erros.push(`Pedido #${pedido.id}: estoque insuficiente`);
          continue;
        }

        await prisma.$transaction(async (tx) => {
          for (const item of pedido.itens) {
            if (item.produto.tipoEstoque === "estoque") {
              const saldoInicial = item.produto.estoqueAtual;
              await tx.movimentacaoEstoque.create({
                data: {
                  produtoId: item.produtoId,
                  tipo: "pedido",
                  quantidade: -item.quantidade,
                  unidade: "un",
                  saldoInicial,
                  saldoFinal: saldoInicial - item.quantidade,
                  motivo: `Pedido #${pedido.id} — ${pedido.cliente?.nome || ""}`.trim(),
                  referencia: String(pedido.id),
                  data: pedido.dataEntrega,
                  criadoEm: now,
                },
              });
              await tx.produto.update({
                where: { id: item.produtoId },
                data: { estoqueAtual: { decrement: item.quantidade } },
              });
            } else {
              const pesoKg = item.produto.pesoUnitarioGramas
                ? (item.quantidade * item.produto.pesoUnitarioGramas) / 1000
                : item.quantidade;
              const unidade = item.produto.pesoUnitarioGramas ? "kg" : "un";
              const colheitasDia = await tx.colheita.findMany({
                where: { produtoId: item.produtoId, data: pedido.dataEntrega },
              });
              const colhido = colheitasDia.reduce((s, c) => s + c.quantidade, 0);
              const saidasDia = await tx.movimentacaoEstoque.findMany({
                where: { produtoId: item.produtoId, data: pedido.dataEntrega, tipo: "pedido" },
              });
              const jaSaiu = saidasDia.reduce((s, m) => s + Math.abs(m.quantidade), 0);
              const saldoInicial = colhido - jaSaiu;
              await tx.movimentacaoEstoque.create({
                data: {
                  produtoId: item.produtoId,
                  tipo: "pedido",
                  quantidade: -pesoKg,
                  unidade,
                  saldoInicial,
                  saldoFinal: saldoInicial - pesoKg,
                  motivo: `Pedido #${pedido.id} — ${pedido.cliente?.nome || ""}`.trim(),
                  referencia: String(pedido.id),
                  data: pedido.dataEntrega,
                  criadoEm: now,
                },
              });
            }
          }
          await tx.pedido.update({
            where: { id: pedido.id },
            data: { statusEntrega: "Entregue", ...(dataEntrega ? { dataEntrega } : {}) },
          });
        });
        count++;
      }

      return NextResponse.json({
        message: `${count} pedidos entregues.`,
        count,
        ...(erros.length > 0 ? { erros } : {}),
      });
    }

    if (action === "cancelado" || action === "pendente_entrega") {
      // Reverter estoque de pedidos que estavam "Entregue"
      const targetStatus = action === "cancelado" ? "Cancelado" : "Pendente";
      const entregues = await prisma.pedido.findMany({
        where: { id: { in: ids }, statusEntrega: "Entregue" },
        select: { id: true },
      });

      for (const pedido of entregues) {
        await prisma.$transaction(async (tx) => {
          const movs = await tx.movimentacaoEstoque.findMany({
            where: { referencia: String(pedido.id), tipo: "pedido" },
            include: { produto: true },
          });
          for (const mov of movs) {
            if (mov.produto.tipoEstoque === "estoque") {
              await tx.produto.update({
                where: { id: mov.produtoId },
                data: { estoqueAtual: { increment: Math.abs(mov.quantidade) } },
              });
            }
          }
          await tx.movimentacaoEstoque.deleteMany({
            where: { referencia: String(pedido.id), tipo: "pedido" },
          });
        });
      }

      await prisma.pedido.updateMany({
        where: { id: { in: ids } },
        data: { statusEntrega: targetStatus, ...(dataEntrega ? { dataEntrega } : {}) },
      });

      return NextResponse.json({
        message: `${ids.length} pedidos atualizados.`,
        count: ids.length,
      });
    }

    // pendente_pagamento
    await prisma.pedido.updateMany({
      where: { id: { in: ids } },
      data: { situacaoPagamento: "Pendente", valorPago: 0, ...(dataEntrega ? { dataEntrega } : {}) },
    });

    return NextResponse.json({
      message: `${ids.length} pedidos atualizados.`,
      count: ids.length,
    });
  });
}
