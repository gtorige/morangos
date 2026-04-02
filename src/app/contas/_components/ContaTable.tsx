"use client";

import React from "react";
import { parseISO, isToday, isPast, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Receipt,
  Trash2,
  Check,
  RotateCw,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { formatPrice, formatDate } from "@/lib/formatting";
import type { Conta, Categoria, Subcategoria } from "@/hooks/use-contas";

type ContaColKey = "fornecedor" | "categoria" | "subcategoria" | "tipo" | "parcelas" | "valor" | "vencimento" | "situacao";

interface ColConfig {
  key: ContaColKey;
  label: string;
  visible: boolean;
  required?: boolean;
}

interface ContaTableProps {
  contas: Conta[];
  filteredContas: Conta[];
  contasLoading: boolean;
  categorias: Categoria[];
  subcategorias: Subcategoria[];
  visCols: ColConfig[];
  sortField: ContaColKey;
  sortDir: "asc" | "desc";
  setSortField: (f: ContaColKey) => void;
  setSortDir: (d: "asc" | "desc") => void;
  selectedIds: Set<number>;
  toggleSelect: (id: number) => void;
  toggleSelectAll: () => void;
  expandedGrupos: Set<string>;
  toggleGrupo: (key: string) => void;
  activeFiltersCount: number;
  onEditConta: (item: Conta) => void;
  onDeleteConta: (id: number) => void;
  onMarkPago: (id: number) => void;
  onBulkPago: () => void;
  onBulkPendente: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}

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

function getCategoriaNome(conta: Conta, categorias: Categoria[]) {
  if (conta.categoriaId) {
    const cat = categorias.find((c) => c.id === conta.categoriaId);
    if (cat) return cat.nome;
  }
  return conta.categoria || "";
}

function getSubcategoriaNome(conta: Conta, subcategorias: Subcategoria[]) {
  if (!conta.subcategoriaId) return "";
  return subcategorias.find((s) => s.id === conta.subcategoriaId)?.nome ?? "";
}

function renderCell(col: ContaColKey, item: Conta, categorias: Categoria[], subcategorias: Subcategoria[]) {
  switch (col) {
    case "fornecedor":
      return <span>{item.fornecedorNome}</span>;
    case "categoria":
      return <span>{getCategoriaNome(item, categorias)}</span>;
    case "subcategoria":
      return <span className="text-sm text-muted-foreground">{getSubcategoriaNome(item, subcategorias) || "\u2014"}</span>;
    case "tipo":
      return item.tipoFinanceiro ? (
        <StatusBadge status={item.tipoFinanceiro} context="financeiro" />
      ) : <span className="text-muted-foreground">{"\u2014"}</span>;
    case "parcelas":
      return item.parcelas > 1 ? (
        <span className="text-xs text-muted-foreground">{item.parcelaNumero}/{item.parcelas}x</span>
      ) : <span className="text-muted-foreground">{"\u2014"}</span>;
    case "valor":
      return <span>{formatPrice(item.valor)}</span>;
    case "vencimento":
      return <span>{formatDate(item.vencimento)}</span>;
    case "situacao":
      return getSituacaoBadge(item);
  }
}

// ── Component ──

export function ContaTable({
  contas,
  filteredContas,
  contasLoading,
  categorias,
  subcategorias,
  visCols,
  sortField,
  sortDir,
  setSortField,
  setSortDir,
  selectedIds,
  toggleSelect,
  toggleSelectAll,
  expandedGrupos,
  toggleGrupo,
  activeFiltersCount,
  onEditConta,
  onDeleteConta,
  onMarkPago,
  onBulkPago,
  onBulkPendente,
  onBulkDelete,
  onClearSelection,
}: ContaTableProps) {
  const setSelectedIds = (updater: (prev: Set<number>) => Set<number>) => {
    // This is handled through toggleSelect / toggleSelectAll from parent
    // For grupo toggling we need a different approach
  };

  return (
    <>
      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
          <span className="text-sm font-medium">{selectedIds.size} selecionada{selectedIds.size !== 1 ? "s" : ""}</span>
          <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={onBulkPago}>
            <Check className="size-3 mr-1" />
            Marcar Pago
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onBulkPendente}>
            <RotateCw className="size-3 mr-1" />
            Marcar Pendente
          </Button>
          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={onBulkDelete}>
            <Trash2 className="size-3 mr-1" />
            Excluir
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto" onClick={onClearSelection}>
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
                <TableHead key={col.key}>
                  <button
                    type="button"
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={() => {
                      if (sortField === col.key) {
                        setSortDir(sortDir === "asc" ? "desc" : "asc");
                      } else {
                        setSortField(col.key);
                        setSortDir("asc");
                      }
                    }}
                  >
                    {col.label}
                    {sortField === col.key && (
                      sortDir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
                    )}
                  </button>
                </TableHead>
              ))}
              <TableHead className="text-right">Acoes</TableHead>
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
              <ContaTableRows
                contas={contas}
                filteredContas={filteredContas}
                categorias={categorias}
                subcategorias={subcategorias}
                visCols={visCols}
                selectedIds={selectedIds}
                toggleSelect={toggleSelect}
                expandedGrupos={expandedGrupos}
                toggleGrupo={toggleGrupo}
                onEditConta={onEditConta}
                onDeleteConta={onDeleteConta}
                onMarkPago={onMarkPago}
              />
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

