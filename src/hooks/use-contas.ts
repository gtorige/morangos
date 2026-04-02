import { useState, useCallback, useEffect } from "react";
import { formatDate } from "@/lib/formatting";

// ── Types ──

export interface Conta {
  id: number;
  fornecedorNome: string;
  categoria: string;
  categoriaId: number | null;
  subcategoriaId: number | null;
  tipoFinanceiro: string;
  valor: number;
  vencimento: string;
  situacao: string;
  parcelas: number;
  parcelaNumero: number;
  parcelaGrupoId: number | null;
  updatedAt?: string;
}

export interface Fornecedor {
  id: number;
  nome: string;
  _count: { contas: number };
}

export interface Categoria {
  id: number;
  nome: string;
  _count: { contas: number };
}

export interface Subcategoria {
  id: number;
  nome: string;
  categoriaId: number;
  _count: { contas: number };
}

export interface ContaForm {
  fornecedorNome: string;
  categoriaId: string;
  subcategoriaId: string;
  tipoFinanceiro: string;
  valor: string;
  vencimento: string;
  situacao: string;
  parcelas: string;
}

const emptyContaForm: ContaForm = {
  fornecedorNome: "",
  categoriaId: "",
  subcategoriaId: "",
  tipoFinanceiro: "",
  valor: "",
  vencimento: "",
  situacao: "Pendente",
  parcelas: "1",
};

/**
 * Hook for managing financial accounts: contas, fornecedores, categorias, subcategorias.
 */
