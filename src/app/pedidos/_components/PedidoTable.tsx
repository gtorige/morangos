"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Copy,
  Pencil,
  Trash2,
  Check,
  CreditCard,
  MoreHorizontal,
  MessageCircle,
} from "lucide-react";
import { formatPrice, formatDate } from "@/lib/formatting";
import type { PedidoItem } from "@/lib/types";
import type { Pedido } from "@/hooks/use-pedidos";

type ColKey = 'id' | 'cliente' | 'bairro' | 'total' | 'pgto' | 'formaPgto' | 'entrega' | 'data' | 'produto' | 'qtd';
type SortField = "id" | "cliente" | "bairro" | "total" | "pgto" | "formaPgto" | "entrega" | "data";
type SortDir = "asc" | "desc";

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

interface MensagemWpp {
  id: number;
  nome: string;
  texto: string;
}

interface PedidoTableProps {
  pedidos: Pedido[];
  colunasConfig: ColConfig[];
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
  someSelected: boolean;
  onRowDoubleClick: (id: number) => void;
  onRowClick: (id: number) => void;
  onMarkPago: (pedido: Pedido) => void;
  onMarkEntregue: (pedido: Pedido) => void;
  onDuplicar: (id: number) => void;
  onDelete: (id: number) => void;
  onInlineTogglePgto: (pedido: Pedido) => void;
  onInlineToggleEntrega: (pedido: Pedido) => void;
  editingDateId: number | null;
  editingDateValue: string;
  onStartEditDate: (id: number, value: string) => void;
  onEditDateChange: (value: string) => void;
  onSaveDate: (id: number, value: string) => void;
  onCancelEditDate: () => void;
  totals: { count: number; total: number; recebido: number; pendente: number };
  mensagensWpp: MensagemWpp[];
}

function getPagamentoBadge(situacao: string, statusEntrega?: string) {
  if (statusEntrega && statusEntrega !== "Entregue") return null;
  return <StatusBadge status={situacao} context="pagamento" />;
}

function getEntregaBadge(status: string) {
  return <StatusBadge status={status} context="entrega" />;
}

