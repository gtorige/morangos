"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { parseISO, isToday, isPast } from "date-fns";
import { Button } from "@/components/ui/button";
import { TabsNav } from "@/components/ui/tabs-nav";
import { Plus, Receipt, Store, Tag } from "lucide-react";
import { formatPrice, formatDate } from "@/lib/formatting";
import type { Conta, Fornecedor, Categoria, Subcategoria, ContaForm } from "@/hooks/use-contas";

import { ContaTable } from "./_components/ContaTable";
import { ContaFormDialog } from "./_components/ContaFormDialog";
import { ContaFilters } from "./_components/ContaFilters";
import { FornecedoresTab } from "./_components/FornecedoresTab";
import { CategoriasTab } from "./_components/CategoriasTab";

type Tab = "contas" | "fornecedores" | "categorias";

// ── Column config ──

type ContaColKey = "fornecedor" | "categoria" | "subcategoria" | "tipo" | "parcelas" | "valor" | "vencimento" | "situacao";

const COLUNAS_CONTAS_DEFAULT: { key: ContaColKey; label: string; visible: boolean; required?: boolean }[] = [
  { key: "fornecedor", label: "Fornecedor", visible: true, required: true },
  { key: "categoria", label: "Categoria", visible: true },
  { key: "subcategoria", label: "Subcategoria", visible: true },
  { key: "tipo", label: "Tipo", visible: true },
  { key: "parcelas", label: "Parcelas", visible: true },
  { key: "valor", label: "Valor", visible: true, required: true },
  { key: "vencimento", label: "Vencimento", visible: true },
  { key: "situacao", label: "Situação", visible: true, required: true },
];

const COLUNAS_STORAGE_KEY = "contas-columns-v1";

function loadColunasContas(): typeof COLUNAS_CONTAS_DEFAULT {
  if (typeof window === "undefined") return COLUNAS_CONTAS_DEFAULT;
  try {
    const stored = localStorage.getItem(COLUNAS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const keys = new Set(parsed.map((c: { key: string }) => c.key));
        const missing = COLUNAS_CONTAS_DEFAULT.filter((c) => !keys.has(c.key));
        return [...parsed, ...missing];
      }
    }
  } catch {}
  return COLUNAS_CONTAS_DEFAULT;
}

// ── Constants ──

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

// ── Component ──

export default function ContasPageWrapper() {
  return <Suspense><ContasPage /></Suspense>;
}