export function useContas() {
  // Contas state
  const [contas, setContas] = useState<Conta[]>([]);
  const [contasLoading, setContasLoading] = useState(true);
  const [contaForm, setContaForm] = useState<ContaForm>(emptyContaForm);
  const [contaEditingId, setContaEditingId] = useState<number | null>(null);
  const [contaDialogOpen, setContaDialogOpen] = useState(false);

  // Fornecedores state
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [fornecedoresLoading, setFornecedoresLoading] = useState(true);

  // Categorias state
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriasLoading, setCategoriasLoading] = useState(true);

  // Subcategorias state
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);

  // ── Fetch functions ──

  const fetchContas = useCallback(async () => {
    try {
      setContasLoading(true);
      const res = await fetch("/api/contas");
      if (!res.ok) return;
      const data = await res.json();
      setContas(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Erro ao buscar contas:", e);
    } finally {
      setContasLoading(false);
    }
  }, []);

  const fetchFornecedores = useCallback(async () => {
    try {
      setFornecedoresLoading(true);
      const res = await fetch("/api/fornecedores");
      if (!res.ok) return;
      const data = await res.json();
      setFornecedores(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Erro ao buscar fornecedores:", e);
    } finally {
      setFornecedoresLoading(false);
    }
  }, []);

  const fetchCategorias = useCallback(async () => {
    try {
      setCategoriasLoading(true);
      const res = await fetch("/api/categorias");
      if (!res.ok) return;
      const data = await res.json();
      setCategorias(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Erro ao buscar categorias:", e);
    } finally {
      setCategoriasLoading(false);
    }
  }, []);

  const fetchSubcategorias = useCallback(async () => {
    try {
      const res = await fetch("/api/subcategorias");
      if (!res.ok) return;
      const data = await res.json();
      setSubcategorias(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Erro ao buscar subcategorias:", e);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchContas();
    fetchFornecedores();
    fetchCategorias();
    fetchSubcategorias();
  }, []);

  // ── Conta CRUD ──

  const openNewConta = useCallback(() => {
    setContaForm(emptyContaForm);
    setContaEditingId(null);
    setContaDialogOpen(true);
  }, []);

  const openEditConta = useCallback((item: Conta) => {
    setContaForm({
      fornecedorNome: item.fornecedorNome,
      categoriaId: item.categoriaId ? String(item.categoriaId) : "",
      subcategoriaId: item.subcategoriaId ? String(item.subcategoriaId) : "",
      tipoFinanceiro: item.tipoFinanceiro ?? "",
      valor: String(item.valor),
      vencimento: item.vencimento,
      situacao: item.situacao,
      parcelas: "1",
    });
    setContaEditingId(item.id);
    setContaDialogOpen(true);
  }, []);

  const handleContaSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contaForm.fornecedorNome) { alert("Selecione um fornecedor."); return; }
    if (!contaForm.valor || !contaForm.vencimento) { alert("Preencha valor e vencimento."); return; }

    const catId = contaForm.categoriaId ? Number(contaForm.categoriaId) : null;
    const catNome = catId ? (categorias.find((c) => c.id === catId)?.nome ?? "") : "";
    const totalParcelas = parseInt(contaForm.parcelas) || 1;
    const valorTotal = parseFloat(contaForm.valor);
    const baseBody = {
      fornecedorNome: contaForm.fornecedorNome,
      categoria: catNome,
      categoriaId: catId,
      subcategoriaId: contaForm.subcategoriaId ? Number(contaForm.subcategoriaId) : null,
      tipoFinanceiro: contaForm.tipoFinanceiro,
      situacao: contaForm.situacao,
      parcelas: totalParcelas,
    };

    try {
      if (contaEditingId) {
        await fetch(`/api/contas/${contaEditingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...baseBody, valor: valorTotal, vencimento: contaForm.vencimento }),
        });
      } else {
        // Server-side criarContaComParcelas handles atomicity, splitting, and grupoId
        const res = await fetch("/api/contas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...baseBody, valor: valorTotal, vencimento: contaForm.vencimento }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Erro ${res.status}`);
        }
      }
      setContaDialogOpen(false);
      setContaEditingId(null);
      setContaForm(emptyContaForm);
      fetchContas();
    } catch (error) {
      console.error("Erro ao salvar conta:", error);
    }
  }, [contaForm, contaEditingId, categorias, fetchContas]);

  const handleContaDelete = useCallback(async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir esta conta?")) return;
    try {
      await fetch(`/api/contas/${id}`, { method: "DELETE" });
      fetchContas();
    } catch (error) {
      console.error("Erro ao excluir conta:", error);
    }
  }, [fetchContas]);

  // ── Bulk operations ──

  const bulkUpdateSituacao = useCallback(async (ids: number[], situacao: "Pago" | "Pendente") => {
    const target = contas.filter((c) => ids.includes(c.id) && c.situacao !== situacao);
    if (target.length === 0) return;
    await Promise.all(
      target.map((c) =>
        fetch(`/api/contas/${c.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ situacao }),
        })
      )
    );
    fetchContas();
  }, [contas, fetchContas]);

  const bulkDelete = useCallback(async (ids: number[]) => {
    if (!confirm(`Deseja excluir ${ids.length} conta(s)?`)) return;
    await Promise.all(ids.map((id) => fetch(`/api/contas/${id}`, { method: "DELETE" })));
    fetchContas();
  }, [fetchContas]);

  // ── Group edit ──

  const handleGrupoEdit = useCallback(async (grupoId: number, payload: Record<string, unknown>) => {
    const parcelas = contas.filter((c) => c.parcelaGrupoId === grupoId);
    await Promise.all(
      parcelas.map((p) =>
        fetch(`/api/contas/${p.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      )
    );
    fetchContas();
  }, [contas, fetchContas]);

  // ── CSV export ──

  const exportContasCSV = useCallback((filteredContas: Conta[], visibleColumns: { key: string; label: string }[]) => {
    const header = visibleColumns.map((c) => c.label);
    const csvRows = filteredContas.map((conta) =>
      visibleColumns.map((c) => {
        switch (c.key) {
          case "fornecedor": return conta.fornecedorNome;
          case "categoria": return conta.categoria;
          case "subcategoria": return subcategorias.find((s) => s.id === conta.subcategoriaId)?.nome ?? "";
          case "tipo": return conta.tipoFinanceiro ?? "";
          case "parcelas": return conta.parcelas > 1 ? `${conta.parcelaNumero}/${conta.parcelas}` : "";
          case "valor": return conta.valor.toFixed(2).replace(".", ",");
          case "vencimento": return formatDate(conta.vencimento);
          case "situacao": return conta.situacao;
          default: return "";
        }
      })
    );
    const csv = [header, ...csvRows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "financeiro.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [subcategorias]);

  const fornecedorNames = fornecedores.map((f) => f.nome);

  return {
    // Contas
    contas,
    contasLoading,
    contaForm, setContaForm,
    contaEditingId,
    contaDialogOpen, setContaDialogOpen,
    openNewConta,
    openEditConta,
    handleContaSubmit,
    handleContaDelete,
    fetchContas,

    // Fornecedores
    fornecedores,
    fornecedoresLoading,
    fornecedorNames,
    fetchFornecedores,

    // Categorias
    categorias,
    categoriasLoading,
    fetchCategorias,

    // Subcategorias
    subcategorias,
    fetchSubcategorias,

    // Bulk
    bulkUpdateSituacao,
    bulkDelete,

    // Group
    handleGrupoEdit,

    // Export
    exportContasCSV,
  };
}
