import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (!(session.user as { isAdmin?: boolean })?.isAdmin) {
      return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get("tipo") || "pedidos";

    let csv = "";
    let filename = "";

    switch (tipo) {
      case "pedidos": {
        const pedidos = await prisma.pedido.findMany({
          include: {
            cliente: true,
            formaPagamento: true,
            itens: { include: { produto: true } },
          },
          orderBy: { id: "desc" },
        });

        csv = "ID;Cliente;Bairro;Cidade;Data Pedido;Data Entrega;Forma Pagamento;Total;Valor Pago;Situacao Pagamento;Status Entrega;Taxa Entrega;Produtos;Observacoes\n";
        for (const p of pedidos) {
          const produtos = p.itens
            .map((i) => `${i.produto.nome} x${i.quantidade}`)
            .join(", ");
          csv += [
            p.id,
            esc(p.cliente.nome),
            esc(p.cliente.bairro),
            esc(p.cliente.cidade),
            p.dataPedido,
            p.dataEntrega,
            p.formaPagamento?.nome || "",
            p.total.toFixed(2),
            p.valorPago.toFixed(2),
            p.situacaoPagamento,
            p.statusEntrega,
            p.taxaEntrega.toFixed(2),
            esc(produtos),
            esc(p.observacoes),
          ].join(";") + "\n";
        }
        filename = "pedidos.csv";
        break;
      }

      case "clientes": {
        const clientes = await prisma.cliente.findMany({ orderBy: { nome: "asc" } });
        csv = "ID;Nome;Telefone;Rua;Numero;Bairro;Cidade;Observacoes\n";
        for (const c of clientes) {
          csv += [c.id, esc(c.nome), c.telefone, esc(c.rua), c.numero, esc(c.bairro), esc(c.cidade), esc(c.observacoes)].join(";") + "\n";
        }
        filename = "clientes.csv";
        break;
      }

      case "produtos": {
        const produtos = await prisma.produto.findMany({ orderBy: { nome: "asc" } });
        csv = "ID;Nome;Preco\n";
        for (const p of produtos) {
          csv += [p.id, esc(p.nome), p.preco.toFixed(2)].join(";") + "\n";
        }
        filename = "produtos.csv";
        break;
      }

      case "contas": {
        const contas = await prisma.conta.findMany({ orderBy: { vencimento: "asc" } });
        csv = "ID;Fornecedor;Categoria;Valor;Vencimento;Situacao\n";
        for (const c of contas) {
          csv += [c.id, esc(c.fornecedorNome), esc(c.categoria), c.valor.toFixed(2), c.vencimento, c.situacao].join(";") + "\n";
        }
        filename = "contas.csv";
        break;
      }

      case "tudo": {
        // Export everything in one file with sections
        const pedidos = await prisma.pedido.findMany({
          include: { cliente: true, formaPagamento: true, itens: { include: { produto: true } } },
          orderBy: { id: "desc" },
        });
        const clientes = await prisma.cliente.findMany({ orderBy: { nome: "asc" } });
        const produtos = await prisma.produto.findMany({ orderBy: { nome: "asc" } });
        const contas = await prisma.conta.findMany({ orderBy: { vencimento: "asc" } });

        csv = "=== PEDIDOS ===\n";
        csv += "ID;Cliente;Bairro;Data Entrega;Forma Pagamento;Total;Valor Pago;Situacao Pagamento;Status Entrega;Produtos\n";
        for (const p of pedidos) {
          const prods = p.itens.map((i) => `${i.produto.nome} x${i.quantidade}`).join(", ");
          csv += [p.id, esc(p.cliente.nome), esc(p.cliente.bairro), p.dataEntrega, p.formaPagamento?.nome || "", p.total.toFixed(2), p.valorPago.toFixed(2), p.situacaoPagamento, p.statusEntrega, esc(prods)].join(";") + "\n";
        }

        csv += "\n=== CLIENTES ===\n";
        csv += "ID;Nome;Telefone;Rua;Numero;Bairro;Cidade\n";
        for (const c of clientes) {
          csv += [c.id, esc(c.nome), c.telefone, esc(c.rua), c.numero, esc(c.bairro), esc(c.cidade)].join(";") + "\n";
        }

        csv += "\n=== PRODUTOS ===\n";
        csv += "ID;Nome;Preco\n";
        for (const p of produtos) {
          csv += [p.id, esc(p.nome), p.preco.toFixed(2)].join(";") + "\n";
        }

        csv += "\n=== CONTAS ===\n";
        csv += "ID;Fornecedor;Categoria;Valor;Vencimento;Situacao\n";
        for (const c of contas) {
          csv += [c.id, esc(c.fornecedorNome), esc(c.categoria), c.valor.toFixed(2), c.vencimento, c.situacao].join(";") + "\n";
        }

        filename = "exportacao_completa.csv";
        break;
      }

      default:
        return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    // Add BOM for Excel UTF-8 compatibility
    const bom = "\uFEFF";
    return new NextResponse(bom + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Erro ao exportar:", error);
    return NextResponse.json({ error: "Erro ao exportar" }, { status: 500 });
  }
}

function esc(value: string) {
  if (!value) return "";
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}
