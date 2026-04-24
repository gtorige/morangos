"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { TabsNav } from "@/components/ui/tabs-nav";
import {
  Plus,
  ClipboardList,
  Check,
  CreditCard,
  X,
  CalendarDays,
  Ban,
  RotateCcw,
  Trash2,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  Download,
  Search,
} from "lucide-react";
import { formatDate, formatPrice } from "@/lib/formatting";
import type { PedidoItem } from "@/lib/types";

type PeriodoKey = "ontem" | "hoje" | "semana" | "prox_semana" | "mes" | "ultimos7" | "todos" | "custom";
type StatusTab = "todos" | "concluidos" | "pendente_pgto" | "pendente_tudo";
type ColKey = 'id' | 'cliente' | 'bairro' | 'total' | 'pgto' | 'formaPgto' | 'entrega' | 'data' | 'produto' | 'qtd';

interface Filters {
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

interface ColConfig {
  key: ColKey;
  visible: boolean;
}

const COLUNAS_LABELS: Record<ColKey, string> = {
  id: '#',
  cliente: 'Cliente',
  bairro: 'Bairro',
  produto: 'Produto',
  qtd: 'Qtd',
  total: 'Total',
  pgto: 'Pgto',
  formaPgto: 'F. Pgto',
  entrega: 'Entrega',
  data: 'Data',
};

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-primary/15 text-primary border border-primary/30">
      {label}
      <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="opacity-60 hover:opacity-100"><X className="size-3" /></button>
    </span>
  );
}

interface PedidoToolbarProps {
  busca: string;
  setBusca: (v: string) => void;
  activeFilterCount: number;
  drawerFiltrosOpen: boolean;
  setDrawerFiltrosOpen: (v: boolean) => void;
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  emptyFilters: Filters;
  onClearAll: () => void;
  uniqueFormasPag: { id: number; nome: string }[];
  periodo: PeriodoKey;
  setPeriodo: (v: PeriodoKey) => void;
  getPeriodoDates: (key: PeriodoKey) => { dataInicio: string; dataFim: string };
  tab: StatusTab;
  setTab: (v: StatusTab) => void;
  tabs: { key: string; label: string; count: number }[];
  // Column config
  colunasConfig: ColConfig[];
  setColunasConfig: React.Dispatch<React.SetStateAction<ColConfig[]>>;
  // Bulk actions
  selectedIds: Set<number>;
  setSelectedIds: (v: Set<number>) => void;
  onBulkAction: (action: string, dataEntrega?: string) => void;
  onBulkDelete: () => void;
  // Export
  onExport: () => void;
  // Novo pedido
  onNovoPedido: () => void;
}

