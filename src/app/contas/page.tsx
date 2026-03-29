"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { differenceInDays, parseISO, isToday, isPast } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { TabsNav, type TabItem } from "@/components/ui/tabs-nav";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Trash2,
  Receipt,
  Store,
  Tag,
  Check,
  Filter,
  SlidersHorizontal,
  Download,
  Search,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  RotateCw,
} from "lucide-react";
import { formatPrice, formatDate } from "@/lib/formatting";

// ── Types ──

interface Conta {
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
}

interface Subcategoria {
  id: number;
  nome: string;
  categoriaId: number;
  _count: { contas: number };
}

interface ContaForm {
  fornecedorNome: string;
  categoriaId: string;
  subcategoriaId: string;
  tipoFinanceiro: string;
  valor: string;
  vencimento: string;
  situacao: string;
  parcelas: string;
}

interface Fornecedor {
  id: number;
  nome: string;
  _count: { contas: number };
}

interface Categoria {
  id: number;
  nome: string;
  _count: { contas: number };
}

type Tab = "contas" | "fornecedores" | "categorias";

// ── Column config ──

type ContaColKey = "fornecedor" | "categoria" | "subcategoria" | "tipo" | "valor" | "vencimento" | "situacao";

const COLUNAS_CONTAS_DEFAULT: { key: ContaColKey; label: string; visible: boolean; required?: boolean }[] = [
  { key: "fornecedor", label: "Fornecedor", visible: true, required: true },
  { key: "categoria", label: "Categoria", visible: true },
  { key: "subcategoria", label: "Subcategoria", visible: true },
  { key: "tipo", label: "Tipo", visible: true },
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

// ── Helpers ──

function getRowClassName(conta: Conta) {
  if (conta.situacao !== "Pendente") return "";
  try {
    const venc = parseISO(conta.vencimento);
    if (isToday(venc) || isPast(venc)) return "bg-red-500/10 border-l-2 border-l-red-500";
    const diff = differenceInDays(venc, new Date());
    if (diff > 0 && diff <= 5) return "bg-yellow-500/10 border-l-2 border-l-yellow-500";
  } catch {}
  return "";
}

function getSituacaoBadge(conta: Conta) {
  if (conta.situacao === "Pago") return <StatusBadge status="Pago" context="conta" />;
  try {
    const venc = parseISO(conta.vencimento);
    if (isToday(venc) || isPast(venc)) return <StatusBadge status="Vencida" context="conta" />;
  } catch {}
  return <StatusBadge status="Pendente" context="conta" />;
}

// ── Component ──

export default function ContasPage() {
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterBusca, setFilterBusca] = useState("");
  const [filterCategoriaId, setFilterCategoriaId] = useState("");
  const [filterSubcategoriaId, setFilterSubcategoriaId] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterSituacao, setFilterSituacao] = useState("");
  const [filterVencDe, setFilterVencDe] = useState("");
  const [filterVencAte, setFilterVencAte] = useState("");

  const filteredContas = useMemo(() => {
    return contas.filter((c) => {
      if (filterBusca && !c.fornecedorNome.toLowerCase().includes(filterBusca.toLowerCase())) return false;
      if (filterCategoriaId && String(c.categoriaId) !== filterCategoriaId) return false;
      if (filterSubcategoriaId && String(c.subcategoriaId) !== filterSubcategoriaId) return false;
      if (filterTipo && c.tipoFinanceiro !== filterTipo) return false;
      if (filterSituacao === "Pago" && c.situacao !== "Pago") return false;
      if (filterSituacao === "Pendente") {
        if (c.situacao !== "Pendente") return false;
        try {
          const v = parseISO(c.vencimento);
          if (isPast(v) || isToday(v)) return false;
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
  }, [contas, filterBusca, filterCategoriaId, filterSubcategoriaId, filterTipo, filterSituacao, filterVencDe, filterVencAte]);

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

  function openEditGrupo(grupoId: number) {
    const parcelas = contas.filter((c) => c.parcelaGrupoId === grupoId);
    if (parcelas.length === 0) return;
    const first = parcelas[0];
    setGrupoEditGrupoId(grupoId);
    setGrupoEditForm({
      fornecedorNome: first.fornecedorNome,
      categoriaId: first.categoriaId ? String(first.categoriaId) : "",
      subcategoriaId: first.subcategoriaId ? String(first.subcategoriaId) : "",
      tipoFinanceiro: first.tipoFinanceiro ?? "",
    });
    setGrupoEditOpen(true);
  }

  async function handleGrupoEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!grupoEditGrupoId) return;
    const parcelas = contas.filter((c) => c.parcelaGrupoId === grupoEditGrupoId);
    const catId = grupoEditForm.categoriaId ? Number(grupoEditForm.categoriaId) : null;
    const catNome = catId ? (categorias.find((c) => c.id === catId)?.nome ?? "") : "";
    const payload = {
      fornecedorNome: grupoEditForm.fornecedorNome,
      categoria: catNome,
      categoriaId: catId,
      subcategoriaId: grupoEditForm.subcategoriaId ? Number(grupoEditForm.subcategoriaId) : null,
      tipoFinanceiro: grupoEditForm.tipoFinanceiro,
    };
    await Promise.all(
      parcelas.map((p) =>
        fetch(`/api/contas/${p.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      )
    );
    setGrupoEditOpen(false);
    fetchContas();
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
          body: JSON.stringify({ situacao: "Pago" }),
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
          body: JSON.stringify({ situacao: "Pendente" }),
        })
      )
    );
    setSelectedIds(new Set());
    fetchContas();
  }
  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (!confirm(`Deseja excluir ${ids.length} conta(s)?`)) return;
    await Promise.all(ids.map((id) => fetch(`/api/contas/${id}`, { method: "DELETE" })));
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
    const catId = contaForm.categoriaId ? Number(contaForm.categoriaId) : null;
    const catNome = catId ? (categorias.find((c) => c.id === catId)?.nome ?? "") : "";
    const totalParcelas = parseInt(contaForm.parcelas) || 1;
    const valorTotal = parseFloat(contaForm.valor);
    const valorParcela = totalParcelas > 1 ? parseFloat((valorTotal / totalParcelas).toFixed(2)) : valorTotal;
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
        const baseDate = new Date(contaForm.vencimento + "T12:00:00");
        const venc0Str = new Date(baseDate).toISOString().slice(0, 10);
        const res0 = await fetch("/api/contas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...baseBody, valor: valorParcela, vencimento: venc0Str, parcelaNumero: 1 }),
        });
        const first = await res0.json();
        const grupoId = first.id;
        await fetch(`/api/contas/${grupoId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parcelaGrupoId: grupoId }),
        });
        for (let i = 1; i < totalParcelas; i++) {
          const venc = new Date(baseDate);
          venc.setMonth(venc.getMonth() + i);
          await fetch("/api/contas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...baseBody,
              valor: valorParcela,
              vencimento: venc.toISOString().slice(0, 10),
              parcelaNumero: i + 1,
              parcelaGrupoId: grupoId,
            }),
          });
        }
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
      await fetch(`/api/contas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situacao: "Pago" }),
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

  function getSubcategoriaNome(conta: Conta) {
    if (!conta.subcategoriaId) return "";
    return subcategorias.find((s) => s.id === conta.subcategoriaId)?.nome ?? "";
  }

  // Cell content for single / expanded parcela rows
  function renderCell(col: ContaColKey, item: Conta) {
    switch (col) {
      case "fornecedor":
        return <span>{item.fornecedorNome}</span>;
      case "categoria":
        return <span>{getCategoriaNome(item)}</span>;
      case "subcategoria":
        return <span className="text-sm text-muted-foreground">{getSubcategoriaNome(item) || "—"}</span>;
      case "tipo":
        return item.tipoFinanceiro ? (
          <StatusBadge status={item.tipoFinanceiro} context="financeiro" />
        ) : <span className="text-muted-foreground">—</span>;
      case "valor":
        return <span>{formatPrice(item.valor)}</span>;
      case "vencimento":
        return <span>{formatDate(item.vencimento)}</span>;
      case "situacao":
        return getSituacaoBadge(item);
    }
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

      {/* ═══ CONTAS TAB ═══ */}
      {tab === "contas" && (
        <>
          {/* Search + filters + columns + csv */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar fornecedor..."
                value={filterBusca}
                onChange={(e) => setFilterBusca(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen((v) => !v)}
              className="h-9 gap-1.5"
            >
              <Filter className="size-4" />
              <span className="hidden sm:inline">Filtros</span>
              {activeFiltersCount > 0 && (
                <Badge className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">{activeFiltersCount}</Badge>
              )}
            </Button>
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9" title="Limpar filtros">
                <RotateCcw className="size-4" />
              </Button>
            )}
            <div className="relative" ref={colunasRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setColunasOpen((v) => !v)}
                className="h-9 gap-1.5"
              >
                <SlidersHorizontal className="size-4" />
                <span className="hidden sm:inline">Colunas</span>
              </Button>
              {colunasOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 bg-card border rounded-lg shadow-lg p-3 space-y-1 min-w-[200px]">
                  {colunasConfig.map((col, i) => (
                    <div key={col.key} className="flex items-center gap-1">
                      <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={col.visible}
                          onChange={() => toggleCol(col.key)}
                          disabled={col.required}
                        />
                        {col.label}
                      </label>
                      <div className="flex gap-0.5">
                        <button
                          onClick={() => moveCol(i, -1)}
                          disabled={i === 0}
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded"
                        >
                          <ChevronUp className="size-3" />
                        </button>
                        <button
                          onClick={() => moveCol(i, 1)}
                          disabled={i === colunasConfig.length - 1}
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded"
                        >
                          <ChevronDown className="size-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={exportContasCSV} className="h-9 gap-1.5">
              <Download className="size-4" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
          </div>

          {/* Filters panel */}
          {filtersOpen && (
            <div className="rounded-lg border bg-card p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Categoria</Label>
                <select
                  value={filterCategoriaId}
                  onChange={(e) => { setFilterCategoriaId(e.target.value); setFilterSubcategoriaId(""); }}
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                >
                  <option value="">Todas</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              {filterCategoriaId && (
                <div className="space-y-1">
                  <Label className="text-xs">Subcategoria</Label>
                  <select
                    value={filterSubcategoriaId}
                    onChange={(e) => setFilterSubcategoriaId(e.target.value)}
                    className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  >
                    <option value="">Todas</option>
                    {subcategorias.filter((s) => s.categoriaId === Number(filterCategoriaId)).map((s) => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <select
                  value={filterTipo}
                  onChange={(e) => setFilterTipo(e.target.value)}
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                >
                  <option value="">Todos</option>
                  <option value="CAPEX">CAPEX</option>
                  <option value="OPEX">OPEX</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Situação</Label>
                <select
                  value={filterSituacao}
                  onChange={(e) => setFilterSituacao(e.target.value)}
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                >
                  <option value="">Todas</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Vencida">Vencida</option>
                  <option value="Pago">Pago</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vencimento de</Label>
                <Input type="date" value={filterVencDe} onChange={(e) => setFilterVencDe(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vencimento até</Label>
                <Input type="date" value={filterVencAte} onChange={(e) => setFilterVencAte(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
          )}

          {/* Bulk actions bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
              <span className="text-sm font-medium">{selectedIds.size} selecionada{selectedIds.size !== 1 ? "s" : ""}</span>
              <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={handleBulkPago}>
                <Check className="size-3 mr-1" />
                Marcar Pago
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleBulkPendente}>
                <RotateCw className="size-3 mr-1" />
                Marcar Pendente
              </Button>
              <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleBulkDelete}>
                <Trash2 className="size-3 mr-1" />
                Excluir
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto" onClick={() => setSelectedIds(new Set())}>
                Cancelar
              </Button>
            </div>
          )}

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={filteredContas.length > 0 && filteredContas.every((c) => selectedIds.has(c.id))}
                      onChange={toggleSelectAll}
                      className="size-4 accent-primary cursor-pointer"
                    />
                  </TableHead>
                  {visCols.map((col) => (
                    <TableHead key={col.key}>{col.label}</TableHead>
                  ))}
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contasLoading ? (
                  <TableRow>
                    <TableCell colSpan={visCols.length + 2}>
                      <TableSkeleton rows={5} cols={visCols.length} />
                    </TableCell>
                  </TableRow>
                ) : filteredContas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visCols.length + 2}>
                      <EmptyState icon={Receipt} title={activeFiltersCount > 0 ? "Nenhuma conta com esses filtros." : "Nenhuma conta cadastrada"} />
                    </TableCell>
                  </TableRow>
                ) : (
                  (() => {
                    const renderedGrupos = new Set<number>();
                    const renderedSyntheticGrupos = new Set<string>();
                    const rows: React.ReactNode[] = [];

                    for (const item of filteredContas) {
                      const syntheticKey =
                        item.parcelas > 1 && !item.parcelaGrupoId
                          ? `${item.fornecedorNome}_${item.categoriaId ?? ""}_${item.parcelas}`
                          : null;
                      const effectiveGrupoId = item.parcelaGrupoId;

                      if (item.parcelas > 1 && (effectiveGrupoId || syntheticKey)) {
                        if (effectiveGrupoId) {
                          if (renderedGrupos.has(effectiveGrupoId)) continue;
                          renderedGrupos.add(effectiveGrupoId);
                        } else if (syntheticKey) {
                          if (renderedSyntheticGrupos.has(syntheticKey)) continue;
                          renderedSyntheticGrupos.add(syntheticKey);
                        }

                        const grupo2 = effectiveGrupoId
                          ? contas.filter((c) => c.parcelaGrupoId === effectiveGrupoId)
                          : contas.filter(
                              (c) =>
                                !c.parcelaGrupoId &&
                                c.parcelas === item.parcelas &&
                                c.fornecedorNome === item.fornecedorNome &&
                                c.categoriaId === item.categoriaId
                            );

                        const expandKey = effectiveGrupoId ? String(effectiveGrupoId) : (syntheticKey ?? "");
                        const expanded = expandedGrupos.has(expandKey);
                        const pagas = grupo2.filter((c) => c.situacao === "Pago").length;
                        const totalGrupo = grupo2.reduce((s, c) => s + c.valor, 0);
                        const nextPendente = grupo2
                          .filter((c) => c.situacao !== "Pago")
                          .sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];
                        const grupoAllSelected = grupo2.every((c) => selectedIds.has(c.id));
                        const toggleThisGrupo = () => {
                          const ids2 = grupo2.map((c) => c.id);
                          const allSel = ids2.every((id) => selectedIds.has(id));
                          setSelectedIds((prev) => {
                            const n = new Set(prev);
                            if (allSel) ids2.forEach((id) => n.delete(id));
                            else ids2.forEach((id) => n.add(id));
                            return n;
                          });
                        };

                        // Group header row
                        rows.push(
                          <TableRow
                            key={`grupo-${expandKey}`}
                            className={`cursor-pointer transition-colors ${nextPendente ? getRowClassName(nextPendente) : ""}`}
                            onClick={() => toggleGrupo(expandKey)}
                          >
                            <TableCell onClick={(e) => { e.stopPropagation(); toggleThisGrupo(); }}>
                              <input
                                type="checkbox"
                                checked={grupoAllSelected}
                                onChange={toggleThisGrupo}
                                className="size-4 accent-primary cursor-pointer"
                              />
                            </TableCell>
                            {visCols.map((col) => {
                              if (col.key === "fornecedor") return (
                                <TableCell key="fornecedor" className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs transition-transform ${expanded ? "rotate-90" : ""}`}>▶</span>
                                    {item.fornecedorNome}
                                  </div>
                                </TableCell>
                              );
                              if (col.key === "categoria") return (
                                <TableCell key="categoria">{getCategoriaNome(item)}</TableCell>
                              );
                              if (col.key === "subcategoria") return (
                                <TableCell key="subcategoria">
                                  <span className="text-sm text-muted-foreground">{getSubcategoriaNome(item) || "—"}</span>
                                </TableCell>
                              );
                              if (col.key === "tipo") return (
                                <TableCell key="tipo">
                                  <div className="flex flex-col gap-0.5">
                                    {item.tipoFinanceiro && <StatusBadge status={item.tipoFinanceiro} context="financeiro" />}
                                    <span className="text-xs text-muted-foreground">{pagas}/{grupo2.length}x pagas</span>
                                  </div>
                                </TableCell>
                              );
                              if (col.key === "valor") return (
                                <TableCell key="valor">{formatPrice(totalGrupo)}</TableCell>
                              );
                              if (col.key === "vencimento") return (
                                <TableCell key="vencimento">{nextPendente ? formatDate(nextPendente.vencimento) : "—"}</TableCell>
                              );
                              if (col.key === "situacao") return (
                                <TableCell key="situacao">
                                  {pagas === grupo2.length
                                    ? <StatusBadge status="Pago" context="conta" />
                                    : <Badge className="bg-yellow-500 text-white">{pagas}/{grupo2.length}</Badge>
                                  }
                                </TableCell>
                              );
                              return <TableCell key={col.key} />;
                            })}
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-xs text-muted-foreground">{grupo2.length}x de {formatPrice(item.valor)}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );

                        // Expanded parcela rows
                        if (expanded) {
                          for (const parcela of [...grupo2].sort((a, b) => a.parcelaNumero - b.parcelaNumero)) {
                            rows.push(
                              <TableRow
                                key={parcela.id}
                                className={`transition-colors ${getRowClassName(parcela)}`}
                                onDoubleClick={() => openEditConta(parcela)}
                              >
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.has(parcela.id)}
                                    onChange={() => toggleSelect(parcela.id)}
                                    className="size-4 accent-primary cursor-pointer"
                                  />
                                </TableCell>
                                {visCols.map((col) => {
                                  if (col.key === "fornecedor") return (
                                    <TableCell key="fornecedor" className="font-medium pl-8 text-muted-foreground text-sm">
                                      Parcela {parcela.parcelaNumero}/{parcela.parcelas}
                                    </TableCell>
                                  );
                                  if (col.key === "valor") return (
                                    <TableCell key="valor" className="text-sm">{formatPrice(parcela.valor)}</TableCell>
                                  );
                                  if (col.key === "vencimento") return (
                                    <TableCell key="vencimento" className="text-sm">{formatDate(parcela.vencimento)}</TableCell>
                                  );
                                  if (col.key === "situacao") return (
                                    <TableCell key="situacao">{getSituacaoBadge(parcela)}</TableCell>
                                  );
                                  return <TableCell key={col.key} />;
                                })}
                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-end gap-1">
                                    {parcela.situacao === "Pendente" && (
                                      <Button variant="ghost" size="icon-sm" onClick={() => handleMarkPago(parcela.id)} title="Marcar como pago">
                                        <Check className="size-4 text-green-500" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteConta(parcela.id)} title="Excluir">
                                      <Trash2 className="size-4 text-destructive" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          }
                        }
                      } else {
                        // Single conta row
                        rows.push(
                          <TableRow
                            key={item.id}
                            className={`cursor-pointer transition-colors ${getRowClassName(item)}`}
                            onDoubleClick={() => openEditConta(item)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(item.id)}
                                onChange={() => toggleSelect(item.id)}
                                className="size-4 accent-primary cursor-pointer"
                              />
                            </TableCell>
                            {visCols.map((col) => (
                              <TableCell key={col.key} className={col.key === "fornecedor" ? "font-medium" : ""}>
                                {renderCell(col.key, item)}
                              </TableCell>
                            ))}
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                {item.situacao === "Pendente" && (
                                  <Button variant="ghost" size="icon-sm" onClick={() => handleMarkPago(item.id)} title="Marcar como pago">
                                    <Check className="size-4 text-green-500" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteConta(item.id)} title="Excluir">
                                  <Trash2 className="size-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      }
                    }
                    return rows;
                  })()
                )}
              </TableBody>
            </Table>
          </div>

          {/* Conta Dialog */}
          <Dialog open={contaDialogOpen} onOpenChange={setContaDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{contaEditingId ? "Editar Conta" : "Nova Conta"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleContaSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fornecedor">Fornecedor</Label>
                  <Input
                    id="fornecedor"
                    list="fornecedor-suggestions"
                    value={contaForm.fornecedorNome}
                    onChange={(e) => setContaForm({ ...contaForm, fornecedorNome: e.target.value })}
                    required
                  />
                  <datalist id="fornecedor-suggestions">
                    {fornecedorNames.map((s) => (<option key={s} value={s} />))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria</Label>
                  <select
                    id="categoria"
                    value={contaForm.categoriaId}
                    onChange={(e) => setContaForm({ ...contaForm, categoriaId: e.target.value, subcategoriaId: "" })}
                    className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  >
                    <option value="">Sem categoria</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                {contaForm.categoriaId && (
                  <div className="space-y-2">
                    <Label htmlFor="subcategoriaId">Subcategoria</Label>
                    <select
                      id="subcategoriaId"
                      value={contaForm.subcategoriaId}
                      onChange={(e) => setContaForm({ ...contaForm, subcategoriaId: e.target.value })}
                      className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                    >
                      <option value="">Sem subcategoria</option>
                      {subcategorias
                        .filter((s) => s.categoriaId === Number(contaForm.categoriaId))
                        .map((s) => (
                          <option key={s.id} value={s.id}>{s.nome}</option>
                        ))}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="tipoFinanceiro">Tipo Financeiro</Label>
                  <select
                    id="tipoFinanceiro"
                    value={contaForm.tipoFinanceiro}
                    onChange={(e) => setContaForm({ ...contaForm, tipoFinanceiro: e.target.value })}
                    className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  >
                    <option value="">Sem classificação</option>
                    <option value="CAPEX">CAPEX (Investimento)</option>
                    <option value="OPEX">OPEX (Operacional)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="valor">{contaEditingId ? "Valor" : "Valor total"}</Label>
                    <Input
                      id="valor"
                      type="number"
                      step="0.01"
                      min="0"
                      value={contaForm.valor}
                      onChange={(e) => setContaForm({ ...contaForm, valor: e.target.value })}
                      required
                    />
                  </div>
                  {!contaEditingId && (
                    <div className="space-y-2">
                      <Label htmlFor="parcelas">Parcelas</Label>
                      <select
                        id="parcelas"
                        value={contaForm.parcelas}
                        onChange={(e) => setContaForm({ ...contaForm, parcelas: e.target.value })}
                        className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                      >
                        <option value="1">À vista (1x)</option>
                        <option value="2">2x</option>
                        <option value="3">3x</option>
                        <option value="4">4x</option>
                        <option value="5">5x</option>
                        <option value="6">6x</option>
                        <option value="12">12x</option>
                        <option value="24">24x</option>
                      </select>
                    </div>
                  )}
                </div>
                {!contaEditingId && parseInt(contaForm.parcelas) > 1 && contaForm.valor && (
                  <p className="text-xs text-muted-foreground -mt-2">
                    {contaForm.parcelas}x de {formatPrice(parseFloat(contaForm.valor) / parseInt(contaForm.parcelas))} — 1ª parcela no vencimento escolhido
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="vencimento">
                    {parseInt(contaForm.parcelas) > 1 ? "Vencimento da 1ª parcela" : "Vencimento"}
                  </Label>
                  <Input
                    id="vencimento"
                    type="date"
                    value={contaForm.vencimento}
                    onChange={(e) => setContaForm({ ...contaForm, vencimento: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Situação</Label>
                  <select
                    value={contaForm.situacao}
                    onChange={(e) => setContaForm({ ...contaForm, situacao: e.target.value })}
                    className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Pago">Pago</option>
                  </select>
                </div>
                <DialogFooter>
                  <Button type="submit">{contaEditingId ? "Salvar" : "Criar"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Group Edit Dialog */}
          <Dialog open={grupoEditOpen} onOpenChange={setGrupoEditOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Editar Grupo de Parcelas</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Edita os dados comuns de todas as parcelas do grupo.
              </p>
              <form onSubmit={handleGrupoEditSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Fornecedor</Label>
                  <Input
                    list="grupo-forn-suggestions"
                    value={grupoEditForm.fornecedorNome}
                    onChange={(e) => setGrupoEditForm({ ...grupoEditForm, fornecedorNome: e.target.value })}
                    required
                  />
                  <datalist id="grupo-forn-suggestions">
                    {fornecedorNames.map((s) => (<option key={s} value={s} />))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <select
                    value={grupoEditForm.categoriaId}
                    onChange={(e) => setGrupoEditForm({ ...grupoEditForm, categoriaId: e.target.value, subcategoriaId: "" })}
                    className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  >
                    <option value="">Sem categoria</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                {grupoEditForm.categoriaId && (
                  <div className="space-y-2">
                    <Label>Subcategoria</Label>
                    <select
                      value={grupoEditForm.subcategoriaId}
                      onChange={(e) => setGrupoEditForm({ ...grupoEditForm, subcategoriaId: e.target.value })}
                      className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                    >
                      <option value="">Sem subcategoria</option>
                      {subcategorias
                        .filter((s) => s.categoriaId === Number(grupoEditForm.categoriaId))
                        .map((s) => (
                          <option key={s.id} value={s.id}>{s.nome}</option>
                        ))}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Tipo Financeiro</Label>
                  <select
                    value={grupoEditForm.tipoFinanceiro}
                    onChange={(e) => setGrupoEditForm({ ...grupoEditForm, tipoFinanceiro: e.target.value })}
                    className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  >
                    <option value="">Sem classificação</option>
                    <option value="CAPEX">CAPEX (Investimento)</option>
                    <option value="OPEX">OPEX (Operacional)</option>
                  </select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setGrupoEditOpen(false)}>Cancelar</Button>
                  <Button type="submit">Salvar Grupo</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ═══ FORNECEDORES TAB ═══ */}
      {tab === "fornecedores" && (
        <>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={exportFornecedoresCSV} className="h-9 gap-1.5">
              <Download className="size-4" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
          </div>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-center">Contas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fornecedoresLoading ? (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <TableSkeleton rows={4} cols={3} />
                    </TableCell>
                  </TableRow>
                ) : fornecedores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <EmptyState icon={Store} title="Nenhum fornecedor cadastrado" />
                    </TableCell>
                  </TableRow>
                ) : (
                  fornecedores.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer transition-colors"
                      onDoubleClick={() => openEditFornecedor(item)}
                    >
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{item._count.contas}</Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteFornecedor(item.id)} title="Excluir">
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Fornecedor Dialog */}
          <Dialog open={fornecedorDialogOpen} onOpenChange={setFornecedorDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{fornecedorEditingId ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleFornecedorSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={fornecedorNome}
                    onChange={(e) => setFornecedorNome(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                {fornecedorError && <p className="text-sm text-destructive">{fornecedorError}</p>}
                <DialogFooter>
                  <Button type="submit">{fornecedorEditingId ? "Salvar" : "Criar"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ═══ CATEGORIAS TAB ═══ */}
      {tab === "categorias" && (
        <>
          {categoriasLoading ? (
            <TableSkeleton rows={4} cols={2} />
          ) : categorias.length === 0 ? (
            <EmptyState icon={Tag} title="Nenhuma categoria cadastrada" />
          ) : (
            <div className="space-y-3">
              {categorias.map((cat) => {
                const catSubcategorias = subcategorias.filter((s) => s.categoriaId === cat.id);
                return (
                  <div key={cat.id} className="rounded-lg border p-4 space-y-3">
                    <div
                      className="flex items-center justify-between"
                      onDoubleClick={() => openEditCategoria(cat)}
                      title="Duplo clique para renomear"
                    >
                      <div className="flex items-center gap-2 cursor-pointer select-none">
                        <span className="font-medium">{cat.nome}</span>
                        <Badge variant="outline" className="text-xs">{cat._count.contas} contas</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openNewSubcategoria(cat.id)}
                          title="Adicionar subcategoria"
                        >
                          <Plus className="size-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteCategoria(cat.id)} title="Excluir">
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {catSubcategorias.length > 0 && (
                      <div className="flex flex-wrap gap-2 pl-1">
                        {catSubcategorias.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs bg-muted/30"
                          >
                            <span>{sub.nome}</span>
                            <span className="text-muted-foreground">({sub._count.contas})</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubcategoria(sub.id)}
                              className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Categoria Dialog */}
          <Dialog open={categoriaDialogOpen} onOpenChange={setCategoriaDialogOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>{categoriaEditingId ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCategoriaSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="catNome">Nome</Label>
                  <Input
                    id="catNome"
                    value={categoriaNome}
                    onChange={(e) => setCategoriaNome(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                {categoriaError && <p className="text-sm text-destructive">{categoriaError}</p>}
                <DialogFooter>
                  <Button type="submit">{categoriaEditingId ? "Salvar" : "Criar"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Subcategoria Dialog */}
          <Dialog open={subcategoriaDialogOpen} onOpenChange={setSubcategoriaDialogOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Nova Subcategoria</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubcategoriaSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subNome">Nome</Label>
                  <Input
                    id="subNome"
                    value={subcategoriaNome}
                    onChange={(e) => setSubcategoriaNome(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                {subcategoriaError && <p className="text-sm text-destructive">{subcategoriaError}</p>}
                <DialogFooter>
                  <Button type="submit">Criar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
