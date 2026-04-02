import { useState, useCallback, useEffect } from "react";
import { todayStr, dateToStr } from "@/lib/formatting";
import type { PedidoItem } from "@/lib/types";

// ── Types ──

export interface Pedido {
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
  updatedAt?: string;
  cliente: { id: number; nome: string; telefone?: string; rua?: string; numero?: string; bairro: string; cidade?: string; observacoes?: string };
  formaPagamento: { id: number; nome: string } | null;
  itens: PedidoItem[];
}

export interface PedidoFilters {
  clientes: string[];
  bairros: string[];
  cidades: string[];
  formasPagamento: number[];
  situacaoPagamento: string;
  statusEntrega: string[];
  statusPedido: string[];
  dataInicio: string;
  dataFim: string;
  recorrente: string;
}

export type PeriodoKey = "ontem" | "hoje" | "semana" | "prox_semana" | "mes" | "ultimos7" | "todos" | "custom";

export const defaultFilters: PedidoFilters = {
  clientes: [],
  bairros: [],
  cidades: [],
  formasPagamento: [],
  situacaoPagamento: "",
  statusEntrega: ["Pendente", "Em rota", "Entregue"],
  statusPedido: [],
  dataInicio: todayStr(),
  dataFim: todayStr(),
  recorrente: "",
};

export const emptyFilters: PedidoFilters = {
  clientes: [],
  bairros: [],
  cidades: [],
  formasPagamento: [],
  situacaoPagamento: "",
  statusEntrega: [],
  statusPedido: [],
  dataInicio: "",
  dataFim: "",
  recorrente: "",
};

// ── Helpers ──

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

export function getPeriodoDates(key: PeriodoKey): { dataInicio: string; dataFim: string } {
  switch (key) {
    case "ontem": {
      const d = new Date(); d.setDate(d.getDate() - 1); const s = dateToStr(d);
      return { dataInicio: s, dataFim: s };
    }
    case "hoje": {
      const t = todayStr();
      return { dataInicio: t, dataFim: t };
    }
    case "semana": {
      const mon = getMonday(new Date());
      const sun = getSunday(mon);
      return { dataInicio: dateToStr(mon), dataFim: dateToStr(sun) };
    }
    case "prox_semana": {
      const mon = getMonday(new Date());
      const nextMon = new Date(mon); nextMon.setDate(mon.getDate() + 7);
      const nextSun = getSunday(nextMon);
      return { dataInicio: dateToStr(nextMon), dataFim: dateToStr(nextSun) };
    }
    case "mes": {
      const d = new Date(); const y = d.getFullYear(); const m = d.getMonth();
      return { dataInicio: dateToStr(new Date(y, m, 1)), dataFim: dateToStr(new Date(y, m + 1, 0)) };
    }
    case "ultimos7": {
      const end = new Date(); const start = new Date(); start.setDate(end.getDate() - 6);
      return { dataInicio: dateToStr(start), dataFim: dateToStr(end) };
    }
    case "todos":
    case "custom":
      return { dataInicio: "", dataFim: "" };
  }
}

interface UsePedidosOptions {
  /** Initial filters (e.g. from URL params) */
  initialFilters?: PedidoFilters;
  /** Initial period key */
  initialPeriodo?: PeriodoKey;
}

/**
 * Hook for managing orders: fetch with filters, CRUD, drawer, bulk ops.
 */
export function usePedidos(options: UsePedidosOptions = {}) {
  const { initialFilters, initialPeriodo = "hoje" } = options;

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [allPedidos, setAllPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PedidoFilters>(initialFilters ?? defaultFilters);
  const [periodo, setPeriodo] = useState<PeriodoKey>(initialPeriodo);

  const fetchPedidos = useCallback(async (customFilters?: PedidoFilters) => {
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

  // Debounced fetch on filter change
  useEffect(() => {
    const timer = setTimeout(() => fetchPedidos(), 300);
    return () => clearTimeout(timer);
  }, [filters]);

  // Update pedido field
  const updatePedido = useCallback(async (id: number, data: Record<string, unknown>) => {
    try {
      await fetch(`/api/pedidos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      fetchPedidos();
    } catch (error) {
      console.error("Erro ao atualizar pedido:", error);
    }
  }, [fetchPedidos]);

  // Delete pedido
  const deletePedido = useCallback(async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este pedido?")) return false;
    try {
      await fetch(`/api/pedidos/${id}`, { method: "DELETE" });
      fetchPedidos();
      return true;
    } catch (error) {
      console.error("Erro ao excluir pedido:", error);
      return false;
    }
  }, [fetchPedidos]);

  // Fetch single pedido detail
  const fetchPedido = useCallback(async (id: number): Promise<Pedido | null> => {
    try {
      const res = await fetch(`/api/pedidos/${id}`);
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  // Fetch client order history
  const fetchClienteHistory = useCallback(async (clienteId: number, excludeId?: number): Promise<Pedido[]> => {
    try {
      const res = await fetch(`/api/pedidos?cliente=${clienteId}&limit=11&orderBy=desc`);
      const data: Pedido[] = await res.json();
      return excludeId ? data.filter((p) => p.id !== excludeId).slice(0, 10) : data.slice(0, 10);
    } catch {
      return [];
    }
  }, []);

  return {
    pedidos,
    allPedidos,
    loading,
    filters, setFilters,
    periodo, setPeriodo,
    fetchPedidos,
    updatePedido,
    deletePedido,
    fetchPedido,
    fetchClienteHistory,
  };
}
