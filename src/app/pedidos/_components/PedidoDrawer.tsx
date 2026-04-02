"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
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
  Pencil,
  Trash2,
  X,
  Loader2,
  Save,
  ChevronRight,
} from "lucide-react";
import { formatPrice, formatDate } from "@/lib/formatting";
import type { Produto, FormaPagamento, Promocao, PedidoItem, ItemPedidoForm } from "@/lib/types";
import type { Pedido } from "@/hooks/use-pedidos";

type EditItem = ItemPedidoForm;

interface PedidoDrawerProps {
  drawerOpen: boolean;
  drawerLoading: boolean;
  drawerPedido: Pedido | null;
  onClose: () => void;
  onUpdateField: (field: string, value: string | number) => void;
  onDelete: () => void;
  setDrawerPedido: (pedido: Pedido) => void;
  // Edit mode
  drawerEditMode: boolean;
  enterEditMode: () => void;
  // Edit mode state
  editDataEntrega: string;
  setEditDataEntrega: (v: string) => void;
  editFormaPagamentoId: string;
  setEditFormaPagamentoId: (v: string) => void;
  editTaxaEntrega: number;
  setEditTaxaEntrega: (v: number) => void;
  editObservacoes: string;
  setEditObservacoes: (v: string) => void;
  editItens: EditItem[];
  editSaving: boolean;
  editSubtotalItens: number;
  editTotal: number;
  editProdutos: Produto[];
  editFormasPagamento: FormaPagamento[];
  editProdutoSearches: Record<number, string>;
  editProdutoDropdowns: Record<number, boolean>;
  editProdutoHighlights: Record<number, number>;
  setEditProdutoSearches: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setEditProdutoDropdowns: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setEditProdutoHighlights: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  editProdutoRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  onEditItemChange: (index: number, field: keyof EditItem, value: string) => void;
  onEditAddItem: () => void;
  onEditRemoveItem: (index: number) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  getEditPromocaoForProduto: (produtoId: string, quantidade?: number) => Promocao | undefined;
  calcEditSubtotal: (item: EditItem) => { subtotal: number; qtdCobrada: number | null };
  getEditFilteredProdutos: (index: number) => Produto[];
  handleEditProdutoSelect: (index: number, produtoId: string) => void;
  handleEditProdutoKeyDown: (index: number, e: React.KeyboardEvent) => void;
  // History
  drawerHistoryOpen: boolean;
  setDrawerHistoryOpen: (v: boolean) => void;
  drawerHistory: Pedido[];
}

export function PedidoDrawer({
  drawerOpen,
  drawerLoading,
  drawerPedido,
  onClose,
  onUpdateField,
  onDelete,
  setDrawerPedido,
  drawerEditMode,
  enterEditMode,
  editDataEntrega,
  setEditDataEntrega,
  editFormaPagamentoId,
  setEditFormaPagamentoId,
  editTaxaEntrega,
  setEditTaxaEntrega,
  editObservacoes,
  setEditObservacoes,
  editItens,
  editSaving,
  editSubtotalItens,
  editTotal,
  editProdutos,
  editFormasPagamento,
  editProdutoSearches,
  editProdutoDropdowns,
  editProdutoHighlights,
  setEditProdutoSearches,
  setEditProdutoDropdowns,
  setEditProdutoHighlights,
  editProdutoRefs,
  onEditItemChange,
  onEditAddItem,
  onEditRemoveItem,
  onEditSave,
  onEditCancel,
  getEditPromocaoForProduto,
  calcEditSubtotal,
  getEditFilteredProdutos,
  handleEditProdutoSelect,
  handleEditProdutoKeyDown,
  drawerHistoryOpen,
  setDrawerHistoryOpen,
  drawerHistory,
}: PedidoDrawerProps) {
  function getPagamentoBadge(situacao: string, statusEntrega?: string) {
    if (statusEntrega && statusEntrega !== "Entregue") return null;
    return <StatusBadge status={situacao} context="pagamento" />;
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${
          drawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
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
              <Button variant="ghost" size="icon-sm" onClick={onClose}>
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
                      <Button type="button" variant="outline" size="sm" onClick={onEditAddItem} className="h-7 text-xs">
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
                                        if (!e.target.value) onEditItemChange(index, "produtoId", "");
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
                                    onClick={() => onEditRemoveItem(index)}
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
                                    onChange={(e) => onEditItemChange(index, "quantidade", e.target.value)}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Preço Unit.</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.precoUnitario}
                                    onChange={(e) => onEditItemChange(index, "precoUnitario", e.target.value)}
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
                    onClick={onEditSave}
                    disabled={editSaving}
                  >
                    <Save className="size-4" />
                    {editSaving ? "Salvando..." : "Salvar Pedido"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={onEditCancel}
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
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-muted-foreground">Cliente</p>
                      <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => window.open(`/clientes?edit=${drawerPedido.clienteId}`, '_blank')}>
                        <Pencil className="size-3 mr-1" /> Editar
                      </Button>
                    </div>
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
                    {drawerPedido.cliente?.observacoes && (
                      <p className="text-xs text-muted-foreground italic mt-1">Obs: {drawerPedido.cliente.observacoes}</p>
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
                        onUpdateField("dataEntrega", newDate);
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
                          onClick={() => onUpdateField("situacaoPagamento", s)}
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
                          onClick={() => onUpdateField("statusEntrega", s)}
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
                      onBlur={(e) => onUpdateField("observacoes", e.target.value)}
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
                    onClick={onDelete}
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
    </>
  );
}
