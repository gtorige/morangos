"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  ClipboardList,
  Filter,
  Copy,
  Pencil,
  Trash2,
  Check,
  CreditCard,
  X,
  CalendarDays,
  Ban,
  RotateCcw,
  Loader2,
  Save,
  ChevronRight,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { calcSubtotal as calcSubtotalBase } from "@/lib/pedido-utils";
import { NovoPedidoSheet, NovoPedidoInitialData } from "@/components/novo-pedido-sheet";

interface Produto {
  id: number;
  nome: string;
  preco: number;
}

interface FormaPagamento {
  id: number;
  nome: string;
}

interface Promocao {
  id: number;
  nome: string;
  produtoId: number;
  tipo: string;
  precoPromocional: number;
  leveQuantidade: number | null;
  pagueQuantidade: number | null;
  dataInicio: string;
  dataFim: string;
  ativo: boolean;
}

interface EditItem {
  produtoId: string;
  quantidade: string;
  precoUnitario: number;
  subtotal: number;
  precoManual: boolean;
}

interface PedidoItem {
  id: number;
  produtoId: number;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  produto: { id: number; nome: string; preco: number };
}

interface Pedido {
  id: number;
  clienteId: number;
  dataPedido: string;
  dataEntrega: string;
  formaPagamentoId: number;
  total: number;
  valorPago: number;
  situacaoPagamento: string;
  statusEntrega: string;
  ordemRota: number | null;
  taxaEntrega: number;
  observacoes: string;
  recorrenteId: number | null;
  cliente: { id: number; nome: string; telefone?: string; rua?: string; numero?: string; bairro: string; cidade?: string };
  formaPagamento: { id: number; nome: string } | null;
  itens: PedidoItem[];
}

function todayStr() { return new Date().toISOString().slice(0, 10) }

interface Filters {
  clientes: string[];
  bairros: string[];
  formasPagamento: number[];
  situacaoPagamento: string;
  statusEntrega: string[];
  dataInicio: string;
  dataFim: string;
  valorMin: string;
  valorMax: string;
  recorrente: string;
}

// Default: today, exclude cancelled
const defaultFilters: Filters = {
  clientes: [],
  bairros: [],
  formasPagamento: [],
  situacaoPagamento: "",
  statusEntrega: ["Pendente", "Em rota", "Entregue"],
  dataInicio: todayStr(),
  dataFim: todayStr(),
  valorMin: "",
  valorMax: "",
  recorrente: "",
};

const emptyFilters: Filters = {
  clientes: [],
  bairros: [],
  formasPagamento: [],
  situacaoPagamento: "",
  statusEntrega: [],
  dataInicio: "",
  dataFim: "",
  valorMin: "",
  valorMax: "",
  recorrente: "",
};

type ColKey = 'id' | 'cliente' | 'bairro' | 'total' | 'pgto' | 'formaPgto' | 'entrega' | 'data';
const COLUNAS_DEFAULT: { key: ColKey; label: string }[] = [
  { key: 'id', label: '#' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'bairro', label: 'Bairro' },
  { key: 'total', label: 'Total' },
  { key: 'pgto', label: 'Pgto' },
  { key: 'formaPgto', label: 'F. Pgto' },
  { key: 'entrega', label: 'Entrega' },
  { key: 'data', label: 'Data' },
];

function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

type StatusTab = "todos" | "concluidos" | "pendente_pgto" | "pendente_tudo";
type SortField = "id" | "cliente" | "bairro" | "total" | "pgto" | "formaPgto" | "entrega" | "data";
type SortDir = "asc" | "desc";

// Helper: get Monday of the week containing `date`
function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  return d;
}

function getSunday(monday: Date) {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  return d;
}

function dateToStr(d: Date) { return d.toISOString().slice(0, 10); }