export function PedidoToolbar({
  busca,
  setBusca,
  activeFilterCount,
  drawerFiltrosOpen,
  setDrawerFiltrosOpen,
  filters,
  setFilters,
  emptyFilters: _emptyFilters,
  onClearAll,
  uniqueFormasPag,
  periodo,
  setPeriodo,
  getPeriodoDates,
  tab,
  setTab,
  tabs,
  colunasConfig,
  setColunasConfig,
  selectedIds,
  setSelectedIds,
  onBulkAction,
  onBulkDelete,
  onExport,
  onNovoPedido,
}: PedidoToolbarProps) {
  const [colunasOpen, setColunasOpen] = useState(false);
  const [bulkDatePickerOpen, setBulkDatePickerOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState("");
  const colunasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!colunasOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (colunasRef.current && !colunasRef.current.contains(e.target as Node)) setColunasOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [colunasOpen]);

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

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-5" />
          <h1 className="text-2xl font-semibold">Pedidos</h1>
        </div>
        <Button
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={onNovoPedido}
        >
          <Plus className="size-4" />
          Novo Pedido
        </Button>
      </div>

      {/* Search bar + filter toggle */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, produto ou #pedido..."
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Button
          variant={activeFilterCount > 0 ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs gap-1.5 shrink-0"
          onClick={() => setDrawerFiltrosOpen(!drawerFiltrosOpen)}
        >
          <SlidersHorizontal className="size-3.5" />
          {activeFilterCount > 0 ? `Filtros (${activeFilterCount})` : 'Filtros'}
        </Button>
      </div>

      {/* Active filter chips */}
      {(activeFilterCount > 0 || busca.trim()) && (
        <div className="flex flex-wrap gap-1.5 items-center">
          {busca.trim() && <Chip label={`Busca: ${busca}`} onRemove={() => setBusca('')} />}
          {filters.clientes.map(c => <Chip key={c} label={`Cliente: ${c}`} onRemove={() => setFilters(f => ({...f, clientes: f.clientes.filter(x => x !== c)}))} />)}
          {filters.bairros.map(b => <Chip key={b} label={`Bairro: ${b}`} onRemove={() => setFilters(f => ({...f, bairros: f.bairros.filter(x => x !== b)}))} />)}
          {filters.cidades.map(c => <Chip key={c} label={`Cidade: ${c}`} onRemove={() => setFilters(f => ({...f, cidades: f.cidades.filter(x => x !== c)}))} />)}
          {filters.formasPagamento.map(id => {
            const fp = uniqueFormasPag.find(f => f.id === id);
            return <Chip key={id} label={`F. Pgto: ${fp?.nome || id}`} onRemove={() => setFilters(f => ({...f, formasPagamento: f.formasPagamento.filter(x => x !== id)}))} />;
          })}
          {filters.situacaoPagamento && <Chip label={`Situacao: ${filters.situacaoPagamento}`} onRemove={() => setFilters(f => ({...f, situacaoPagamento: ''}))} />}
          {filters.statusPedido?.map(s => <Chip key={s} label={`Status: ${s}`} onRemove={() => setFilters(f => ({...f, statusPedido: (f.statusPedido || []).filter(x => x !== s)}))} />)}
          {filters.recorrente && <Chip label={`Recorrente: ${filters.recorrente === "sim" ? "Sim" : "Nao"}`} onRemove={() => setFilters(f => ({...f, recorrente: ''}))} />}
          <button onClick={onClearAll} className="px-2.5 py-1 rounded-full text-xs border border-border text-muted-foreground hover:text-foreground transition-colors">Limpar filtros</button>
        </div>
      )}

      {/* Date range shortcuts */}
      <div className="flex flex-wrap gap-1.5">
        {([
          { key: "ontem" as PeriodoKey, label: "Ontem" },
          { key: "hoje" as PeriodoKey, label: "Hoje" },
          { key: "semana" as PeriodoKey, label: "Semana" },
          { key: "prox_semana" as PeriodoKey, label: "Próx. Semana" },
          { key: "mes" as PeriodoKey, label: "Mês" },
          { key: "ultimos7" as PeriodoKey, label: "Últimos 7 dias" },
          { key: "todos" as PeriodoKey, label: "Todos" },
          { key: "custom" as PeriodoKey, label: "Custom" },
        ]).map((s) => (
          <Button
            key={s.key}
            variant={periodo === s.key ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setPeriodo(s.key);
              const dates = getPeriodoDates(s.key);
              setFilters(f => ({ ...f, ...dates }));
            }}
            className={`h-7 text-xs ${periodo === s.key ? "bg-primary text-primary-foreground" : ""}`}
          >
            {s.label}
          </Button>
        ))}
        {periodo !== "custom" && filters.dataInicio && (
          <span className="text-xs text-muted-foreground self-center ml-1">
            {formatDate(filters.dataInicio)}{filters.dataFim && filters.dataInicio !== filters.dataFim ? ` a ${formatDate(filters.dataFim)}` : ""}
          </span>
        )}
        {periodo === "custom" && (
          <div className="flex items-center gap-1.5">
            <DateInput value={filters.dataInicio} onChange={(v) => setFilters(f => ({ ...f, dataInicio: v }))} className="w-36" />
            <span className="text-xs text-muted-foreground">a</span>
            <DateInput value={filters.dataFim} onChange={(v) => setFilters(f => ({ ...f, dataFim: v }))} className="w-36" />
          </div>
        )}
      </div>

      {/* Status Tabs */}
      <TabsNav items={tabs} value={tab} onChange={(key) => setTab(key as StatusTab)} />

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
          onClick={() => onBulkAction("entregue")}
        >
          <Check className="size-3.5" />
          Marcar Entregue
        </Button>
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
          onClick={() => onBulkAction("pago")}
        >
          <CreditCard className="size-3.5" />
          Marcar Pago
        </Button>
        <Button
          size="sm"
          className="bg-red-600 hover:bg-red-700 text-white h-7 text-xs"
          onClick={() => onBulkAction("cancelado")}
        >
          <Ban className="size-3.5" />
          Cancelar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => onBulkAction("pendente_entrega")}
        >
          <RotateCcw className="size-3.5" />
          Pendente Entrega
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => onBulkAction("pendente_pagamento")}
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
              <DateInput
                value={bulkDate}
                onChange={(v) => setBulkDate(v)}
                className="w-36"
              />
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white h-7 text-xs"
                onClick={() => {
                  if (bulkDate) {
                    onBulkAction("alterar_data", bulkDate);
                    setBulkDatePickerOpen(false);
                    setBulkDate("");
                  }
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
          className="bg-red-600 hover:bg-red-700 text-white h-7 text-xs"
          onClick={onBulkDelete}
        >
          <Trash2 className="size-3.5" />
          Excluir
        </Button>
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

      {/* Column settings + CSV (desktop only, shown above table) */}
      <div className="hidden sm:flex justify-end gap-2">
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onExport}>
          <Download className="size-3.5" />
          CSV
        </Button>
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
                  const label = COLUNAS_LABELS[col.key] ?? col.key;
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
    </>
  );
}