export function PedidoTable({
  pedidos,
  colunasConfig,
  sortField,
  sortDir,
  onSort,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  allSelected,
  someSelected,
  onRowDoubleClick,
  onRowClick,
  onMarkPago,
  onMarkEntregue,
  onDuplicar,
  onDelete,
  onInlineTogglePgto,
  onInlineToggleEntrega,
  editingDateId,
  editingDateValue,
  onStartEditDate,
  onEditDateChange,
  onSaveDate,
  onCancelEditDate,
  totals,
  mensagensWpp,
}: PedidoTableProps) {
  function sortIndicator(field: SortField) {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  return (
    <>
      {/* Mobile card view */}
      <div className="sm:hidden space-y-2">
        {pedidos.map((pedido) => (
          <div key={pedido.id} className={`rounded-lg border overflow-hidden relative ${selectedIds.has(pedido.id) ? "border-primary/50 bg-primary/5" : ""}`}>
            {/* Selection checkbox */}
            <div className="absolute top-2 right-2 z-[1]">
              <input
                type="checkbox"
                checked={selectedIds.has(pedido.id)}
                onChange={() => onToggleSelect(pedido.id)}
                aria-label={`Selecionar pedido #${pedido.id}`}
                className="size-4 cursor-pointer accent-[var(--color-primary)]"
              />
            </div>
            {/* Card header - clickable to edit */}
            <div
              className="p-2.5 pr-8 cursor-pointer transition-colors"
              onClick={() => onRowClick(pedido.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-medium truncate">{pedido.cliente?.nome}</span>
                </div>
                <span className="text-xs font-bold shrink-0 ml-2">{formatPrice(pedido.total)}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {getPagamentoBadge(pedido.situacaoPagamento, pedido.statusEntrega)}
                {getEntregaBadge(pedido.statusEntrega)}
                <span className="text-xs text-muted-foreground ml-auto">{formatDate(pedido.dataEntrega)}</span>
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex border-t divide-x">
              {pedido.statusEntrega === "Entregue" && pedido.situacaoPagamento !== "Pago" && (
                <button
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-green-400 hover:bg-green-400/10 transition-colors"
                  onClick={() => onMarkPago(pedido)}
                >
                  <CreditCard className="size-3.5" />
                  Pago
                </button>
              )}
              {pedido.statusEntrega !== "Entregue" && (
                <button
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-blue-400 hover:bg-blue-400/10 transition-colors"
                  onClick={() => onMarkEntregue(pedido)}
                >
                  <Check className="size-3.5" />
                  Entregue
                </button>
              )}
              <button
                className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
                onClick={() => onDuplicar(pedido.id)}
              >
                <Copy className="size-3.5" />
                Duplicar
              </button>
              <Popover>
                <PopoverTrigger
                  render={
                    <button className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors" />
                  }
                >
                  <MoreHorizontal className="size-3.5" />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-40 p-1">
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
                    onClick={() => onRowClick(pedido.id)}
                  >
                    <Pencil className="size-4" /> Editar
                  </button>
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-accent transition-colors"
                    onClick={() => onDelete(pedido.id)}
                  >
                    <Trash2 className="size-4" /> Excluir
                  </button>
                </PopoverContent>
              </Popover>
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
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={onToggleSelectAll}
                    aria-label="Selecionar todos os pedidos"
                    className="size-4 cursor-pointer accent-[var(--color-primary)]"
                  />
                </TableHead>
                {colunasConfig.filter(c => c.visible).map(col => {
                  const sortable: Partial<Record<ColKey, SortField>> = { id: 'id', cliente: 'cliente', bairro: 'bairro', total: 'total', pgto: 'pgto', formaPgto: 'formaPgto', entrega: 'entrega', data: 'data' };
                  const sf = sortable[col.key];
                  const label = COLUNAS_LABELS[col.key] ?? col.key;
                  return (
                    <TableHead
                      key={col.key}
                      className={`${sf ? 'cursor-pointer select-none hover:text-foreground' : ''} ${col.key === 'total' ? 'text-right' : ''}`}
                      onClick={sf ? () => onSort(sf) : undefined}
                    >
                      {label}{sf ? sortIndicator(sf) : ''}
                    </TableHead>
                  );
                })}
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidos.map((pedido) => {
                const isCompleted = pedido.statusEntrega === "Entregue" && pedido.situacaoPagamento === "Pago";
                return (
                <TableRow
                  key={pedido.id}
                  className={`cursor-pointer transition-colors ${selectedIds.has(pedido.id) ? 'bg-primary/5' : ''} ${isCompleted ? 'opacity-50' : ''}`}
                  onDoubleClick={() => onRowDoubleClick(pedido.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(pedido.id)}
                      onChange={() => onToggleSelect(pedido.id)}
                      aria-label={`Selecionar pedido #${pedido.id}`}
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
                              <span className="cursor-pointer active:scale-95 transition-transform" onClick={() => onInlineTogglePgto(pedido)}>
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
                            <span className="cursor-pointer active:scale-95 transition-transform" onClick={() => onInlineToggleEntrega(pedido)}>
                              {getEntregaBadge(pedido.statusEntrega)}
                            </span>
                          </TableCell>
                        );
                      case 'produto': {
                        const itens = pedido.itens ?? [];
                        const nome = itens[0]?.produto?.nome ?? '—';
                        return (
                          <TableCell key="produto" className="text-sm">
                            {itens.length <= 1 ? nome : `${nome} +${itens.length - 1}`}
                          </TableCell>
                        );
                      }
                      case 'qtd': {
                        const total = (pedido.itens ?? []).reduce((s, i) => s + i.quantidade, 0);
                        return <TableCell key="qtd" className="text-sm text-center">{total || '—'}</TableCell>;
                      }
                      case 'data':
                        return (
                          <TableCell key="data" onClick={(e) => e.stopPropagation()}>
                            {editingDateId === pedido.id ? (
                              <input
                                type="date"
                                autoFocus
                                value={editingDateValue}
                                onChange={(e) => onEditDateChange(e.target.value)}
                                onBlur={() => onSaveDate(pedido.id, editingDateValue)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') onSaveDate(pedido.id, editingDateValue);
                                  if (e.key === 'Escape') onCancelEditDate();
                                }}
                                className="h-7 w-32 bg-transparent border-b border-primary text-sm outline-none"
                              />
                            ) : (
                              <span
                                className="cursor-pointer hover:text-primary transition-colors"
                                onClick={() => onStartEditDate(pedido.id, pedido.dataEntrega || '')}
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
                      {pedido.cliente?.telefone && (
                        <Popover>
                          <PopoverTrigger render={<Button variant="ghost" size="icon-sm" title="WhatsApp" onClick={(e) => e.stopPropagation()} />}>
                            <MessageCircle className="size-4 text-green-500" />
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-2" onClick={(e) => e.stopPropagation()}>
                            <p className="text-xs text-muted-foreground font-medium mb-1">Enviar mensagem:</p>
                            {mensagensWpp.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic py-2">Nenhuma mensagem cadastrada</p>
                            ) : mensagensWpp.map((m) => {
                              const texto = m.texto
                                .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
                                .replace(/\{nome\}/gi, pedido.cliente.nome)
                                .replace(/\{total\}/gi, formatPrice(pedido.total));
                              const num = pedido.cliente.telefone!.replace(/\D/g, '');
                              const full = num.startsWith('55') ? num : '55' + num;
                              return (
                                <button key={m.id} onClick={() => window.open(`https://wa.me/${full}?text=${encodeURIComponent(texto)}`, '_blank')}
                                  className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted transition-colors">
                                  <p className="text-xs font-medium">{m.nome}</p>
                                  <p className="text-xs text-muted-foreground truncate">{texto}</p>
                                </button>
                              );
                            })}
                          </PopoverContent>
                        </Popover>
                      )}
                      <Button variant="ghost" size="icon-sm" onClick={() => onDuplicar(pedido.id)} title="Duplicar">
                        <Copy className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => onDelete(pedido.id)} title="Excluir">
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
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
  );
}