function PedidosPageInner() {
  const searchParams = useSearchParams();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [allPedidos, setAllPedidos] = useState<Pedido[]>([]); // unfiltered for dropdown options
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(() => {
    if (typeof window === "undefined") return defaultFilters;
    // Check URL params first (e.g. from notification banner)
    const urlSituacao = new URLSearchParams(window.location.search).get("situacaoPagamento");
    if (urlSituacao) {
      return { ...defaultFilters, situacaoPagamento: urlSituacao, dataInicio: "", dataFim: "", statusEntrega: ["Entregue"], clientes: [], bairros: [] };
    }
    try {
      const saved = localStorage.getItem("pedidos-filters");
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Filters>;
        return { ...defaultFilters, ...parsed, dataInicio: defaultFilters.dataInicio, dataFim: defaultFilters.dataFim };
      }
    } catch { /* ignore */ }
    return defaultFilters;
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDatePickerOpen, setBulkDatePickerOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState("");

  // Inline cell editing state
  const [editingDateId, setEditingDateId] = useState<number | null>(null);
  const [editingDateValue, setEditingDateValue] = useState("");

  // Apply URL params (e.g. from notification banner)
  useEffect(() => {
    const urlSituacao = searchParams.get("situacaoPagamento");
    if (urlSituacao) {
      setFilters({ ...defaultFilters, situacaoPagamento: urlSituacao, dataInicio: "", dataFim: "", statusEntrega: ["Entregue"], clientes: [], bairros: [] });
      setTab("pendente_pgto");
    }
  }, [searchParams]);

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
        const missing = COLUNAS_DEFAULT.filter(c => !savedKeys.has(c.key)).map(c => ({ key: c.key, visible: true }));
        return [...parsed, ...missing];
      }
    } catch {}
    return COLUNAS_DEFAULT.map(c => ({ key: c.key, visible: true }));
  });
  const [colunasOpen, setColunasOpen] = useState(false);

  // Drawer client history state
  const [drawerHistoryOpen, setDrawerHistoryOpen] = useState(false);
  const [drawerHistory, setDrawerHistory] = useState<Pedido[]>([]);

  const colunasRef = useRef<HTMLDivElement>(null);

  // Save filters/tab/sort to localStorage
  useEffect(() => {
    const { dataInicio, dataFim, ...rest } = filters;
    localStorage.setItem("pedidos-filters", JSON.stringify(rest));
  }, [filters]);
  useEffect(() => { localStorage.setItem("pedidos-tab", tab); }, [tab]);
  useEffect(() => { localStorage.setItem("pedidos-sort-field", sortField); }, [sortField]);
  useEffect(() => { localStorage.setItem("pedidos-sort-dir", sortDir); }, [sortDir]);
  useEffect(() => { localStorage.setItem('pedidos-colunas', JSON.stringify(colunasConfig)); }, [colunasConfig]);

  useEffect(() => {
    if (!colunasOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (colunasRef.current && !colunasRef.current.contains(e.target as Node)) setColunasOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [colunasOpen]);

  // Auto-fetch when filters change
  useEffect(() => {
    const timer = setTimeout(() => fetchPedidos(), 300);
    return () => clearTimeout(timer);
  }, [filters]);

  // Fetch drawer pedido details
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

  // Fetch client order history when drawer pedido changes
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

  // Escape key closes drawer
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setDrawerPedidoId(null); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  // Drawer inline edit helpers
  async function drawerUpdateField(field: string, value: string | number) {
    if (!drawerPedido) return;
    try {
      await fetch(`/api/pedidos/${drawerPedido.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value, ...(field === "situacaoPagamento" ? { valorPago: value === "Pago" ? drawerPedido.total : 0 } : {}) }),
      });
      // Refresh drawer and list
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

  // Reset edit mode when drawer closes or changes pedido
  useEffect(() => {
    setDrawerEditMode(false);
  }, [drawerPedidoId]);

  // Keyboard shortcut: 'e' to toggle edit mode
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

  // Close product dropdowns on outside click (edit mode)
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

  async function enterEditMode() {
    if (!drawerPedido) return;
    // Fetch reference data
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

    // Populate form from current pedido
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

  function getEditPromocaoForProduto(produtoId: string): Promocao | undefined {
    return editPromocoes.find((p) => String(p.produtoId) === produtoId);
  }

  function calcEditSubtotal(item: EditItem): { subtotal: number; qtdCobrada: number | null } {
    const qty = parseFloat(item.quantidade || "0");
    const promo = !item.precoManual ? getEditPromocaoForProduto(item.produtoId) : undefined;
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
    // Clean up search state
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
    if (editItens.length === 0) {
      alert("Adicione pelo menos um item ao pedido.");
      return;
    }
    const invalidItem = editItens.find((item) => !item.produtoId || !item.quantidade);
    if (invalidItem) {
      alert("Preencha todos os campos dos itens.");
      return;
    }
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
        // Refresh drawer data and main list
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

  async function fetchPedidos(customFilters?: Filters) {
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
      if (f.valorMin) params.set("valorMin", f.valorMin);
      if (f.valorMax) params.set("valorMax", f.valorMax);

      const query = params.toString();
      const res = await fetch(`/api/pedidos${query ? `?${query}` : ""}`);
      const data = await res.json();

      setAllPedidos(data); // keep unfiltered for dropdown options
      let filtered = data;
      if (f.clientes.length > 0) {
        filtered = filtered.filter((p: Pedido) =>
          f.clientes.includes(p.cliente?.nome)
        );
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
  }

  function handleClearFilters() {
    setFilters(emptyFilters);
  }

  async function handleMarkPago(pedido: Pedido) {
    try {
      await fetch(`/api/pedidos/${pedido.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          situacaoPagamento: "Pago",
          valorPago: pedido.total,
        }),
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
        body: JSON.stringify({ statusEntrega: "Entregue" }),
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
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action,
          ...(dataEntrega ? { dataEntrega } : {}),
        }),
      });
      setSelectedIds(new Set());
      setBulkDatePickerOpen(false);
      setBulkDate("");
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
        body: JSON.stringify({
          situacaoPagamento: newValue,
          valorPago: newValue === "Pago" ? pedido.total : 0,
        }),
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
        body: JSON.stringify({ statusEntrega: newValue }),
      });
      fetchPedidos();
    } catch (error) {
      console.error("Erro ao atualizar entrega:", error);
    }
  }

  async function handleInlineSaveDate(pedidoId: number, newDate: string) {
    setEditingDateId(null);
    if (!newDate) return;
    try {
      await fetch(`/api/pedidos/${pedidoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataEntrega: newDate }),
      });
      fetchPedidos();
    } catch (error) {
      console.error("Erro ao atualizar data:", error);
    }
  }

  function getPagamentoBadge(situacao: string, statusEntrega?: string) {
    // Pagamento só é relevante após entrega
    if (statusEntrega && statusEntrega !== "Entregue") return null;
    switch (situacao) {
      case "Pago":
        return <Badge className="bg-green-600 text-white">Pago</Badge>;
      case "Pendente":
      default:
        return <Badge className="bg-red-600 text-white">Pendente</Badge>;
    }
  }

  function getEntregaBadge(status: string) {
    switch (status) {
      case "Entregue":
        return <Badge className="bg-green-600 text-white">Entregue</Badge>;
      case "Em rota":
        return <Badge className="bg-blue-600 text-white">Em rota</Badge>;
      case "Cancelado":
        return <Badge className="bg-red-600 text-white">Cancelado</Badge>;
      case "Pendente":
      default:
        return <Badge className="bg-gray-500 text-white">Pendente</Badge>;
    }
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "data" ? "asc" : "asc");
    }
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  function moveCol(key: ColKey, dir: -1 | 1) {
    setColunasConfig(prev => {
      const arr = [...prev];
      const i = arr.findIndex(c => c.key === key);
      const j = i + dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  }
  function toggleCol(key: ColKey) {
    setColunasConfig(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  }

  const filteredByTab = pedidos.filter((p) => {
    if (filters.formasPagamento.length > 0 && !filters.formasPagamento.includes(p.formaPagamentoId)) return false;
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

  // Unique clients and bairros for multi-select filters (from unfiltered data)
  const uniqueClientes = useMemo(() => {
    const names = allPedidos.map(p => p.cliente?.nome).filter(Boolean) as string[];
    return [...new Set(names)].sort();
  }, [allPedidos]);

  const uniqueBairros = useMemo(() => {
    const bairros = allPedidos.map(p => p.cliente?.bairro).filter(Boolean) as string[];
    return [...new Set(bairros)].sort();
  }, [allPedidos]);

  const uniqueFormasPag = useMemo(() => {
    const map = new Map<number, string>();
    allPedidos.forEach(p => { if (p.formaPagamento) map.set(p.formaPagamento.id, p.formaPagamento.nome); });
    return [...map.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [allPedidos]);

  const totals = useMemo(() => {
    const total = filteredByTab.reduce((sum, p) => sum + p.total, 0);
    const recebido = filteredByTab.filter(p => p.situacaoPagamento === "Pago").reduce((sum, p) => sum + p.valorPago, 0);
    return { count: filteredByTab.length, total, recebido, pendente: total - recebido };
  }, [filteredByTab]);

  const counts = {
    todos: pedidos.length,
    concluidos: pedidos.filter((p) => p.statusEntrega === "Entregue" && p.situacaoPagamento === "Pago").length,
    pendente_pgto: pedidos.filter((p) => p.statusEntrega === "Entregue" && p.situacaoPagamento !== "Pago").length,
    pendente_tudo: pedidos.filter((p) => p.statusEntrega !== "Entregue" && p.statusEntrega !== "Cancelado").length,
  };

  const tabs: { key: StatusTab; label: string; count: number }[] = [
    { key: "todos", label: "Todos", count: counts.todos },
    { key: "pendente_tudo", label: "Pendente Entrega", count: counts.pendente_tudo },
    { key: "pendente_pgto", label: "Pendente Pgto", count: counts.pendente_pgto },
    { key: "concluidos", label: "Concluídos", count: counts.concluidos },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-5" />
          <h1 className="text-2xl font-semibold">Pedidos</h1>
        </div>
        <Button
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={() => { setNovoPedidoInitialData(undefined); setNovoPedidoOpen(true); }}
        >
          <Plus className="size-4" />
          Novo Pedido
        </Button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 border-b border-border pb-0 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              tab === t.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Date range shortcuts */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: "Hoje", fn: () => { const t = todayStr(); setFilters(f => ({ ...f, dataInicio: t, dataFim: t })) } },
          { label: "Semana", fn: () => {
            const mon = getMonday(new Date());
            const sun = getSunday(mon);
            setFilters(f => ({ ...f, dataInicio: dateToStr(mon), dataFim: dateToStr(sun) }));
          }},
          { label: "Próx. Semana", fn: () => {
            const mon = getMonday(new Date());
            const nextMon = new Date(mon); nextMon.setDate(mon.getDate() + 7);
            const nextSun = getSunday(nextMon);
            setFilters(f => ({ ...f, dataInicio: dateToStr(nextMon), dataFim: dateToStr(nextSun) }));
          }},
          { label: "Mês", fn: () => {
            const d = new Date(); const y = d.getFullYear(); const m = d.getMonth();
            setFilters(f => ({ ...f, dataInicio: dateToStr(new Date(y,m,1)), dataFim: dateToStr(new Date(y,m+1,0)) }));
          }},
          { label: "Todos", fn: () => { setFilters(f => ({ ...f, dataInicio: "", dataFim: "" })) } },
        ].map((s) => (
          <Button key={s.label} variant="outline" size="sm" onClick={s.fn} className="h-7 text-xs">
            {s.label}
          </Button>
        ))}
        {filters.dataInicio && (
          <span className="text-xs text-muted-foreground self-center ml-1">
            {formatDate(filters.dataInicio)}{filters.dataFim && filters.dataInicio !== filters.dataFim ? ` a ${formatDate(filters.dataFim)}` : ""}
          </span>
        )}
      </div>

      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <div className="flex items-center gap-2">
            <Filter className="size-4" />
            <CardTitle>Filtros</CardTitle>
          </div>
        </CardHeader>
        {filtersOpen && (
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <div className="space-y-1 max-h-[120px] overflow-y-auto rounded-lg border border-input bg-transparent p-2">
                  {uniqueClientes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum cliente</p>
                  ) : uniqueClientes.map(nome => (
                    <label key={nome} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={filters.clientes.includes(nome)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...filters.clientes, nome]
                            : filters.clientes.filter(c => c !== nome);
                          setFilters({ ...filters, clientes: next });
                        }}
                        className="accent-[var(--color-primary)]"
                      />
                      {nome}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bairro</Label>
                <div className="space-y-1 max-h-[120px] overflow-y-auto rounded-lg border border-input bg-transparent p-2">
                  {uniqueBairros.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum bairro</p>
                  ) : uniqueBairros.map(bairro => (
                    <label key={bairro} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={filters.bairros.includes(bairro)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...filters.bairros, bairro]
                            : filters.bairros.filter(b => b !== bairro);
                          setFilters({ ...filters, bairros: next });
                        }}
                        className="accent-[var(--color-primary)]"
                      />
                      {bairro}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <div className="space-y-1 max-h-[120px] overflow-y-auto rounded-lg border border-input bg-transparent p-2">
                  {uniqueFormasPag.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma</p>
                  ) : uniqueFormasPag.map(fp => (
                    <label key={fp.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={filters.formasPagamento.includes(fp.id)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...filters.formasPagamento, fp.id]
                            : filters.formasPagamento.filter(id => id !== fp.id);
                          setFilters({ ...filters, formasPagamento: next });
                        }}
                        className="accent-[var(--color-primary)]"
                      />
                      {fp.nome}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Situação Pagamento</Label>
                <select
                  value={filters.situacaoPagamento}
                  onChange={(e) =>
                    setFilters({ ...filters, situacaoPagamento: e.target.value })
                  }
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                >
                  <option value="">Todos</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Pago">Pago</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Status Entrega</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {["Pendente", "Em rota", "Entregue", "Cancelado"].map((st) => (
                    <button key={st} type="button"
                      onClick={() => {
                        const arr = filters.statusEntrega.includes(st)
                          ? filters.statusEntrega.filter(s => s !== st)
                          : [...filters.statusEntrega, st];
                        setFilters({ ...filters, statusEntrega: arr });
                      }}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        filters.statusEntrega.includes(st)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      }`}>
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-data-inicio">Data de</Label>
                <Input
                  id="filter-data-inicio"
                  type="date"
                  value={filters.dataInicio}
                  onChange={(e) =>
                    setFilters({ ...filters, dataInicio: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-data-fim">Data até</Label>
                <Input
                  id="filter-data-fim"
                  type="date"
                  value={filters.dataFim}
                  onChange={(e) =>
                    setFilters({ ...filters, dataFim: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-valor-min">Valor min</Label>
                <Input
                  id="filter-valor-min"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={filters.valorMin}
                  onChange={(e) =>
                    setFilters({ ...filters, valorMin: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-valor-max">Valor max</Label>
                <Input
                  id="filter-valor-max"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={filters.valorMax}
                  onChange={(e) =>
                    setFilters({ ...filters, valorMax: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Recorrente</Label>
                <select
                  value={filters.recorrente}
                  onChange={(e) =>
                    setFilters({ ...filters, recorrente: e.target.value })
                  }
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                >
                  <option value="">Todos</option>
                  <option value="sim">Recorrentes</option>
                  <option value="nao">Avulsos</option>
                </select>
              </div>
            </div>

            <Separator className="my-4" />

            <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-xs text-muted-foreground">
              Limpar filtros
            </Button>
          </CardContent>
        )}
      </Card>

      {loading ? (
        <p className="text-center text-muted-foreground">Carregando...</p>
      ) : filteredByTab.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          Nenhum pedido nesta categoria.
        </p>
      ) : (
        <>
        {/* Floating bulk action bar */}
        <div
          className={`sticky top-0 z-10 bg-card border border-border rounded-lg px-4 py-2 flex flex-wrap items-center gap-2 shadow-lg transition-all duration-200 ${
            selectedIds.size > 0
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-2 pointer-events-none h-0 py-0 px-0 border-0 overflow-hidden"
          }`}
        >
          <span className="text-sm font-medium mr-1">
            {selectedIds.size} pedido{selectedIds.size !== 1 ? "s" : ""} selecionado{selectedIds.size !== 1 ? "s" : ""}
          </span>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
            onClick={() => handleBulkAction("entregue")}
          >
            <Check className="size-3.5" />
            Marcar Entregue
          </Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
            onClick={() => handleBulkAction("pago")}
          >
            <CreditCard className="size-3.5" />
            Marcar Pago
          </Button>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white h-7 text-xs"
            onClick={() => handleBulkAction("cancelado")}
          >
            <Ban className="size-3.5" />
            Cancelar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => handleBulkAction("pendente_entrega")}
          >
            <RotateCcw className="size-3.5" />
            Pendente Entrega
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => handleBulkAction("pendente_pagamento")}
          >
            <RotateCcw className="size-3.5" />
            Pendente Pgto
          </Button>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white h-7 text-xs"
              onClick={() => setBulkDatePickerOpen(!bulkDatePickerOpen)}
            >
              <CalendarDays className="size-3.5" />
              Alterar Data
            </Button>
            {bulkDatePickerOpen && (
              <div className="flex items-center gap-1">
                <Input
                  type="date"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  className="h-7 text-xs w-36"
                />
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white h-7 text-xs"
                  onClick={() => {
                    if (bulkDate) handleBulkAction("pendente_entrega", bulkDate);
                  }}
                  disabled={!bulkDate}
                >
                  Aplicar
                </Button>
              </div>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs ml-auto"
            onClick={() => setSelectedIds(new Set())}
          >
            <X className="size-3.5" />
            Limpar
          </Button>
        </div>

        {/* Mobile card view */}
        <div className="sm:hidden space-y-2">
          {filteredByTab.map((pedido) => (
            <div key={pedido.id} className={`rounded-lg border overflow-hidden relative ${selectedIds.has(pedido.id) ? "border-primary/50 bg-primary/5" : ""}`}>
              {/* Selection checkbox */}
              <div className="absolute top-2 right-2 z-[1]">
                <input
                  type="checkbox"
                  checked={selectedIds.has(pedido.id)}
                  onChange={() => toggleSelect(pedido.id)}
                  className="size-4 cursor-pointer accent-[var(--color-primary)]"
                />
              </div>
              {/* Card header - clickable to edit */}
              <div
                className="p-3 pr-8 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setDrawerPedidoId(pedido.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium text-sm truncate">{pedido.cliente?.nome}</span>
                    {pedido.recorrenteId && <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">Rec</Badge>}
                  </div>
                  <span className="font-bold text-sm shrink-0 ml-2">{formatPrice(pedido.total)}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  {getPagamentoBadge(pedido.situacaoPagamento, pedido.statusEntrega)}
                  {getEntregaBadge(pedido.statusEntrega)}
                  <span className="text-xs text-muted-foreground ml-auto">{formatDate(pedido.dataEntrega)}</span>
                </div>
                {pedido.cliente?.bairro && (
                  <div className="text-xs text-muted-foreground mt-1">{pedido.cliente.bairro}</div>
                )}
              </div>
              {/* Action buttons */}
              <div className="flex border-t divide-x">
                {pedido.statusEntrega === "Entregue" && pedido.situacaoPagamento !== "Pago" && (
                  <button
                    className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-green-400 hover:bg-green-400/10 transition-colors"
                    onClick={() => handleMarkPago(pedido)}
                  >
                    <CreditCard className="size-3.5" />
                    Pago
                  </button>
                )}
                {pedido.statusEntrega !== "Entregue" && (
                  <button
                    className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-blue-400 hover:bg-blue-400/10 transition-colors"
                    onClick={() => handleMarkEntregue(pedido)}
                  >
                    <Check className="size-3.5" />
                    Entregue
                  </button>
                )}
                <button
                  className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
                  onClick={() => handleDuplicar(pedido.id)}
                >
                  <Copy className="size-3.5" />
                  Duplicar
                </button>
                <button
                  className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
                  onClick={() => setDrawerPedidoId(pedido.id)}
                >
                  <Pencil className="size-3.5" />
                  Editar
                </button>
                <button
                  className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-red-400 hover:bg-red-400/10 transition-colors"
                  onClick={() => handleDelete(pedido.id)}
                >
                  <Trash2 className="size-3.5" />
                  Excluir
                </button>
              </div>
            </div>
          ))}
          {/* Mobile totals summary */}
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total pedidos</span>
              <span className="font-medium">{totals.count}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor total</span>
              <span className="font-bold">{formatPrice(totals.total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Recebido</span>
              <span className="font-medium text-green-500">{formatPrice(totals.recebido)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pendente</span>
              <span className="font-medium text-red-500">{formatPrice(totals.pendente)}</span>
            </div>
          </div>
        </div>

        {/* Desktop table view */}
        <div className="hidden sm:block">
          {/* Column settings */}
          <div className="flex justify-end mb-1">
            <div ref={colunasRef} className="relative">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setColunasOpen(o => !o)}>
                <SlidersHorizontal className="size-3.5" />
                Colunas
              </Button>
              {colunasOpen && (
                <div className="absolute right-0 top-8 z-20 bg-popover border border-border rounded-lg shadow-lg p-3 w-52">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Colunas visíveis</p>
                  <div className="space-y-1">
                    {colunasConfig.map((col, i) => {
                      const label = COLUNAS_DEFAULT.find(c => c.key === col.key)?.label ?? col.key;
                      return (
                        <div key={col.key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={col.visible}
                            onChange={() => toggleCol(col.key)}
                            className="accent-[var(--color-primary)] size-3.5 cursor-pointer"
                          />
                          <span className="text-sm flex-1">{label}</span>
                          <button
                            onClick={() => moveCol(col.key, -1)}
                            disabled={i === 0}
                            className="p-0.5 rounded hover:bg-accent disabled:opacity-30"
                          ><ChevronUp className="size-3" /></button>
                          <button
                            onClick={() => moveCol(col.key, 1)}
                            disabled={i === colunasConfig.length - 1}
                            className="p-0.5 rounded hover:bg-accent disabled:opacity-30"
                          ><ChevronDown className="size-3" /></button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleSelectAll}
                      className="size-4 cursor-pointer accent-[var(--color-primary)]"
                    />
                  </TableHead>
                  {colunasConfig.filter(c => c.visible).map(col => {
                    const sortable: Partial<Record<ColKey, SortField>> = { id: 'id', cliente: 'cliente', bairro: 'bairro', total: 'total', pgto: 'pgto', formaPgto: 'formaPgto', entrega: 'entrega', data: 'data' };
                    const sf = sortable[col.key];
                    const label = COLUNAS_DEFAULT.find(c => c.key === col.key)?.label ?? col.key;
                    return (
                      <TableHead
                        key={col.key}
                        className={`${sf ? 'cursor-pointer select-none hover:text-foreground' : ''} ${col.key === 'total' ? 'text-right' : ''}`}
                        onClick={sf ? () => toggleSort(sf) : undefined}
                      >
                        {label}{sf ? sortIndicator(sf) : ''}
                      </TableHead>
                    );
                  })}
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredByTab.map((pedido) => (
                  <TableRow
                    key={pedido.id}
                    className={`cursor-pointer hover:bg-accent/50 transition-colors ${selectedIds.has(pedido.id) ? 'bg-primary/5' : ''}`}
                    onDoubleClick={() => setDrawerPedidoId(pedido.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(pedido.id)}
                        onChange={() => toggleSelect(pedido.id)}
                        className="size-4 cursor-pointer accent-[var(--color-primary)]"
                      />
                    </TableCell>
                    {colunasConfig.filter(c => c.visible).map(col => {
                      switch (col.key) {
                        case 'id':
                          return <TableCell key="id" className="font-medium">{pedido.id}</TableCell>;
                        case 'cliente':
                          return (
                            <TableCell key="cliente">
                              <span className="flex items-center gap-1.5">
                                {pedido.cliente?.nome}
                                {pedido.recorrenteId && <Badge variant="outline" className="text-[10px] px-1 py-0">Rec</Badge>}
                              </span>
                            </TableCell>
                          );
                        case 'bairro':
                          return <TableCell key="bairro">{pedido.cliente?.bairro}</TableCell>;
                        case 'total':
                          return <TableCell key="total" className="text-right font-medium">{formatPrice(pedido.total)}</TableCell>;
                        case 'pgto':
                          return (
                            <TableCell key="pgto" onClick={(e) => e.stopPropagation()}>
                              {pedido.statusEntrega === 'Entregue' ? (
                                <span className="cursor-pointer active:scale-95 transition-transform" onClick={() => handleInlineTogglePgto(pedido)}>
                                  {getPagamentoBadge(pedido.situacaoPagamento, pedido.statusEntrega)}
                                </span>
                              ) : (
                                getPagamentoBadge(pedido.situacaoPagamento, pedido.statusEntrega)
                              )}
                            </TableCell>
                          );
                        case 'formaPgto':
                          return <TableCell key="formaPgto" className="text-sm text-muted-foreground">{pedido.formaPagamento?.nome ?? '—'}</TableCell>;
                        case 'entrega':
                          return (
                            <TableCell key="entrega" onClick={(e) => e.stopPropagation()}>
                              <span className="cursor-pointer active:scale-95 transition-transform" onClick={() => handleInlineToggleEntrega(pedido)}>
                                {getEntregaBadge(pedido.statusEntrega)}
                              </span>
                            </TableCell>
                          );
                        case 'data':
                          return (
                            <TableCell key="data" onClick={(e) => e.stopPropagation()}>
                              {editingDateId === pedido.id ? (
                                <input
                                  type="date"
                                  autoFocus
                                  value={editingDateValue}
                                  onChange={(e) => setEditingDateValue(e.target.value)}
                                  onBlur={() => handleInlineSaveDate(pedido.id, editingDateValue)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleInlineSaveDate(pedido.id, editingDateValue);
                                    if (e.key === 'Escape') setEditingDateId(null);
                                  }}
                                  className="h-7 w-32 bg-transparent border-b border-primary text-sm outline-none"
                                />
                              ) : (
                                <span
                                  className="cursor-pointer hover:text-primary transition-colors"
                                  onClick={() => { setEditingDateId(pedido.id); setEditingDateValue(pedido.dataEntrega || ''); }}
                                >
                                  {formatDate(pedido.dataEntrega)}
                                </span>
                              )}
                            </TableCell>
                          );
                        default:
                          return null;
                      }
                    })}
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {pedido.statusEntrega === 'Entregue' && pedido.situacaoPagamento !== 'Pago' && (
                          <Button variant="ghost" size="sm" onClick={() => handleMarkPago(pedido)} title="Marcar como Pago">
                            <CreditCard className="size-4" />Pago
                          </Button>
                        )}
                        {pedido.statusEntrega !== 'Entregue' && (
                          <Button variant="ghost" size="sm" onClick={() => handleMarkEntregue(pedido)} title="Marcar como Entregue">
                            <Check className="size-4" />Entregue
                          </Button>
                        )}
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDuplicar(pedido.id)} title="Duplicar">
                          <Copy className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" title="Editar" onClick={() => setDrawerPedidoId(pedido.id)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="destructive" size="icon-sm" onClick={() => handleDelete(pedido.id)} title="Excluir">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <tfoot className="sticky bottom-0 bg-card border-t border-border">
                <tr>
                  <td colSpan={colunasConfig.filter(c => c.visible).length + 2} className="px-4 py-2">
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span className="text-muted-foreground">Total: <span className="font-bold text-foreground">{totals.count} pedido{totals.count !== 1 ? 's' : ''}</span></span>
                      <span className="font-bold">{formatPrice(totals.total)}</span>
                      <span><span className="font-bold text-green-500">{formatPrice(totals.recebido)}</span> <span className="text-muted-foreground text-xs">recebido</span></span>
                      <span><span className="font-bold text-red-500">{formatPrice(totals.pendente)}</span> <span className="text-muted-foreground text-xs">pendente</span></span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </Table>
          </div>
        </div>
        </>
      )}

      {/* Slide-over Drawer */}
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${
          drawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setDrawerPedidoId(null)}
      />
      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[500px] lg:w-[600px] bg-card border-l border-border shadow-xl transition-transform duration-300 ease-in-out ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {drawerLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : drawerPedido ? (
          <div className="flex flex-col h-full overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold">
                Pedido #{drawerPedido.id}
                {drawerEditMode && <span className="text-sm font-normal text-muted-foreground ml-2">— Editando</span>}
              </h2>
              <Button variant="ghost" size="icon-sm" onClick={() => setDrawerPedidoId(null)}>
                <X className="size-5" />
              </Button>
            </div>

            {drawerEditMode ? (
              /* ============ EDIT MODE ============ */
              <>
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                  {/* Client info (read-only) */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Cliente</Label>
                    <p className="font-medium text-sm">{drawerPedido.cliente?.nome}</p>
                    {drawerPedido.cliente?.bairro && (
                      <p className="text-xs text-muted-foreground">{drawerPedido.cliente.bairro}</p>
                    )}
                  </div>

                  <Separator />

                  {/* Data Entrega */}
                  <div className="space-y-1">
                    <Label className="text-xs">Data de Entrega</Label>
                    <Input
                      type="date"
                      value={editDataEntrega}
                      onChange={(e) => setEditDataEntrega(e.target.value)}
                    />
                  </div>

                  {/* Forma de Pagamento */}
                  <div className="space-y-1">
                    <Label className="text-xs">Forma de Pagamento</Label>
                    <select
                      value={editFormaPagamentoId}
                      onChange={(e) => setEditFormaPagamentoId(e.target.value)}
                      className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                    >
                      <option value="">Selecione...</option>
                      {editFormasPagamento.map((fp) => (
                        <option key={fp.id} value={String(fp.id)}>{fp.nome}</option>
                      ))}
                    </select>
                  </div>

                  {/* Taxa de Entrega */}
                  <div className="space-y-1">
                    <Label className="text-xs">Taxa de Entrega</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editTaxaEntrega}
                      onChange={(e) => setEditTaxaEntrega(parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* Observacoes */}
                  <div className="space-y-1">
                    <Label className="text-xs">Observações</Label>
                    <textarea
                      value={editObservacoes}
                      onChange={(e) => setEditObservacoes(e.target.value)}
                      rows={2}
                      placeholder="Observações do pedido..."
                      className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 resize-none"
                    />
                  </div>

                  <Separator />

                  {/* Items section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium">Itens do Pedido</p>
                      <Button type="button" variant="outline" size="sm" onClick={handleEditAddItem} className="h-7 text-xs">
                        <Plus className="size-3.5" />
                        Adicionar
                      </Button>
                    </div>

                    {editItens.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-4">
                        Nenhum item. Clique em &quot;Adicionar&quot;.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {editItens.map((item, index) => {
                          const promo = getEditPromocaoForProduto(item.produtoId);
                          const produto = editProdutos.find((p) => String(p.id) === item.produtoId);
                          const { subtotal, qtdCobrada } = calcEditSubtotal(item);
                          const isDescontoPromo = promo && (promo.tipo || "desconto") === "desconto";
                          const isLevePromo = promo && promo.tipo === "leve_x_pague_y";

                          return (
                            <div key={index} className="rounded-lg border border-border p-3 space-y-2">
                              {/* Product autocomplete */}
                              <div className="relative" ref={(el) => { editProdutoRefs.current[index] = el; }}>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1">
                                    <Input
                                      placeholder="Buscar produto..."
                                      value={editProdutoSearches[index] ?? (produto?.nome || "")}
                                      onChange={(e) => {
                                        setEditProdutoSearches((prev) => ({ ...prev, [index]: e.target.value }));
                                        setEditProdutoDropdowns((prev) => ({ ...prev, [index]: true }));
                                        setEditProdutoHighlights((prev) => ({ ...prev, [index]: 0 }));
                                        if (!e.target.value) handleEditItemChange(index, "produtoId", "");
                                      }}
                                      onFocus={() => setEditProdutoDropdowns((prev) => ({ ...prev, [index]: true }))}
                                      onKeyDown={(e) => handleEditProdutoKeyDown(index, e)}
                                      autoComplete="off"
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon-sm"
                                    onClick={() => handleEditRemoveItem(index)}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                                {editProdutoDropdowns[index] && (() => {
                                  const filtered = getEditFilteredProdutos(index);
                                  if (filtered.length === 0) return null;
                                  const hl = editProdutoHighlights[index] || 0;
                                  return (
                                    <div className="absolute z-50 mt-1 max-h-40 w-full overflow-auto rounded-lg border bg-popover shadow-md">
                                      {filtered.map((p, pi) => {
                                        const pPromo = getEditPromocaoForProduto(String(p.id));
                                        const hasDiscountPromo = pPromo && (pPromo.tipo || "desconto") === "desconto" && pPromo.precoPromocional;
                                        return (
                                          <button
                                            key={p.id}
                                            type="button"
                                            className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between ${
                                              pi === hl ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"
                                            }`}
                                            onMouseEnter={() => setEditProdutoHighlights((prev) => ({ ...prev, [index]: pi }))}
                                            onClick={() => handleEditProdutoSelect(index, String(p.id))}
                                          >
                                            <span className="font-medium">{p.nome}</span>
                                            <span className="ml-2 text-xs">
                                              {hasDiscountPromo ? (
                                                <>
                                                  <span className="line-through text-muted-foreground">{formatPrice(p.preco)}</span>
                                                  {" "}
                                                  <span className="text-green-400">{formatPrice(pPromo.precoPromocional)}</span>
                                                </>
                                              ) : (
                                                <span className="text-muted-foreground">{formatPrice(p.preco)}</span>
                                              )}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Qty, Price, Subtotal row */}
                              <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Qtd</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={item.quantidade}
                                    onChange={(e) => handleEditItemChange(index, "quantidade", e.target.value)}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Preço Unit.</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.precoUnitario}
                                    onChange={(e) => handleEditItemChange(index, "precoUnitario", e.target.value)}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Subtotal</Label>
                                  <div className="flex h-8 items-center text-sm font-medium">
                                    {formatPrice(subtotal)}
                                  </div>
                                </div>
                              </div>

                              {/* Promo badges */}
                              {(isDescontoPromo || isLevePromo || qtdCobrada !== null) && (
                                <div className="flex items-center gap-2">
                                  {isDescontoPromo && produto && (
                                    <>
                                      <Badge className="bg-green-600 text-white text-xs">
                                        Promo: {formatPrice(promo.precoPromocional)}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground line-through">
                                        {formatPrice(produto.preco)}
                                      </span>
                                    </>
                                  )}
                                  {isLevePromo && (
                                    <Badge className="bg-blue-600 text-white text-xs">
                                      Leve {promo.leveQuantidade} Pague {promo.pagueQuantidade}
                                    </Badge>
                                  )}
                                  {qtdCobrada !== null && (
                                    <span className="text-xs text-muted-foreground">
                                      ({qtdCobrada} un. cobradas)
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Totals */}
                    {editItens.length > 0 && (
                      <div className="mt-3 space-y-1 px-1">
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Subtotal Itens</span>
                          <span>{formatPrice(editSubtotalItens)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Taxa de Entrega</span>
                          <span>{formatPrice(editTaxaEntrega)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold pt-1">
                          <span>Total</span>
                          <span>{formatPrice(editTotal)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Save button footer */}
                <div className="shrink-0 border-t border-border px-6 py-4 flex flex-col gap-2">
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleEditSave}
                    disabled={editSaving}
                  >
                    <Save className="size-4" />
                    {editSaving ? "Salvando..." : "Salvar Pedido"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setDrawerEditMode(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </>
            ) : (
              /* ============ DETAIL VIEW (default) ============ */
              <>
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                  {/* Client info */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Cliente</p>
                    <p className="font-medium">{drawerPedido.cliente?.nome}</p>
                    {(drawerPedido.cliente?.rua || drawerPedido.cliente?.bairro) && (
                      <p className="text-sm text-muted-foreground">
                        {[drawerPedido.cliente?.rua, drawerPedido.cliente?.numero].filter(Boolean).join(", ")}
                        {drawerPedido.cliente?.rua && drawerPedido.cliente?.bairro ? " — " : ""}
                        {drawerPedido.cliente?.bairro}
                        {drawerPedido.cliente?.cidade ? `, ${drawerPedido.cliente.cidade}` : ""}
                      </p>
                    )}
                    {drawerPedido.cliente?.telefone && (
                      <p className="text-sm text-muted-foreground">{drawerPedido.cliente.telefone}</p>
                    )}
                  </div>

                  <Separator />

                  {/* Delivery date - editable */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Data de Entrega</p>
                    <Input
                      type="date"
                      value={drawerPedido.dataEntrega}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        setDrawerPedido({ ...drawerPedido, dataEntrega: newDate });
                        drawerUpdateField("dataEntrega", newDate);
                      }}
                      className="w-44"
                    />
                  </div>

                  <Separator />

                  {/* Items table */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-muted-foreground">Itens</p>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => enterEditMode()}>
                        <Pencil className="size-3 mr-1" />
                        Editar Pedido
                      </Button>
                    </div>
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead className="text-center">Qtd</TableHead>
                            <TableHead className="text-right">Preço</TableHead>
                            <TableHead className="text-right">Subtotal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {drawerPedido.itens.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="text-sm">{item.produto?.nome}</TableCell>
                              <TableCell className="text-center text-sm">{item.quantidade}</TableCell>
                              <TableCell className="text-right text-sm">{formatPrice(item.precoUnitario)}</TableCell>
                              <TableCell className="text-right text-sm font-medium">{formatPrice(item.subtotal)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex justify-between items-center mt-3 px-1">
                      <span className="text-sm text-muted-foreground">Total</span>
                      <span className="text-lg font-bold">{formatPrice(drawerPedido.total)}</span>
                    </div>
                    {drawerPedido.formaPagamento && (
                      <div className="flex justify-between items-center mt-1 px-1">
                        <span className="text-sm text-muted-foreground">Forma de Pagamento</span>
                        <span className="text-sm">{drawerPedido.formaPagamento.nome}</span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Payment status toggle — only shown after delivery */}
                  {drawerPedido.statusEntrega === "Entregue" && <div>
                    <p className="text-sm text-muted-foreground mb-2">Situação Pagamento</p>
                    <div className="flex gap-2">
                      {(["Pendente", "Pago"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => drawerUpdateField("situacaoPagamento", s)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            drawerPedido.situacaoPagamento === s
                              ? s === "Pago"
                                ? "bg-green-600 text-white"
                                : "bg-yellow-500 text-white"
                              : "bg-muted text-muted-foreground hover:bg-accent"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>}

                  {/* Delivery status toggle */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Status Entrega</p>
                    <div className="flex gap-2 flex-wrap">
                      {(["Pendente", "Em rota", "Entregue", "Cancelado"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => drawerUpdateField("statusEntrega", s)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            drawerPedido.statusEntrega === s
                              ? s === "Entregue"
                                ? "bg-green-600 text-white"
                                : s === "Em rota"
                                ? "bg-blue-600 text-white"
                                : s === "Cancelado"
                                ? "bg-red-600 text-white"
                                : "bg-gray-500 text-white"
                              : "bg-muted text-muted-foreground hover:bg-accent"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Observacoes - editable */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Observações</p>
                    <textarea
                      value={drawerPedido.observacoes || ""}
                      onChange={(e) => setDrawerPedido({ ...drawerPedido, observacoes: e.target.value })}
                      onBlur={(e) => drawerUpdateField("observacoes", e.target.value)}
                      rows={3}
                      placeholder="Nenhuma observação"
                      className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 resize-none"
                    />
                  </div>

                  {/* Histórico do Cliente */}
                  <div className="border-t pt-3">
                    <button
                      onClick={() => setDrawerHistoryOpen(!drawerHistoryOpen)}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
                    >
                      <ChevronRight className={`size-4 transition-transform ${drawerHistoryOpen ? "rotate-90" : ""}`} />
                      Histórico do Cliente ({drawerHistory.length})
                    </button>
                    {drawerHistoryOpen && (
                      <div className="mt-2 space-y-0 max-h-[200px] overflow-y-auto">
                        {drawerHistory.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhum pedido anterior.</p>
                        ) : (
                          drawerHistory.map((p) => (
                            <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                              <div>
                                <span className="text-xs text-muted-foreground">{formatDate(p.dataEntrega)}</span>
                                <span className="text-sm ml-2">{p.itens.map(i => `${i.quantidade}x ${i.produto.nome}`).join(", ")}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{formatPrice(p.total)}</span>
                                {getPagamentoBadge(p.situacaoPagamento, p.statusEntrega)}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer actions */}
                <div className="shrink-0 border-t border-border px-6 py-4 flex items-center gap-2">
                  <Button
                    variant="destructive"
                    onClick={drawerDelete}
                  >
                    <Trash2 className="size-4" />
                    Excluir
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

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
