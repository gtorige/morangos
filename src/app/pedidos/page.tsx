"use client";

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList } from "lucide-react";
import { calcSubtotal as calcSubtotalBase } from "@/lib/pedido-utils";
import { NovoPedidoSheet, NovoPedidoInitialData } from "@/components/novo-pedido-sheet";
import { formatPrice, formatDate } from "@/lib/formatting";
import type { Produto, FormaPagamento, Promocao, PedidoItem, ItemPedidoForm } from "@/lib/types";
import {
  type Pedido,
  type PedidoFilters as Filters,
  type PeriodoKey,
  defaultFilters,
  emptyFilters,
  getPeriodoDates,
} from "@/hooks/use-pedidos";

import { PedidoFilters } from "./_components/PedidoFilters";
import { PedidoTable } from "./_components/PedidoTable";
import { PedidoDrawer } from "./_components/PedidoDrawer";
import { PedidoToolbar } from "./_components/PedidoToolbar";

type EditItem = ItemPedidoForm;

type ColKey = 'id' | 'cliente' | 'bairro' | 'total' | 'pgto' | 'formaPgto' | 'entrega' | 'data' | 'produto' | 'qtd';
const COLUNAS_DEFAULT: { key: ColKey; label: string; defaultVisible?: boolean }[] = [
  { key: 'id', label: '#' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'bairro', label: 'Bairro' },
  { key: 'produto', label: 'Produto', defaultVisible: false },
  { key: 'qtd', label: 'Qtd', defaultVisible: false },
  { key: 'total', label: 'Total' },
  { key: 'pgto', label: 'Pgto' },
  { key: 'formaPgto', label: 'F. Pgto' },
  { key: 'entrega', label: 'Entrega' },
  { key: 'data', label: 'Data' },
];

type StatusTab = "todos" | "concluidos" | "pendente_pgto" | "pendente_tudo";
type SortField = "id" | "cliente" | "bairro" | "total" | "pgto" | "formaPgto" | "entrega" | "data";
type SortDir = "asc" | "desc";

