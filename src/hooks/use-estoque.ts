import { useState, useCallback, useEffect } from "react";
import { todayStr } from "@/lib/formatting";
import type { Produto, EstoqueDia, MovimentacaoEstoque } from "@/lib/types";

/**
 * Hook for managing stock data: daily stock, movements, products.
 */
export function useEstoque() {
  const [estoque, setEstoque] = useState<EstoqueDia[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEstoque[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters for movimentacoes tab
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroDataDe, setFiltroDataDe] = useState("");
  const [filtroDataAte, setFiltroDataAte] = useState("");
  const [filtroProdutoId, setFiltroProdutoId] = useState("");

  const fetchEstoque = useCallback(async () => {
    try {
      const res = await fetch(`/api/estoque/dia?data=${todayStr()}`);
      if (!res.ok) return;
      const data = await res.json();
      setEstoque(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao buscar estoque:", err);
    }
  }, []);

  const fetchMovimentacoes = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filtroTipo !== "todos") params.set("tipo", filtroTipo);
      if (filtroDataDe) params.set("dataDe", filtroDataDe);
      if (filtroDataAte) params.set("dataAte", filtroDataAte);
      if (filtroProdutoId) params.set("produtoId", filtroProdutoId);
      const res = await fetch(`/api/movimentacoes?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setMovimentacoes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao buscar movimentações:", err);
    }
  }, [filtroTipo, filtroDataDe, filtroDataAte, filtroProdutoId]);

  const fetchProdutos = useCallback(async () => {
    try {
      const res = await fetch("/api/produtos");
      if (!res.ok) return;
      const data = await res.json();
      setProdutos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao buscar produtos:", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchEstoque(), fetchProdutos()]);
      setLoading(false);
    }
    load();
  }, [fetchEstoque, fetchProdutos]);

  // Derived data
  const frescos = estoque.filter((e) => e.tipoEstoque === "diario");
  const acumulados = estoque.filter((e) => e.tipoEstoque === "estoque");
  const produtosFrescos = produtos.filter((p) => p.tipoEstoque === "diario");
  const produtosAcumulados = produtos.filter((p) => p.tipoEstoque === "estoque");

  // Congelar
  const handleCongelar = useCallback(async (formData: {
    produtoFrescoId: number;
    produtoCongeladoId: number;
    quantidadeKg: number;
    perdaKg: number;
    data: string;
    observacao?: string;
  }) => {
    setSaving(true);
    try {
      const res = await fetch("/api/congelamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        await fetchEstoque();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Erro ao congelar:", err);
      return false;
    } finally {
      setSaving(false);
    }
  }, [fetchEstoque]);

  // Movimentar
  const handleMovimentar = useCallback(async (formData: {
    produtoId: number;
    tipo: string;
    quantidade: number;
    unidade: string;
    motivo?: string;
    data: string;
  }) => {
    setSaving(true);
    try {
      const res = await fetch("/api/movimentacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        await fetchEstoque();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Erro ao movimentar:", err);
      return false;
    } finally {
      setSaving(false);
    }
  }, [fetchEstoque]);

  // Edit movimentação
  const handleEditMovimentacao = useCallback(async (id: number, data: { quantidade?: number; motivo?: string; data?: string }) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/movimentacoes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await Promise.all([fetchEstoque(), fetchMovimentacoes()]);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Erro ao editar movimentação:", err);
      return false;
    } finally {
      setSaving(false);
    }
  }, [fetchEstoque, fetchMovimentacoes]);

  // Delete movimentação
  const handleDeleteMovimentacao = useCallback(async (id: number) => {
    if (!confirm("Excluir esta movimentação?")) return false;
    try {
      await fetch(`/api/movimentacoes/${id}`, { method: "DELETE" });
      await Promise.all([fetchEstoque(), fetchMovimentacoes()]);
      return true;
    } catch (err) {
      console.error("Erro ao excluir movimentação:", err);
      return false;
    }
  }, [fetchEstoque, fetchMovimentacoes]);

  return {
    // Data
    estoque,
    movimentacoes,
    produtos,
    loading,
    saving,

    // Derived
    frescos,
    acumulados,
    produtosFrescos,
    produtosAcumulados,

    // Filters
    filtroTipo, setFiltroTipo,
    filtroDataDe, setFiltroDataDe,
    filtroDataAte, setFiltroDataAte,
    filtroProdutoId, setFiltroProdutoId,

    // Actions
    fetchEstoque,
    fetchMovimentacoes,
    fetchProdutos,
    handleCongelar,
    handleMovimentar,
    handleEditMovimentacao,
    handleDeleteMovimentacao,
  };
}
