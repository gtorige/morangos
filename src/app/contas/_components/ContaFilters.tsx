"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Filter,
  Search,
  RotateCcw,
  SlidersHorizontal,
  Download,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

import type { Categoria, Subcategoria } from "@/hooks/use-contas";

type ContaColKey = "fornecedor" | "categoria" | "subcategoria" | "tipo" | "parcelas" | "valor" | "vencimento" | "situacao";

interface ColConfig {
  key: ContaColKey;
  label: string;
  visible: boolean;
  required?: boolean;
}

interface ContaFiltersProps {
  filterBusca: string;
  setFilterBusca: (v: string) => void;
  filtersOpen: boolean;
  setFiltersOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  activeFiltersCount: number;
  resetFilters: () => void;
  filterCategoriaId: string;
  setFilterCategoriaId: (v: string) => void;
  filterSubcategoriaId: string;
  setFilterSubcategoriaId: (v: string) => void;
  filterTipo: string;
  setFilterTipo: (v: string) => void;
  filterSituacao: string;
  setFilterSituacao: (v: string) => void;
  filterVencDe: string;
  setFilterVencDe: (v: string) => void;
  filterVencAte: string;
  setFilterVencAte: (v: string) => void;
  categorias: Categoria[];
  subcategorias: Subcategoria[];
  colunasConfig: ColConfig[];
  colunasOpen: boolean;
  setColunasOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  colunasRef: React.RefObject<HTMLDivElement | null>;
  toggleCol: (key: ContaColKey) => void;
  moveCol: (i: number, dir: -1 | 1) => void;
  exportContasCSV: () => void;
}

export function ContaFilters({
  filterBusca,
  setFilterBusca,
  filtersOpen,
  setFiltersOpen,
  activeFiltersCount,
  resetFilters,
  filterCategoriaId,
  setFilterCategoriaId,
  filterSubcategoriaId,
  setFilterSubcategoriaId,
  filterTipo,
  setFilterTipo,
  filterSituacao,
  setFilterSituacao,
  filterVencDe,
  setFilterVencDe,
  filterVencAte,
  setFilterVencAte,
  categorias,
  subcategorias,
  colunasConfig,
  colunasOpen,
  setColunasOpen,
  colunasRef,
  toggleCol,
  moveCol,
  exportContasCSV,
}: ContaFiltersProps) {
  return (
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
          onClick={() => setFiltersOpen((v: boolean) => !v)}
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
            onClick={() => setColunasOpen((v: boolean) => !v)}
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
            <Label className="text-xs">Situacao</Label>
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
            <DateInput value={filterVencDe} onChange={setFilterVencDe} className="w-full" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Vencimento ate</Label>
            <DateInput value={filterVencAte} onChange={setFilterVencAte} className="w-full" />
          </div>
        </div>
      )}
    </>
  );
}
