import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";

// ── Types ──

export interface CriarContaInput {
  fornecedorId?: number | null;
  fornecedorNome?: string;
  categoria?: string;
  categoriaId?: number | null;
  subcategoriaId?: number | null;
  tipoFinanceiro?: string;
  valor: number;
  vencimento: string;
  situacao?: string;
  parcelas?: number;
}

export interface EditarGrupoInput {
  fornecedorNome?: string;
  categoria?: string;
  categoriaId?: number | null;
  subcategoriaId?: number | null;
  tipoFinanceiro?: string;
}

// ── Criar conta com parcelas ──

/**
 * Cria uma conta com N parcelas em uma unica transacao.
 * O valor total e dividido igualmente entre as parcelas.
 * Vencimentos sao escalonados mensalmente a partir da data base.
 */
export async function criarContaComParcelas(input: CriarContaInput) {
  const totalParcelas = input.parcelas ?? 1;
  const valorTotal = input.valor;
  const valorParcela = totalParcelas > 1
    ? parseFloat((valorTotal / totalParcelas).toFixed(2))
    : valorTotal;

  const baseDate = new Date(input.vencimento + "T12:00:00");
  const now = new Date().toISOString();

  const baseData = {
    fornecedorId: input.fornecedorId ?? null,
    fornecedorNome: input.fornecedorNome ?? "",
    categoria: input.categoria ?? "",
    categoriaId: input.categoriaId ?? null,
    subcategoriaId: input.subcategoriaId ?? null,
    tipoFinanceiro: input.tipoFinanceiro ?? "",
    situacao: input.situacao ?? "Pendente",
    parcelas: totalParcelas,
  };

  return prisma.$transaction(async (tx) => {
    // Criar primeira parcela para obter o grupoId
    const first = await tx.conta.create({
      data: {
        ...baseData,
        valor: valorParcela,
        vencimento: baseDate.toISOString().slice(0, 10),
        parcelaNumero: 1,
        updatedAt: now,
      },
    });

    const grupoId = first.id;

    // Atualizar primeira parcela com o grupoId
    await tx.conta.update({
      where: { id: grupoId },
      data: { parcelaGrupoId: grupoId },
    });

    // Criar parcelas restantes
    const parcelas = [first];
    for (let i = 1; i < totalParcelas; i++) {
      const venc = new Date(baseDate);
      venc.setMonth(venc.getMonth() + i);

      const parcela = await tx.conta.create({
        data: {
          ...baseData,
          valor: valorParcela,
          vencimento: venc.toISOString().slice(0, 10),
          parcelaNumero: i + 1,
          parcelaGrupoId: grupoId,
          updatedAt: now,
        },
      });
      parcelas.push(parcela);
    }

    return parcelas;
  });
}

// ── Editar grupo de parcelas ──

/**
 * Atualiza os dados comuns de todas as parcelas de um grupo
 * (fornecedor, categoria, subcategoria, tipo financeiro) em uma unica transacao.
 */
export async function editarGrupoParcelas(grupoId: number, payload: EditarGrupoInput) {
  return prisma.$transaction(async (tx) => {
    const parcelas = await tx.conta.findMany({
      where: { parcelaGrupoId: grupoId },
    });

    if (parcelas.length === 0) {
      throw new ApiError("Grupo de parcelas nao encontrado.", 404);
    }

    const now = new Date().toISOString();

    const updated = await Promise.all(
      parcelas.map((p) =>
        tx.conta.update({
          where: { id: p.id },
          data: {
            fornecedorNome: payload.fornecedorNome ?? p.fornecedorNome,
            categoria: payload.categoria ?? p.categoria,
            categoriaId: payload.categoriaId !== undefined ? payload.categoriaId : p.categoriaId,
            subcategoriaId: payload.subcategoriaId !== undefined ? payload.subcategoriaId : p.subcategoriaId,
            tipoFinanceiro: payload.tipoFinanceiro ?? p.tipoFinanceiro,
            updatedAt: now,
          },
        })
      )
    );

    return updated;
  });
}