function PedidosPageInner() {
  const searchParams = useSearchParams();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [allPedidos, setAllPedidos] = useState<Pedido[]>([]);
  const [mensagensWpp, setMensagensWpp] = useState<{id: number; nome: string; texto: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(() => {
    if (typeof window === "undefined") return defaultFilters;
    const params = new URLSearchParams(window.location.search);
    const urlSituacao = params.get("situacaoPagamento");
    const urlStatusEntrega = params.get("statusEntrega");
    const urlDataInicio = params.get("dataInicio");
    const urlDataFim = params.get("dataFim");
    const hasUrlFilters = urlSituacao || urlStatusEntrega || urlDataInicio || urlDataFim;
    if (hasUrlFilters) {
      return {
        ...defaultFilters,
        situacaoPagamento: urlSituacao || "",
        statusEntrega: urlStatusEntrega ? urlStatusEntrega.split(",") : (urlSituacao && !urlStatusEntrega ? ["Entregue"] : []),
        dataInicio: urlDataInicio || "",
        dataFim: urlDataFim || "",
        clientes: [],
        bairros: [],
      };
    }
    try {
      const saved = localStorage.getItem("pedidos-filters");
      const savedPeriodo = (localStorage.getItem("pedidos-periodo") as PeriodoKey) || "hoje";
      const periodDates = getPeriodoDates(savedPeriodo);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Filters>;
        return { ...defaultFilters, ...parsed, dataInicio: periodDates.dataInicio, dataFim: periodDates.dataFim };
      }
      return { ...defaultFilters, ...periodDates };
    } catch { /* ignore */ }
    return defaultFilters;
  });
  const [drawerFiltrosOpen, setDrawerFiltrosOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (window.innerWidth >= 1280) {
      return localStorage.getItem('pedidos-drawer-open') !== 'false';
    }
    return false;
  });
  const [isDesktopLarge, setIsDesktopLarge] = useState(false);
  const [busca, setBusca] = useState("");
  const [tab, setTab] = useState<StatusTab>(() => {
    if (typeof window === "undefined") return "todos";
    return (localStorage.getItem("pedidos-tab") as StatusTab) || "todos";
  });
  const [sortField, setSortField] = useState<SortField>(() => {
    if (typeof window === "undefined") return "data";
    return (localStorage.getItem("pedidos-sort-field") as SortField) || "data";
  });
  const [sortDir, setSortDir] = useState<SortDir>(() => {
    if (typeof window === "undefined") return "asc";
    return (localStorage.getItem("pedidos-sort-dir") as SortDir) || "asc";
  });
  const [periodo, setPeriodo] = useState<PeriodoKey>(() => {
    if (typeof window === "undefined") return "hoje";
    return (localStorage.getItem("pedidos-periodo") as PeriodoKey) || "hoje";
  });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Inline cell editing state
  const [editingDateId, setEditingDateId] = useState<number | null>(null);
  const [editingDateValue, setEditingDateValue] = useState("");

  // Drawer state
  const [drawerPedidoId, setDrawerPedidoId] = useState<number | null>(null);
  const [drawerPedido, setDrawerPedido] = useState<Pedido | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const drawerOpen = drawerPedidoId !== null;

  // Drawer edit mode state
  const [drawerEditMode, setDrawerEditMode] = useState(false);
  const [editProdutos, setEditProdutos] = useState<Produto[]>([]);
  const [editFormasPagamento, setEditFormasPagamento] = useState<FormaPagamento[]>([]);
  const [editPromocoes, setEditPromocoes] = useState<Promocao[]>([]);
  const [editDataEntrega, setEditDataEntrega] = useState("");
  const [editFormaPagamentoId, setEditFormaPagamentoId] = useState("");
  const [editTaxaEntrega, setEditTaxaEntrega] = useState(5.0);
  const [editObservacoes, setEditObservacoes] = useState("");
  const [editItens, setEditItens] = useState<EditItem[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editProdutoSearches, setEditProdutoSearches] = useState<Record<number, string>>({});
  const [editProdutoDropdowns, setEditProdutoDropdowns] = useState<Record<number, boolean>>({});
  const [editProdutoHighlights, setEditProdutoHighlights] = useState<Record<number, number>>({});
  const editProdutoRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Novo Pedido sheet state
  const [novoPedidoOpen, setNovoPedidoOpen] = useState(false);
  const [novoPedidoInitialData, setNovoPedidoInitialData] = useState<NovoPedidoInitialData | undefined>(undefined);

  const [colunasConfig, setColunasConfig] = useState<{ key: ColKey; visible: boolean }[]>(() => {
    if (typeof window === 'undefined') return COLUNAS_DEFAULT.map(c => ({ key: c.key, visible: true }));
    try {
      const saved = localStorage.getItem('pedidos-colunas');
      if (saved) {
        const parsed: { key: ColKey; visible: boolean }[] = JSON.parse(saved);
        const savedKeys = new Set(parsed.map(c => c.key));
        const missing = COLUNAS_DEFAULT.filter(c => !savedKeys.has(c.key)).map(c => ({ key: c.key, visible: c.defaultVisible ?? true }));
        return [...parsed, ...missing];
      }
    } catch {}
    return COLUNAS_DEFAULT.map(c => ({ key: c.key, visible: c.defaultVisible ?? true }));
  });

  // Drawer client history state
  const [drawerHistoryOpen, setDrawerHistoryOpen] = useState(false);
  const [drawerHistory, setDrawerHistory] = useState<Pedido[]>([]);

  // ─── localStorage persistence ─────────────────────────────────────────
  useEffect(() => {
    const { dataInicio, dataFim, ...rest } = filters;
    localStorage.setItem("pedidos-filters", JSON.stringify(rest));
  }, [filters]);
  useEffect(() => { localStorage.setItem("pedidos-periodo", periodo); }, [periodo]);
  useEffect(() => { localStorage.setItem("pedidos-tab", tab); }, [tab]);
  useEffect(() => { localStorage.setItem("pedidos-sort-field", sortField); }, [sortField]);
  useEffect(() => { localStorage.setItem("pedidos-sort-dir", sortDir); }, [sortDir]);
  useEffect(() => { localStorage.setItem('pedidos-colunas', JSON.stringify(colunasConfig)); }, [colunasConfig]);

  // ─── Breakpoint detection ─────────────────────────────────────────────
  useEffect(() => {
    function check() { setIsDesktopLarge(window.innerWidth >= 1280); }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    localStorage.setItem('pedidos-drawer-open', String(drawerFiltrosOpen));
  }, [drawerFiltrosOpen]);

  useEffect(() => {
    if (isDesktopLarge || !drawerFiltrosOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDrawerFiltrosOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerFiltrosOpen, isDesktopLarge]);

  // ─── URL params (from dashboard/notification) ─────────────────────────
  useEffect(() => {
    const urlSituacao = searchParams.get("situacaoPagamento");
    const urlStatusEntrega = searchParams.get("statusEntrega");
    const urlDataInicio = searchParams.get("dataInicio");
    const urlDataFim = searchParams.get("dataFim");
    const hasUrlFilters = urlSituacao || urlStatusEntrega || urlDataInicio || urlDataFim;
    if (hasUrlFilters) {
      const newFilters: Filters = {
        ...emptyFilters,
        situacaoPagamento: urlSituacao || "",
        statusEntrega: urlStatusEntrega ? urlStatusEntrega.split(",") : (urlSituacao && !urlStatusEntrega ? ["Entregue"] : []),
        dataInicio: urlDataInicio || "",
        dataFim: urlDataFim || "",
      };
      setFilters(newFilters);
      if (urlSituacao === "Pendente" && urlStatusEntrega === "Entregue") {
        setTab("pendente_pgto");
      } else if (urlSituacao === "Pago") {
        setTab("concluidos");
      } else {
        setTab("todos");
      }
      fetchPedidos(newFilters);
    }
  }, [searchParams]);

  // ─── Auto-fetch ───────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => fetchPedidos(), 300);
    return () => clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    fetch("/api/mensagens-whatsapp").then(r => r.ok ? r.json() : []).then(setMensagensWpp).catch(() => {});
  }, []);

  // ─── Drawer fetch effects ─────────────────────────────────────────────
  useEffect(() => {
    if (drawerPedidoId == null) { setDrawerPedido(null); return; }
    let cancelled = false;
    setDrawerLoading(true);
    fetch(`/api/pedidos/${drawerPedidoId}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setDrawerPedido(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDrawerLoading(false); });
    return () => { cancelled = true; };
  }, [drawerPedidoId]);

  useEffect(() => {
    setDrawerHistoryOpen(false);
    if (!drawerPedido) { setDrawerHistory([]); return; }
    let cancelled = false;
    fetch(`/api/pedidos?cliente=${drawerPedido.clienteId}&limit=11&orderBy=desc`)
      .then(r => r.json())
      .then((data: Pedido[]) => {
        if (!cancelled) {
          setDrawerHistory(data.filter(p => p.id !== drawerPedido.id).slice(0, 10));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [drawerPedido?.id]);

  // ─── Drawer keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setDrawerPedidoId(null); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  useEffect(() => {
    if (drawerOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  useEffect(() => {
    setDrawerEditMode(false);
  }, [drawerPedidoId]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "e" && !drawerEditMode && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault();
        enterEditMode();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, drawerEditMode, drawerPedido]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const anyOpen = Object.values(editProdutoDropdowns).some(Boolean);
      if (!anyOpen) return;
      const newDropdowns = { ...editProdutoDropdowns };
      let changed = false;
      for (const key of Object.keys(editProdutoDropdowns)) {
        const idx = Number(key);
        if (editProdutoDropdowns[idx] && editProdutoRefs.current[idx] && !editProdutoRefs.current[idx]!.contains(target)) {
          newDropdowns[idx] = false;
          changed = true;
        }
      }
      if (changed) setEditProdutoDropdowns(newDropdowns);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editProdutoDropdowns]);

  // ─── Data fetching ────────────────────────────────────────────────────
  const fetchPedidos = useCallback(async (customFilters?: Filters) => {
    try {
      setLoading(true);
      const f = customFilters ?? filters;
      const params = new URLSearchParams();
      if (f.bairros.length > 0) params.set("bairro", f.bairros.join(","));
      if (f.situacaoPagamento) params.set("situacaoPagamento", f.situacaoPagamento);
      if (f.statusEntrega.length > 0 && f.statusEntrega.length < 4) {
        params.set("statusEntrega", f.statusEntrega.join(","));
      }
      if (f.dataInicio) params.set("dataInicio", f.dataInicio);
      if (f.dataFim) params.set("dataFim", f.dataFim);
      const query = params.toString();
      const res = await fetch(`/api/pedidos${query ? `?${query}` : ""}`);
      const data = await res.json();
      setAllPedidos(data);
      let filtered = data;
      if (f.clientes.length > 0) {
        filtered = filtered.filter((p: Pedido) => f.clientes.includes(p.cliente?.nome));
      }
      if (f.cidades.length > 0) {
        filtered = filtered.filter((p: Pedido) => p.cliente?.cidade && f.cidades.includes(p.cliente.cidade));
      }
      if (f.statusPedido?.length > 0) {
        filtered = filtered.filter((p: Pedido) => {
          const isPago = p.situacaoPagamento === "Pago";
          const isEntregue = p.statusEntrega === "Entregue";
          const isConcluido = isPago && isEntregue;
          if (f.statusPedido.includes("concluido") && isConcluido) return true;
          if (f.statusPedido.includes("pendente") && !isConcluido) return true;
          return false;
        });
      }
      if (f.recorrente === "sim") {
        filtered = filtered.filter((p: Pedido) => p.recorrenteId != null);
      } else if (f.recorrente === "nao") {
        filtered = filtered.filter((p: Pedido) => p.recorrenteId == null);
      }
      setPedidos(filtered);
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // ─── Pedido actions ───────────────────────────────────────────────────
  async function drawerUpdateField(field: string, value: string | number) {
    if (!drawerPedido) return;
    try {
      await fetch(`/api/pedidos/${drawerPedido.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value, updatedAt: drawerPedido.updatedAt, ...(field === "situacaoPagamento" ? { valorPago: value === "Pago" ? drawerPedido.total : 0 } : {}) }),
      });
      const r = await fetch(`/api/pedidos/${drawerPedido.id}`);
      const updated = await r.json();
      setDrawerPedido(updated);
      fetchPedidos();
    } catch (error) {
      console.error("Erro ao atualizar pedido:", error);
    }
  }

  async function drawerDelete() {
    if (!drawerPedido) return;
    if (!confirm("Tem certeza que deseja excluir este pedido?")) return;
    try {
      await fetch(`/api/pedidos/${drawerPedido.id}`, { method: "DELETE" });
      setDrawerPedidoId(null);
      fetchPedidos();
    } catch (error) {
      console.error("Erro ao excluir pedido:", error);
    }
  }

  async function handleMarkPago(pedido: Pedido) {
    try {
      await fetch(`/api/pedidos/${pedido.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situacaoPagamento: "Pago", valorPago: pedido.total, updatedAt: pedido.updatedAt }),
      });
      fetchPedidos();
    } catch (error) {
      console.error("Erro ao marcar como pago:", error);
    }
  }

  async function handleMarkEntregue(pedido: Pedido) {
    try {
      await fetch(`/api/pedidos/${pedido.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusEntrega: "Entregue", updatedAt: pedido.updatedAt }),
      });
      fetchPedidos();
    } catch (error) {
      console.error("Erro ao marcar como entregue:", error);
    }
  }

  function handleDuplicar(pedidoId: number) {
    const pedido = pedidos.find((p) => p.id === pedidoId) ?? allPedidos.find((p) => p.id === pedidoId);
    if (!pedido) return;
    setNovoPedidoInitialData({
      clienteId: pedido.clienteId,
      clienteNome: pedido.cliente.nome,
      formaPagamentoId: pedido.formaPagamentoId ?? undefined,
      taxaEntrega: pedido.taxaEntrega,
      observacoes: pedido.observacoes,
      itens: pedido.itens.map((i) => ({
        produtoId: i.produtoId,
        quantidade: i.quantidade,
        precoUnitario: i.precoUnitario,
      })),
    });
    setNovoPedidoOpen(true);
  }

  async function handleDelete(id: number) {
    if (!confirm("Tem certeza que deseja excluir este pedido?")) return;
    try {
      await fetch(`/api/pedidos/${id}`, { method: "DELETE" });
      fetchPedidos();
    } catch (error) {
      console.error("Erro ao excluir pedido:", error);
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkAction(action: string, dataEntrega?: string) {
    if (selectedIds.size === 0) return;
    try {
      await fetch("/api/pedidos/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action, ...(dataEntrega ? { dataEntrega } : {}) }),
      });
      setSelectedIds(new Set());
      fetchPedidos();
    } catch (error) {
      console.error("Erro ao atualizar pedidos em lote:", error);
    }
  }

  async function handleInlineTogglePgto(pedido: Pedido) {
    if (pedido.statusEntrega !== "Entregue") return;
    const newValue = pedido.situacaoPagamento === "Pago" ? "Pendente" : "Pago";
    try {
      await fetch(`/api/pedidos/${pedido.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situacaoPagamento: newValue, valorPago: newValue === "Pago" ? pedido.total : 0, updatedAt: pedido.updatedAt }),
      });
      fetchPedidos();
    } catch (error) {
      console.error("Erro ao atualizar pagamento:", error);
    }
  }

  async function handleInlineToggleEntrega(pedido: Pedido) {
    const cycle = ["Pendente", "Em rota", "Entregue"];
    const idx = cycle.indexOf(pedido.statusEntrega);
    const newValue = cycle[(idx + 1) % cycle.length];
    try {
      await fetch(`/api/pedidos/${pedido.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusEntrega: newValue, updatedAt: pedido.updatedAt }),
      });
      fetchPedidos();
    } catch (error) {
      console.error("Erro ao atualizar entrega:", error);
    }
  }

  async function handleInlineSaveDate(pedidoId: number, newDate: string) {
    setEditingDateId(null);
    if (!newDate) return;
    const pedido = pedidos.find((p) => p.id === pedidoId) ?? allPedidos.find((p) => p.id === pedidoId);
    try {
      await fetch(`/api/pedidos/${pedidoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataEntrega: newDate, updatedAt: pedido?.updatedAt }),
      });
      fetchPedidos();
    } catch (error) {
      console.error("Erro ao atualizar data:", error);
    }
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  // ─── Edit mode helpers ────────────────────────────────────────────────
  async function enterEditMode() {
    if (!drawerPedido) return;
    const [produtosData, formasData, promocoesData] = await Promise.all([
      fetch("/api/produtos").then(r => r.json()).catch(() => []),
      fetch("/api/formas-pagamento").then(r => r.json()).catch(() => []),
      fetch("/api/promocoes").then(r => r.json()).catch(() => []),
    ]);
    setEditProdutos(produtosData);
    setEditFormasPagamento(formasData);
    const today = new Date().toISOString().split("T")[0];
    const ativas = promocoesData.filter((p: Promocao) => p.ativo && p.dataInicio <= today && p.dataFim >= today);
    setEditPromocoes(ativas);
    setEditDataEntrega(drawerPedido.dataEntrega || "");
    setEditFormaPagamentoId(drawerPedido.formaPagamentoId ? String(drawerPedido.formaPagamentoId) : "");
    setEditTaxaEntrega(drawerPedido.taxaEntrega ?? 5.0);
    setEditObservacoes(drawerPedido.observacoes || "");
    const mappedItens = drawerPedido.itens.map((item) => ({
      produtoId: String(item.produtoId),
      quantidade: String(item.quantidade),
      precoUnitario: item.precoUnitario,
      subtotal: item.subtotal,
      precoManual: false,
    }));
    setEditItens(mappedItens);
    const searches: Record<number, string> = {};
    drawerPedido.itens.forEach((item, i) => {
      if (item.produto?.nome) searches[i] = item.produto.nome;
    });
    setEditProdutoSearches(searches);
    setEditProdutoDropdowns({});
    setEditProdutoHighlights({});
    setDrawerEditMode(true);
  }

  function getEditPromocaoForProduto(produtoId: string, quantidade?: number): Promocao | undefined {
    const promos = editPromocoes.filter((p) => String(p.produtoId) === produtoId);
    if (promos.length === 0) return undefined;
    if (quantidade != null) {
      const bestQtdMin = promos
        .filter((p) => p.tipo === "quantidade_minima" && p.quantidadeMinima != null && quantidade >= p.quantidadeMinima)
        .sort((a, b) => (b.quantidadeMinima ?? 0) - (a.quantidadeMinima ?? 0))[0];
      if (bestQtdMin) return bestQtdMin;
    }
    const priorityOrder = ["desconto", "leve_x_pague_y"];
    for (const tipo of priorityOrder) {
      const found = promos.find((p) => p.tipo === tipo);
      if (found) return found;
    }
    return undefined;
  }

  function calcEditSubtotal(item: EditItem): { subtotal: number; qtdCobrada: number | null } {
    const qty = parseFloat(item.quantidade || "0");
    const promo = !item.precoManual ? getEditPromocaoForProduto(item.produtoId, qty) : undefined;
    const tipo = promo ? (promo.tipo || "desconto") : undefined;
    const subtotal = calcSubtotalBase(qty, item.precoUnitario, tipo, promo?.leveQuantidade, promo?.pagueQuantidade);
    const plainSubtotal = item.precoUnitario * qty;
    const qtdCobrada = subtotal !== plainSubtotal ? Math.round((subtotal / item.precoUnitario) * 100) / 100 : null;
    return { subtotal, qtdCobrada };
  }

  function getEditFilteredProdutos(index: number) {
    const search = (editProdutoSearches[index] || "").toLowerCase();
    if (!search) return editProdutos;
    return editProdutos.filter((p) => p.nome.toLowerCase().includes(search));
  }

  function handleEditProdutoSelect(index: number, produtoId: string) {
    const produto = editProdutos.find((p) => String(p.id) === produtoId);
    if (produto) {
      setEditProdutoSearches((prev) => ({ ...prev, [index]: produto.nome }));
    }
    setEditProdutoDropdowns((prev) => ({ ...prev, [index]: false }));
    setEditProdutoHighlights((prev) => ({ ...prev, [index]: 0 }));
    handleEditItemChange(index, "produtoId", produtoId);
  }

  function handleEditProdutoKeyDown(index: number, e: React.KeyboardEvent) {
    const filtered = getEditFilteredProdutos(index);
    const highlight = editProdutoHighlights[index] || 0;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setEditProdutoHighlights((prev) => ({ ...prev, [index]: Math.min(highlight + 1, filtered.length - 1) }));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setEditProdutoHighlights((prev) => ({ ...prev, [index]: Math.max(highlight - 1, 0) }));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length > 0) {
        handleEditProdutoSelect(index, String(filtered[highlight]?.id));
      }
    } else if (e.key === "Escape") {
      setEditProdutoDropdowns((prev) => ({ ...prev, [index]: false }));
    } else if (e.key === "Tab") {
      if (filtered.length === 1) {
        handleEditProdutoSelect(index, String(filtered[0].id));
      }
      setEditProdutoDropdowns((prev) => ({ ...prev, [index]: false }));
    }
  }

  function handleEditItemChange(index: number, field: keyof EditItem, value: string) {
    const updated = [...editItens];
    const item = { ...updated[index] };
    if (field === "produtoId") {
      item.produtoId = value;
      const produto = editProdutos.find((p) => String(p.id) === value);
      if (produto) {
        const promo = getEditPromocaoForProduto(value);
        if (promo && (promo.tipo || "desconto") === "desconto" && promo.precoPromocional) {
          item.precoUnitario = promo.precoPromocional;
        } else {
          item.precoUnitario = produto.preco;
        }
        item.precoManual = false;
        const { subtotal } = calcEditSubtotal(item);
        item.subtotal = subtotal;
      }
    } else if (field === "quantidade") {
      item.quantidade = value;
      const { subtotal } = calcEditSubtotal(item);
      item.subtotal = subtotal;
    } else if (field === "precoUnitario") {
      item.precoUnitario = parseFloat(value) || 0;
      item.precoManual = true;
      const { subtotal } = calcEditSubtotal(item);
      item.subtotal = subtotal;
    }
    updated[index] = item;
    setEditItens(updated);
  }

  function handleEditAddItem() {
    setEditItens([...editItens, { produtoId: "", quantidade: "1", precoUnitario: 0, subtotal: 0, precoManual: false }]);
  }

  function handleEditRemoveItem(index: number) {
    setEditItens(editItens.filter((_, i) => i !== index));
    setEditProdutoSearches((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }

  const editSubtotalItens = editItens.reduce((acc, item) => {
    const { subtotal } = calcEditSubtotal(item);
    return acc + subtotal;
  }, 0);
  const editTotal = editSubtotalItens + editTaxaEntrega;

  async function handleEditSave() {
    if (!drawerPedido) return;
    if (editItens.length === 0) { alert("Adicione pelo menos um item ao pedido."); return; }
    const invalidItem = editItens.find((item) => !item.produtoId || !item.quantidade);
    if (invalidItem) { alert("Preencha todos os campos dos itens."); return; }
    setEditSaving(true);
    try {
      const body = {
        clienteId: drawerPedido.clienteId,
        dataEntrega: editDataEntrega || undefined,
        formaPagamentoId: editFormaPagamentoId ? Number(editFormaPagamentoId) : undefined,
        observacoes: editObservacoes,
        situacaoPagamento: drawerPedido.situacaoPagamento,
        statusEntrega: drawerPedido.statusEntrega,
        taxaEntrega: editTaxaEntrega,
        updatedAt: drawerPedido.updatedAt,
        itens: editItens.map((item) => ({
          produtoId: Number(item.produtoId),
          quantidade: Number(item.quantidade),
          precoUnitario: item.precoUnitario,
          subtotal: calcEditSubtotal(item).subtotal,
        })),
      };
      const res = await fetch(`/api/pedidos/${drawerPedido.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await fetch(`/api/pedidos/${drawerPedido.id}`).then(r => r.json());
        setDrawerPedido(updated);
        setDrawerEditMode(false);
        fetchPedidos();
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao atualizar pedido.");
      }
    } catch (error) {
      console.error("Erro ao atualizar pedido:", error);
      alert("Erro ao atualizar pedido.");
    } finally {
      setEditSaving(false);
    }
  }

  function exportPedidosCSV(pedidosList: Pedido[]) {
    const visCols = colunasConfig.filter(c => c.visible);
    const header = visCols.map(c => COLUNAS_DEFAULT.find(d => d.key === c.key)?.label ?? c.key);
    const csvRows = pedidosList.map(p => visCols.map(c => {
      switch (c.key) {
        case 'id': return String(p.id);
        case 'cliente': return p.cliente?.nome ?? '';
        case 'bairro': return p.cliente?.bairro ?? '';
        case 'produto': return (p.itens ?? []).map(i => i.produto?.nome).filter(Boolean).join(' | ');
        case 'qtd': return String((p.itens ?? []).reduce((s, i) => s + i.quantidade, 0));
        case 'total': return p.total.toFixed(2).replace('.', ',');
        case 'pgto': return p.situacaoPagamento;
        case 'formaPgto': return p.formaPagamento?.nome ?? '';
        case 'entrega': return p.statusEntrega;
        case 'data': return formatDate(p.dataEntrega);
        default: return '';
      }
    }));
    const csv = [header, ...csvRows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'pedidos.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Computed values ──────────────────────────────────────────────────
  const filteredByTab = pedidos.filter((p) => {
    if (filters.formasPagamento.length > 0 && !filters.formasPagamento.includes(p.formaPagamentoId)) return false;
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      const matchCliente = p.cliente?.nome?.toLowerCase().includes(q);
      const matchProduto = p.itens?.some(i => i.produto?.nome?.toLowerCase().includes(q));
      const matchId = String(p.id).includes(q);
      if (!matchCliente && !matchProduto && !matchId) return false;
    }
    switch (tab) {
      case "concluidos":
        return p.statusEntrega === "Entregue" && p.situacaoPagamento === "Pago";
      case "pendente_pgto":
        return p.statusEntrega === "Entregue" && p.situacaoPagamento !== "Pago";
      case "pendente_tudo":
        return p.statusEntrega !== "Entregue" && p.statusEntrega !== "Cancelado";
      default:
        return true;
    }
  }).sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "id": return (a.id - b.id) * dir;
      case "cliente": return (a.cliente?.nome || "").localeCompare(b.cliente?.nome || "") * dir;
      case "bairro": return (a.cliente?.bairro || "").localeCompare(b.cliente?.bairro || "") * dir;
      case "total": return (a.total - b.total) * dir;
      case "pgto": return a.situacaoPagamento.localeCompare(b.situacaoPagamento) * dir;
      case "formaPgto": return (a.formaPagamento?.nome || '').localeCompare(b.formaPagamento?.nome || '') * dir;
      case "entrega": return a.statusEntrega.localeCompare(b.statusEntrega) * dir;
      case "data":
      default: return a.dataEntrega.localeCompare(b.dataEntrega) * dir;
    }
  });

  function toggleSelectAll() {
    if (selectedIds.size === filteredByTab.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredByTab.map((p) => p.id)));
    }
  }

  const allSelected = filteredByTab.length > 0 && selectedIds.size === filteredByTab.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredByTab.length;

  const uniqueFormasPag = useMemo(() => {
    const map = new Map<number, string>();
    allPedidos.forEach(p => { if (p.formaPagamento) map.set(p.formaPagamento.id, p.formaPagamento.nome); });
    return [...map.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [allPedidos]);

  const totals = useMemo(() => {
    const total = filteredByTab.reduce((sum, p) => sum + p.total, 0);
    const recebido = filteredByTab.filter(p => p.situacaoPagamento === "Pago").reduce((sum, p) => sum + p.total, 0);
    return { count: filteredByTab.length, total, recebido, pendente: total - recebido };
  }, [filteredByTab]);

  const counts = {
    todos: pedidos.length,
    concluidos: pedidos.filter((p) => p.statusEntrega === "Entregue" && p.situacaoPagamento === "Pago").length,
    pendente_pgto: pedidos.filter((p) => p.statusEntrega === "Entregue" && p.situacaoPagamento !== "Pago").length,
    pendente_tudo: pedidos.filter((p) => p.statusEntrega !== "Entregue" && p.statusEntrega !== "Cancelado").length,
  };

  const activeFilterCount = [
    filters.clientes.length > 0,
    filters.bairros.length > 0,
    filters.cidades.length > 0,
    filters.formasPagamento.length > 0,
    filters.statusPedido?.length > 0,
    filters.situacaoPagamento !== '',
    filters.recorrente !== '',
  ].filter(Boolean).length;

  const tabs: { key: string; label: string; count: number }[] = [
    { key: "todos", label: "Todos", count: counts.todos },
    { key: "pendente_tudo", label: "Pendente Entrega", count: counts.pendente_tudo },
    { key: "pendente_pgto", label: "Pendente Pgto", count: counts.pendente_pgto },
    { key: "concluidos", label: "Concluídos", count: counts.concluidos },
  ];

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PedidoToolbar
        busca={busca}
        setBusca={setBusca}
        activeFilterCount={activeFilterCount}
        drawerFiltrosOpen={drawerFiltrosOpen}
        setDrawerFiltrosOpen={setDrawerFiltrosOpen}
        filters={filters}
        setFilters={setFilters}
        emptyFilters={emptyFilters}
        uniqueFormasPag={uniqueFormasPag}
        periodo={periodo}
        setPeriodo={setPeriodo}
        getPeriodoDates={getPeriodoDates}
        tab={tab}
        setTab={setTab}
        tabs={tabs}
        colunasConfig={colunasConfig}
        setColunasConfig={setColunasConfig}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        onBulkAction={handleBulkAction}
        onBulkDelete={async () => {
          if (!confirm(`Tem certeza que deseja excluir ${selectedIds.size} pedido(s)? Esta ação não pode ser desfeita.`)) return;
          try {
            await Promise.all([...selectedIds].map(id =>
              fetch(`/api/pedidos/${id}`, { method: "DELETE" })
            ));
            setSelectedIds(new Set());
            fetchPedidos();
          } catch (error) {
            console.error("Erro ao excluir pedidos:", error);
            alert("Erro ao excluir alguns pedidos.");
          }
        }}
        onExport={() => exportPedidosCSV(filteredByTab)}
        onNovoPedido={() => { setNovoPedidoInitialData(undefined); setNovoPedidoOpen(true); }}
      />

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {loading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : filteredByTab.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Nenhum pedido nesta categoria." />
          ) : (
            <PedidoTable
              pedidos={filteredByTab}
              colunasConfig={colunasConfig}
              sortField={sortField}
              sortDir={sortDir}
              onSort={toggleSort}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              allSelected={allSelected}
              someSelected={someSelected}
              onRowDoubleClick={(id) => setDrawerPedidoId(id)}
              onRowClick={(id) => setDrawerPedidoId(id)}
              onMarkPago={handleMarkPago}
              onMarkEntregue={handleMarkEntregue}
              onDuplicar={handleDuplicar}
              onDelete={handleDelete}
              onInlineTogglePgto={handleInlineTogglePgto}
              onInlineToggleEntrega={handleInlineToggleEntrega}
              editingDateId={editingDateId}
              editingDateValue={editingDateValue}
              onStartEditDate={(id, value) => { setEditingDateId(id); setEditingDateValue(value); }}
              onEditDateChange={setEditingDateValue}
              onSaveDate={handleInlineSaveDate}
              onCancelEditDate={() => setEditingDateId(null)}
              totals={totals}
              mensagensWpp={mensagensWpp}
            />
          )}
        </div>

        {/* Side filter drawer on xl+ */}
        {isDesktopLarge && drawerFiltrosOpen && (
          <div className="w-72 shrink-0 sticky top-4 max-h-[calc(100vh-100px)]">
            <PedidoFilters
              filters={filters}
              setFilters={setFilters}
              allPedidos={allPedidos}
              emptyFilters={emptyFilters}
              onClose={() => setDrawerFiltrosOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Floating filter drawer on smaller screens */}
      {!isDesktopLarge && drawerFiltrosOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setDrawerFiltrosOpen(false)} />
          <div className="fixed top-0 right-0 z-50 h-full bg-card border-l border-border shadow-xl flex flex-col overflow-hidden w-80 max-w-[90vw]">
            <PedidoFilters
              filters={filters}
              setFilters={setFilters}
              allPedidos={allPedidos}
              emptyFilters={emptyFilters}
              onClose={() => setDrawerFiltrosOpen(false)}
            />
          </div>
        </>
      )}

      <PedidoDrawer
        drawerOpen={drawerOpen}
        drawerLoading={drawerLoading}
        drawerPedido={drawerPedido}
        onClose={() => setDrawerPedidoId(null)}
        onUpdateField={drawerUpdateField}
        onDelete={drawerDelete}
        setDrawerPedido={setDrawerPedido}
        drawerEditMode={drawerEditMode}
        enterEditMode={enterEditMode}
        editDataEntrega={editDataEntrega}
        setEditDataEntrega={setEditDataEntrega}
        editFormaPagamentoId={editFormaPagamentoId}
        setEditFormaPagamentoId={setEditFormaPagamentoId}
        editTaxaEntrega={editTaxaEntrega}
        setEditTaxaEntrega={setEditTaxaEntrega}
        editObservacoes={editObservacoes}
        setEditObservacoes={setEditObservacoes}
        editItens={editItens}
        editSaving={editSaving}
        editSubtotalItens={editSubtotalItens}
        editTotal={editTotal}
        editProdutos={editProdutos}
        editFormasPagamento={editFormasPagamento}
        editProdutoSearches={editProdutoSearches}
        editProdutoDropdowns={editProdutoDropdowns}
        editProdutoHighlights={editProdutoHighlights}
        setEditProdutoSearches={setEditProdutoSearches}
        setEditProdutoDropdowns={setEditProdutoDropdowns}
        setEditProdutoHighlights={setEditProdutoHighlights}
        editProdutoRefs={editProdutoRefs}
        onEditItemChange={handleEditItemChange}
        onEditAddItem={handleEditAddItem}
        onEditRemoveItem={handleEditRemoveItem}
        onEditSave={handleEditSave}
        onEditCancel={() => setDrawerEditMode(false)}
        getEditPromocaoForProduto={getEditPromocaoForProduto}
        calcEditSubtotal={calcEditSubtotal}
        getEditFilteredProdutos={getEditFilteredProdutos}
        handleEditProdutoSelect={handleEditProdutoSelect}
        handleEditProdutoKeyDown={handleEditProdutoKeyDown}
        drawerHistoryOpen={drawerHistoryOpen}
        setDrawerHistoryOpen={setDrawerHistoryOpen}
        drawerHistory={drawerHistory}
      />

      <NovoPedidoSheet
        open={novoPedidoOpen}
        onOpenChange={setNovoPedidoOpen}
        onSuccess={fetchPedidos}
        initialData={novoPedidoInitialData}
      />
    </div>
  );
}

export default function PedidosPage() {
  return (
    <Suspense>
      <PedidosPageInner />
    </Suspense>
  );
}