// ── Row rendering (extracted for clarity) ──

interface ContaTableRowsProps {
  contas: Conta[];
  filteredContas: Conta[];
  categorias: Categoria[];
  subcategorias: Subcategoria[];
  visCols: ColConfig[];
  selectedIds: Set<number>;
  toggleSelect: (id: number) => void;
  expandedGrupos: Set<string>;
  toggleGrupo: (key: string) => void;
  onEditConta: (item: Conta) => void;
  onDeleteConta: (id: number) => void;
  onMarkPago: (id: number) => void;
}

function ContaTableRows({
  contas,
  filteredContas,
  categorias,
  subcategorias,
  visCols,
  selectedIds,
  toggleSelect,
  expandedGrupos,
  toggleGrupo,
  onEditConta,
  onDeleteConta,
  onMarkPago,
}: ContaTableRowsProps) {
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
        ids2.forEach((id) => toggleSelect(id));
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
                  <span className={`text-xs transition-transform ${expanded ? "rotate-90" : ""}`}>{"\u25B6"}</span>
                  {item.fornecedorNome}
                </div>
              </TableCell>
            );
            if (col.key === "categoria") return (
              <TableCell key="categoria">{getCategoriaNome(item, categorias)}</TableCell>
            );
            if (col.key === "subcategoria") return (
              <TableCell key="subcategoria">
                <span className="text-sm text-muted-foreground">{getSubcategoriaNome(item, subcategorias) || "\u2014"}</span>
              </TableCell>
            );
            if (col.key === "tipo") return (
              <TableCell key="tipo">
                {item.tipoFinanceiro ? <StatusBadge status={item.tipoFinanceiro} context="financeiro" /> : <span className="text-muted-foreground">{"\u2014"}</span>}
              </TableCell>
            );
            if (col.key === "parcelas") return (
              <TableCell key="parcelas">
                <span className="text-xs text-muted-foreground">{pagas}/{grupo2.length}x pagas</span>
              </TableCell>
            );
            if (col.key === "valor") return (
              <TableCell key="valor">{formatPrice(totalGrupo)}</TableCell>
            );
            if (col.key === "vencimento") return (
              <TableCell key="vencimento">{nextPendente ? formatDate(nextPendente.vencimento) : "\u2014"}</TableCell>
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
              onDoubleClick={() => onEditConta(parcela)}
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
                    <Button variant="ghost" size="icon-sm" onClick={() => onMarkPago(parcela.id)} title="Marcar como pago">
                      <Check className="size-4 text-green-500" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon-sm" onClick={() => onDeleteConta(parcela.id)} title="Excluir">
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
          onDoubleClick={() => onEditConta(item)}
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
              {renderCell(col.key, item, categorias, subcategorias)}
            </TableCell>
          ))}
          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-end gap-1">
              {item.situacao === "Pendente" && (
                <Button variant="ghost" size="icon-sm" onClick={() => onMarkPago(item.id)} title="Marcar como pago">
                  <Check className="size-4 text-green-500" />
                </Button>
              )}
              <Button variant="ghost" size="icon-sm" onClick={() => onDeleteConta(item.id)} title="Excluir">
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      );
    }
  }
  return <>{rows}</>;
}