function ContasPage() {
  const [tab, setTab] = useState<Tab>("contas");

  // Contas state
  const [contas, setContas] = useState<Conta[]>([]);
  const [contasLoading, setContasLoading] = useState(true);
  const [contaForm, setContaForm] = useState<ContaForm>(emptyContaForm);
  const [contaEditingId, setContaEditingId] = useState<number | null>(null);
  const [contaDialogOpen, setContaDialogOpen] = useState(false);

  // Fornecedores state
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [fornecedoresLoading, setFornecedoresLoading] = useState(true);
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [fornecedorEditingId, setFornecedorEditingId] = useState<number | null>(null);
  const [fornecedorDialogOpen, setFornecedorDialogOpen] = useState(false);
  const [fornecedorError, setFornecedorError] = useState("");

  // Categorias state
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriasLoading, setCategoriasLoading] = useState(true);
  const [categoriaNome, setCategoriaNome] = useState("");
  const [categoriaEditingId, setCategoriaEditingId] = useState<number | null>(null);
  const [categoriaDialogOpen, setCategoriaDialogOpen] = useState(false);
  const [categoriaError, setCategoriaError] = useState("");

  // Subcategorias state
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [subcategoriaEditingCatId, setSubcategoriaEditingCatId] = useState<number | null>(null);
  const [subcategoriaNome, setSubcategoriaNome] = useState("");
  const [subcategoriaDialogOpen, setSubcategoriaDialogOpen] = useState(false);
  const [subcategoriaError, setSubcategoriaError] = useState("");

  // Expanded parcela groups
  const [expandedGrupos, setExpandedGrupos] = useState<Set<string>>(new Set());
  function toggleGrupo(key: string) {
    setExpandedGrupos((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }

  // Filters
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterBusca, setFilterBusca] = useState("");
  const [filterCategoriaId, setFilterCategoriaId] = useState("");
  const [filterSubcategoriaId, setFilterSubcategoriaId] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterSituacao, setFilterSituacao] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("situacao") || "";
  });
  const [filterVencDe, setFilterVencDe] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("dataInicio") || "";
  });
  const [filterVencAte, setFilterVencAte] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("dataFim") || "";
  });

  const [sortField, setSortField] = useState<ContaColKey>("vencimento");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Apply URL params when searchParams changes
  useEffect(() => {
    const urlSituacao = searchParams.get("situacao");
    const urlDataInicio = searchParams.get("dataInicio");
    const urlDataFim = searchParams.get("dataFim");
    if (urlSituacao || urlDataInicio || urlDataFim) {
      if (urlSituacao) setFilterSituacao(urlSituacao);
      if (urlDataInicio) setFilterVencDe(urlDataInicio);
      if (urlDataFim) setFilterVencAte(urlDataFim);
    }
  }, [searchParams]);

  const filteredContas = useMemo(() => {
    const filtered = contas.filter((c) => {
      if (filterBusca && !c.fornecedorNome.toLowerCase().includes(filterBusca.toLowerCase())) return false;
      if (filterCategoriaId && String(c.categoriaId) !== filterCategoriaId) return false;
      if (filterSubcategoriaId && String(c.subcategoriaId) !== filterSubcategoriaId) return false;
      if (filterTipo && c.tipoFinanceiro !== filterTipo) return false;
      if (filterSituacao === "Pago" && c.situacao !== "Pago") return false;
      if (filterSituacao === "Pendente") {
        if (c.situacao !== "Pendente") return false;
        try {
          const v = parseISO(c.vencimento);
          if (isPast(v) && !isToday(v)) return false;
        } catch {}
      }
      if (filterSituacao === "Vencida") {
        if (c.situacao !== "Pendente") return false;
        try {
          const v = parseISO(c.vencimento);
          if (!isPast(v) && !isToday(v)) return false;
        } catch {
          return false;
        }
      }
      if (filterVencDe && c.vencimento < filterVencDe) return false;
      if (filterVencAte && c.vencimento > filterVencAte) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      switch (sortField) {
        case "fornecedor": return a.fornecedorNome.localeCompare(b.fornecedorNome) * dir;
        case "categoria": return (a.categoria || "").localeCompare(b.categoria || "") * dir;
        case "tipo": return (a.tipoFinanceiro || "").localeCompare(b.tipoFinanceiro || "") * dir;
        case "parcelas": return ((a.parcelas || 1) - (b.parcelas || 1)) * dir;
        case "valor": return (a.valor - b.valor) * dir;
        case "situacao": return a.situacao.localeCompare(b.situacao) * dir;
        case "vencimento":
        default: return a.vencimento.localeCompare(b.vencimento) * dir;
      }
    });
  }, [contas, filterBusca, filterCategoriaId, filterSubcategoriaId, filterTipo, filterSituacao, filterVencDe, filterVencAte, sortField, sortDir]);

  const activeFiltersCount = [filterBusca, filterCategoriaId, filterSubcategoriaId, filterTipo, filterSituacao, filterVencDe, filterVencAte].filter(Boolean).length;

  function resetFilters() {
    setFilterBusca("");
    setFilterCategoriaId("");
    setFilterSubcategoriaId("");
    setFilterTipo("");
    setFilterSituacao("");
    setFilterVencDe("");
    setFilterVencAte("");
  }

  // Column config
  const [colunasConfig, setColunasConfig] = useState(COLUNAS_CONTAS_DEFAULT);
  const [colunasOpen, setColunasOpen] = useState(false);
  const colunasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setColunasConfig(loadColunasContas());
  }, []);

  useEffect(() => {
    if (!colunasOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (colunasRef.current && !colunasRef.current.contains(e.target as Node)) setColunasOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [colunasOpen]);

  const moveCol = useCallback((i: number, dir: -1 | 1) => {
    setColunasConfig((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      localStorage.setItem(COLUNAS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleCol = useCallback((key: ContaColKey) => {
    setColunasConfig((prev) => {
      const next = prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c));
      localStorage.setItem(COLUNAS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Group parent edit
  const [grupoEditOpen, setGrupoEditOpen] = useState(false);
  const [grupoEditGrupoId, setGrupoEditGrupoId] = useState<number | null>(null);
  const [grupoEditForm, setGrupoEditForm] = useState({
    fornecedorNome: "",
    categoriaId: "",
    subcategoriaId: "",
    tipoFinanceiro: "",
  });

  async function handleGrupoEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!grupoEditGrupoId) return;
    const catId = grupoEditForm.categoriaId ? Number(grupoEditForm.categoriaId) : null;
    const catNome = catId ? (categorias.find((c) => c.id === catId)?.nome ?? "") : "";
    try {
      await fetch(`/api/contas/grupo/${grupoEditGrupoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fornecedorNome: grupoEditForm.fornecedorNome,
          categoria: catNome,
          categoriaId: catId,
          subcategoriaId: grupoEditForm.subcategoriaId ? Number(grupoEditForm.subcategoriaId) : null,
          tipoFinanceiro: grupoEditForm.tipoFinanceiro,
        }),
      });
      setGrupoEditOpen(false);
      fetchContas();
    } catch (e) {
      console.error("Erro ao editar grupo:", e);
    }
  }

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleSelectAll() {
    const visibleIds = filteredContas.map((c) => c.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(visibleIds));
  }
  async function handleBulkPago() {
    const ids = Array.from(selectedIds);
    const pendentes = contas.filter((c) => ids.includes(c.id) && c.situacao === "Pendente");
    if (pendentes.length === 0) return;
    await Promise.all(
      pendentes.map((c) =>
        fetch(`/api/contas/${c.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ situacao: "Pago", updatedAt: c.updatedAt }),
        })
      )
    );
    setSelectedIds(new Set());
    fetchContas();
  }
  async function handleBulkPendente() {
    const ids = Array.from(selectedIds);
    const pagas = contas.filter((c) => ids.includes(c.id) && c.situacao === "Pago");
    if (pagas.length === 0) return;
    await Promise.all(
      pagas.map((c) =>
        fetch(`/api/contas/${c.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ situacao: "Pendente", updatedAt: c.updatedAt }),
        })
      )
    );
    setSelectedIds(new Set());
    fetchContas();
  }
  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (!confirm(`Deseja excluir ${ids.length} conta(s)?`)) return;
    for (const id of ids) {
      await fetch(`/api/contas/${id}`, { method: "DELETE" });
    }
    setSelectedIds(new Set());
    fetchContas();
  }

  // CSV export
  function exportContasCSV() {
    const visCols = colunasConfig.filter((c) => c.visible);
    const header = visCols.map((c) => c.label);
    const csvRows = filteredContas.map((conta) =>
      visCols.map((c) => {
        switch (c.key) {
          case "fornecedor": return conta.fornecedorNome;
          case "categoria": return getCategoriaNome(conta);
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
  }

  function exportFornecedoresCSV() {
    const csv = ["Nome;Contas", ...fornecedores.map((f) => `"${f.nome}";${f._count.contas}`)].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fornecedores.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Fornecedor names for autocomplete
  const fornecedorNames = fornecedores.map((f) => f.nome);

  useEffect(() => {
    fetchContas();
    fetchFornecedores();
    fetchCategorias();
    fetchSubcategorias();
  }, []);

  // ── Contas CRUD ──

  async function fetchContas() {
    try {
      setContasLoading(true);
      const res = await fetch("/api/contas");
      if (!res.ok) return;
      const contasData = await res.json();
      setContas(Array.isArray(contasData) ? contasData : []);
    } catch (e) {
      console.error("Erro ao buscar contas:", e);
    } finally {
      setContasLoading(false);
    }
  }

  function openNewConta() {
    setContaForm(emptyContaForm);
    setContaEditingId(null);
    setContaDialogOpen(true);
  }

  function openEditConta(item: Conta) {
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
  }

  async function handleContaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contaForm.fornecedorNome) {
      alert("Selecione um fornecedor.");
      return;
    }
    if (!contaForm.valor || !contaForm.vencimento) {
      alert("Preencha valor e vencimento.");
      return;
    }
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
          body: JSON.stringify({ ...baseBody, valor: valorTotal, vencimento: contaForm.vencimento, updatedAt: contas.find((c) => c.id === contaEditingId)?.updatedAt }),
        });
      } else {
        // Server-side handles parcela creation in a transaction
        await fetch("/api/contas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...baseBody, valor: valorTotal, vencimento: contaForm.vencimento }),
        });
      }
      setContaDialogOpen(false);
      setContaForm(emptyContaForm);
      setContaEditingId(null);
      fetchContas();
    } catch (e) {
      console.error("Erro ao salvar conta:", e);
    }
  }

  async function handleDeleteConta(id: number) {
    if (!confirm("Deseja realmente excluir esta conta?")) return;
    try {
      await fetch(`/api/contas/${id}`, { method: "DELETE" });
      fetchContas();
    } catch (e) {
      console.error("Erro ao excluir conta:", e);
    }
  }

  async function handleMarkPago(id: number) {
    try {
      const conta = contas.find((c) => c.id === id);
      await fetch(`/api/contas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situacao: "Pago", updatedAt: conta?.updatedAt }),
      });
      fetchContas();
    } catch (e) {
      console.error("Erro ao marcar como pago:", e);
    }
  }

  // ── Fornecedores CRUD ──

  async function fetchFornecedores() {
    try {
      setFornecedoresLoading(true);
      const res = await fetch("/api/fornecedores");
      if (!res.ok) return;
      const fornData = await res.json();
      setFornecedores(Array.isArray(fornData) ? fornData : []);
    } catch (e) {
      console.error("Erro ao buscar fornecedores:", e);
    } finally {
      setFornecedoresLoading(false);
    }
  }

  function openNewFornecedor() {
    setFornecedorNome("");
    setFornecedorEditingId(null);
    setFornecedorError("");
    setFornecedorDialogOpen(true);
  }

  function openEditFornecedor(item: Fornecedor) {
    setFornecedorNome(item.nome);
    setFornecedorEditingId(item.id);
    setFornecedorError("");
    setFornecedorDialogOpen(true);
  }

  async function handleFornecedorSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFornecedorError("");
    try {
      const url = fornecedorEditingId ? `/api/fornecedores/${fornecedorEditingId}` : "/api/fornecedores";
      const method = fornecedorEditingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: fornecedorNome }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFornecedorError(data.error || "Erro ao salvar");
        return;
      }
      setFornecedorDialogOpen(false);
      fetchFornecedores();
    } catch (e) {
      console.error("Erro ao salvar fornecedor:", e);
      setFornecedorError("Erro ao salvar fornecedor");
    }
  }

  async function handleDeleteFornecedor(id: number) {
    if (!confirm("Deseja realmente excluir este fornecedor?")) return;
    try {
      const res = await fetch(`/api/fornecedores/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Erro ao excluir");
        return;
      }
      fetchFornecedores();
    } catch (e) {
      console.error("Erro ao excluir fornecedor:", e);
    }
  }

  // ── Subcategorias CRUD ──

  async function fetchSubcategorias() {
    try {
      const res = await fetch("/api/subcategorias");
      if (!res.ok) return;
      const data = await res.json();
      setSubcategorias(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Erro ao buscar subcategorias:", e);
    }
  }

  function openNewSubcategoria(categoriaId: number) {
    setSubcategoriaEditingCatId(categoriaId);
    setSubcategoriaNome("");
    setSubcategoriaError("");
    setSubcategoriaDialogOpen(true);
  }

  async function handleSubcategoriaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubcategoriaError("");
    if (!subcategoriaEditingCatId) return;
    try {
      const res = await fetch("/api/subcategorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: subcategoriaNome, categoriaId: subcategoriaEditingCatId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSubcategoriaError(data.error || "Erro ao salvar");
        return;
      }
      setSubcategoriaDialogOpen(false);
      fetchSubcategorias();
    } catch (e) {
      console.error("Erro ao salvar subcategoria:", e);
      setSubcategoriaError("Erro ao salvar subcategoria");
    }
  }

  async function handleDeleteSubcategoria(id: number) {
    if (!confirm("Deseja realmente excluir esta subcategoria?")) return;
    try {
      const res = await fetch(`/api/subcategorias/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Erro ao excluir");
        return;
      }
      fetchSubcategorias();
    } catch (e) {
      console.error("Erro ao excluir subcategoria:", e);
    }
  }

  // ── Categorias CRUD ──

  async function fetchCategorias() {
    try {
      setCategoriasLoading(true);
      const res = await fetch("/api/categorias");
      if (!res.ok) return;
      const catData = await res.json();
      setCategorias(Array.isArray(catData) ? catData : []);
    } catch (e) {
      console.error("Erro ao buscar categorias:", e);
    } finally {
      setCategoriasLoading(false);
    }
  }

  function openNewCategoria() {
    setCategoriaNome("");
    setCategoriaEditingId(null);
    setCategoriaError("");
    setCategoriaDialogOpen(true);
  }

  function openEditCategoria(item: Categoria) {
    setCategoriaNome(item.nome);
    setCategoriaEditingId(item.id);
    setCategoriaError("");
    setCategoriaDialogOpen(true);
  }

  async function handleCategoriaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCategoriaError("");
    try {
      const url = categoriaEditingId ? `/api/categorias/${categoriaEditingId}` : "/api/categorias";
      const method = categoriaEditingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: categoriaNome }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCategoriaError(data.error || "Erro ao salvar");
        return;
      }
      setCategoriaDialogOpen(false);
      setCategoriaEditingId(null);
      fetchCategorias();
    } catch (e) {
      console.error("Erro ao salvar categoria:", e);
      setCategoriaError("Erro ao salvar categoria");
    }
  }

  async function handleDeleteCategoria(id: number) {
    if (!confirm("Deseja realmente excluir esta categoria?")) return;
    try {
      const res = await fetch(`/api/categorias/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Erro ao excluir");
        return;
      }
      fetchCategorias();
    } catch (e) {
      console.error("Erro ao excluir categoria:", e);
    }
  }

  // ── Helpers ──

  function getCategoriaNome(conta: Conta) {
    if (conta.categoriaId) {
      const cat = categorias.find((c) => c.id === conta.categoriaId);
      if (cat) return cat.nome;
    }
    return conta.categoria || "";
  }

  // ── Render ──

  const tabs: { key: Tab; label: string; icon: typeof Receipt }[] = [
    { key: "contas", label: "Contas", icon: Receipt },
    { key: "fornecedores", label: "Fornecedores", icon: Store },
    { key: "categorias", label: "Categorias", icon: Tag },
  ];

  function getAddButtonLabel() {
    if (tab === "contas") return "Nova Conta";
    if (tab === "fornecedores") return "Novo Fornecedor";
    return "Nova Categoria";
  }

  function handleAddButton() {
    if (tab === "contas") openNewConta();
    else if (tab === "fornecedores") openNewFornecedor();
    else openNewCategoria();
  }

  const visCols = colunasConfig.filter((c) => c.visible);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="size-5" />
          <h1 className="text-2xl font-semibold">Financeiro</h1>
        </div>
        <Button onClick={handleAddButton}>
          <Plus className="size-4" />
          {getAddButtonLabel()}
        </Button>
      </div>

      {/* Sub-tabs */}
      <TabsNav items={tabs} value={tab} onChange={(key) => setTab(key as Tab)} />

      {/* CONTAS TAB */}
      {tab === "contas" && (
        <>
          <ContaFilters
            filterBusca={filterBusca}
            setFilterBusca={setFilterBusca}
            filtersOpen={filtersOpen}
            setFiltersOpen={setFiltersOpen}
            activeFiltersCount={activeFiltersCount}
            resetFilters={resetFilters}
            filterCategoriaId={filterCategoriaId}
            setFilterCategoriaId={setFilterCategoriaId}
            filterSubcategoriaId={filterSubcategoriaId}
            setFilterSubcategoriaId={setFilterSubcategoriaId}
            filterTipo={filterTipo}
            setFilterTipo={setFilterTipo}
            filterSituacao={filterSituacao}
            setFilterSituacao={setFilterSituacao}
            filterVencDe={filterVencDe}
            setFilterVencDe={setFilterVencDe}
            filterVencAte={filterVencAte}
            setFilterVencAte={setFilterVencAte}
            categorias={categorias}
            subcategorias={subcategorias}
            colunasConfig={colunasConfig}
            colunasOpen={colunasOpen}
            setColunasOpen={setColunasOpen}
            colunasRef={colunasRef}
            toggleCol={toggleCol}
            moveCol={moveCol}
            exportContasCSV={exportContasCSV}
          />

          <ContaTable
            contas={contas}
            filteredContas={filteredContas}
            contasLoading={contasLoading}
            categorias={categorias}
            subcategorias={subcategorias}
            visCols={visCols}
            sortField={sortField}
            sortDir={sortDir}
            setSortField={setSortField}
            setSortDir={setSortDir}
            selectedIds={selectedIds}
            toggleSelect={toggleSelect}
            toggleSelectAll={toggleSelectAll}
            expandedGrupos={expandedGrupos}
            toggleGrupo={toggleGrupo}
            activeFiltersCount={activeFiltersCount}
            onEditConta={openEditConta}
            onDeleteConta={handleDeleteConta}
            onMarkPago={handleMarkPago}
            onBulkPago={handleBulkPago}
            onBulkPendente={handleBulkPendente}
            onBulkDelete={handleBulkDelete}
            onClearSelection={() => setSelectedIds(new Set())}
          />

          <ContaFormDialog
            contaDialogOpen={contaDialogOpen}
            setContaDialogOpen={setContaDialogOpen}
            contaForm={contaForm}
            setContaForm={setContaForm}
            contaEditingId={contaEditingId}
            onContaSubmit={handleContaSubmit}
            fornecedorNames={fornecedorNames}
            categorias={categorias}
            subcategorias={subcategorias}
            grupoEditOpen={grupoEditOpen}
            setGrupoEditOpen={setGrupoEditOpen}
            grupoEditForm={grupoEditForm}
            setGrupoEditForm={setGrupoEditForm}
            onGrupoEditSubmit={handleGrupoEditSubmit}
          />
        </>
      )}

      {/* FORNECEDORES TAB */}
      {tab === "fornecedores" && (
        <FornecedoresTab
          fornecedores={fornecedores}
          fornecedoresLoading={fornecedoresLoading}
          fornecedorDialogOpen={fornecedorDialogOpen}
          setFornecedorDialogOpen={setFornecedorDialogOpen}
          fornecedorNome={fornecedorNome}
          setFornecedorNome={setFornecedorNome}
          fornecedorEditingId={fornecedorEditingId}
          fornecedorError={fornecedorError}
          onFornecedorSubmit={handleFornecedorSubmit}
          onEditFornecedor={openEditFornecedor}
          onDeleteFornecedor={handleDeleteFornecedor}
          exportFornecedoresCSV={exportFornecedoresCSV}
        />
      )}

      {/* CATEGORIAS TAB */}
      {tab === "categorias" && (
        <CategoriasTab
          categorias={categorias}
          categoriasLoading={categoriasLoading}
          subcategorias={subcategorias}
          categoriaDialogOpen={categoriaDialogOpen}
          setCategoriaDialogOpen={setCategoriaDialogOpen}
          categoriaNome={categoriaNome}
          setCategoriaNome={setCategoriaNome}
          categoriaEditingId={categoriaEditingId}
          categoriaError={categoriaError}
          onCategoriaSubmit={handleCategoriaSubmit}
          onEditCategoria={openEditCategoria}
          onDeleteCategoria={handleDeleteCategoria}
          subcategoriaDialogOpen={subcategoriaDialogOpen}
          setSubcategoriaDialogOpen={setSubcategoriaDialogOpen}
          subcategoriaNome={subcategoriaNome}
          setSubcategoriaNome={setSubcategoriaNome}
          subcategoriaError={subcategoriaError}
          onNewSubcategoria={openNewSubcategoria}
          onSubcategoriaSubmit={handleSubcategoriaSubmit}
          onDeleteSubcategoria={handleDeleteSubcategoria}
        />
      )}
    </div>
  );
}
