"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Repeat, Calendar, Loader2, Search, Download, SlidersHorizontal, ChevronUp, ChevronDown } from "lucide-react";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { todayStr, formatPrice } from "@/lib/formatting";
import type { Produto, FormaPagamento, RecorrenteItem } from "@/lib/types";

interface Cliente { id: number; nome: string; bairro: string }
type FormaPag = FormaPagamento;
type RecItem = RecorrenteItem;
interface Recorrente {
  id: number; clienteId: number; diasSemana: string;
  dataInicio: string; dataFim: string | null; taxaEntrega: number;
  observacoes: string; ativo: boolean;
  cliente: Cliente; formaPagamento: FormaPag | null; formaPagamentoId: number | null;
  itens: RecItem[]; _count: { pedidosGerados: number };
}

interface ItemForm { produtoId: string; quantidade: string; precoManual: string }

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function fmtDate(s: string) { if (!s) return ""; const [y,m,d]=s.split("-"); return `${d}/${m}/${y}` }

export default function RecorrentesPage() {
  const [recorrentes, setRecorrentes] = useState<Recorrente[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [formasPag, setFormasPag] = useState<FormaPag[]>([]);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [clienteId, setClienteId] = useState("");
  const [clienteBusca, setClienteBusca] = useState("");
  const [clienteDropdownOpen, setClienteDropdownOpen] = useState(false);
  const [diasSemana, setDiasSemana] = useState<number[]>([]);
  const [dataInicio, setDataInicio] = useState(todayStr());
  const [dataFim, setDataFim] = useState("");
  const [formaPagId, setFormaPagId] = useState("");
  const [taxaEntrega, setTaxaEntrega] = useState("0");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([]);

  const [gerarResult, setGerarResult] = useState<string | null>(null);

  // Search, columns, CSV
  const [busca, setBusca] = useState("");
  type ColKey = "cliente" | "bairro" | "dias" | "produtos" | "periodo" | "formaPgto" | "status" | "gerados" | "taxa" | "obs";
  const COLUNAS_DEFAULT: { key: ColKey; label: string; defaultVisible?: boolean }[] = [
    { key: "cliente", label: "Cliente" },
    { key: "bairro", label: "Bairro" },
    { key: "dias", label: "Dias" },
    { key: "produtos", label: "Produtos" },
    { key: "periodo", label: "Período" },
    { key: "formaPgto", label: "F. Pgto" },
    { key: "status", label: "Status" },
    { key: "gerados", label: "Gerados" },
    { key: "taxa", label: "Tx. Entrega", defaultVisible: false },
    { key: "obs", label: "Observações", defaultVisible: false },
  ];
  const [colunasConfig, setColunasConfig] = useState<{ key: ColKey; visible: boolean }[]>(() => {
    if (typeof window === "undefined") return COLUNAS_DEFAULT.map(c => ({ key: c.key, visible: c.defaultVisible ?? true }));
    try {
      const saved = localStorage.getItem("recorrentes-colunas");
      if (saved) {
        const parsed: { key: ColKey; visible: boolean }[] = JSON.parse(saved);
        const savedKeys = new Set(parsed.map(c => c.key));
        const missing = COLUNAS_DEFAULT.filter(c => !savedKeys.has(c.key)).map(c => ({ key: c.key, visible: c.defaultVisible ?? true }));
        return [...parsed, ...missing];
      }
    } catch {}
    return COLUNAS_DEFAULT.map(c => ({ key: c.key, visible: c.defaultVisible ?? true }));
  });
  const [colunasOpen, setColunasOpen] = useState(false);

  useEffect(() => { localStorage.setItem("recorrentes-colunas", JSON.stringify(colunasConfig)); }, [colunasConfig]);

  function toggleCol(key: ColKey) {
    setColunasConfig(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  }
  function moveCol(key: ColKey, dir: number) {
    const idx = colunasConfig.findIndex(c => c.key === key);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= colunasConfig.length) return;
    const next = [...colunasConfig];
    [next[idx], next[target]] = [next[target], next[idx]];
    setColunasConfig(next);
  }

  const filtered = recorrentes.filter(rec => {
    if (!busca.trim()) return true;
    const q = busca.trim().toLowerCase();
    return (
      rec.cliente.nome.toLowerCase().includes(q) ||
      rec.cliente.bairro?.toLowerCase().includes(q) ||
      rec.itens.some(i => i.produto.nome.toLowerCase().includes(q)) ||
      rec.formaPagamento?.nome?.toLowerCase().includes(q)
    );
  });

  function exportCSV() {
    const headers = ["Cliente", "Bairro", "Dias", "Produtos", "Data Início", "Data Fim", "F. Pgto", "Status", "Gerados", "Tx. Entrega", "Observações"];
    const rows = filtered.map(rec => {
      const dias = rec.diasSemana.split(",").map(Number).map(i => DIAS[i]).join(", ");
      const prods = rec.itens.map(i => `${i.produto.nome} x${i.quantidade}`).join("; ");
      return [
        rec.cliente.nome, rec.cliente.bairro || "", dias, prods,
        fmtDate(rec.dataInicio), rec.dataFim ? fmtDate(rec.dataFim) : "",
        rec.formaPagamento?.nome || "", rec.ativo ? "Ativo" : "Inativo",
        String(rec._count.pedidosGerados), formatPrice(rec.taxaEntrega),
        rec.observacoes || "",
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "recorrentes.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  // Delete dialog state
  interface PendingOrder { id: number; dataEntrega: string; total: number; recorrenteId: number | null; cliente: { nome: string } }
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRec, setDeletingRec] = useState<Recorrente | null>(null);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [deleteSelection, setDeleteSelection] = useState<Set<number>>(new Set()); // IDs to DELETE
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [fetchingPending, setFetchingPending] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      setLoading(true);
      const [recRes, cliRes, prodRes, fpRes] = await Promise.all([
        fetch("/api/recorrentes"), fetch("/api/clientes"),
        fetch("/api/produtos"), fetch("/api/formas-pagamento"),
      ]);
      if (recRes.ok) setRecorrentes(await recRes.json());
      if (cliRes.ok) setClientes(await cliRes.json());
      if (prodRes.ok) setProdutos(await prodRes.json());
      if (fpRes.ok) setFormasPag(await fpRes.json());
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function openNew() {
    setEditingId(null); setClienteId(""); setClienteBusca(""); setDiasSemana([]);
    setDataInicio(todayStr()); setDataFim(""); setFormaPagId(""); setTaxaEntrega("0");
    setObservacoes(""); setItens([{ produtoId: "", quantidade: "1", precoManual: "" }]);
    setDialogOpen(true);
  }

  function openEdit(rec: Recorrente) {
    setEditingId(rec.id);
    setClienteId(String(rec.clienteId));
    setClienteBusca(rec.cliente.nome);
    setDiasSemana(rec.diasSemana.split(",").map(Number));
    setDataInicio(rec.dataInicio);
    setDataFim(rec.dataFim || "");
    setFormaPagId(rec.formaPagamentoId ? String(rec.formaPagamentoId) : "");
    setTaxaEntrega(String(rec.taxaEntrega));
    setObservacoes(rec.observacoes);
    setItens(rec.itens.map(i => ({ produtoId: String(i.produtoId), quantidade: String(i.quantidade), precoManual: i.precoManual ? String(i.precoManual) : "" })));
    setDialogOpen(true);
  }

  function toggleDia(dia: number) {
    setDiasSemana(prev => prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia].sort());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId || diasSemana.length === 0 || itens.length === 0) {
      alert("Preencha cliente, dias da semana e pelo menos 1 item.");
      return;
    }

    const body = {
      clienteId: parseInt(clienteId),
      formaPagamentoId: formaPagId ? parseInt(formaPagId) : null,
      diasSemana: diasSemana.join(","),
      dataInicio, dataFim: dataFim || null,
      taxaEntrega: parseFloat(taxaEntrega) || 0,
      observacoes,
      itens: itens.filter(i => i.produtoId).map(i => ({
        produtoId: parseInt(i.produtoId),
        quantidade: parseFloat(i.quantidade) || 1,
        precoManual: i.precoManual ? parseFloat(i.precoManual) : null,
      })),
    };

    try {
      const url = editingId ? `/api/recorrentes/${editingId}` : "/api/recorrentes";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await res.json();
      setDialogOpen(false);
      if (!editingId && result.pedidosCriados) {
        setGerarResult(`Recorrente criado! ${result.pedidosCriados} pedido(s) gerado(s) até ${fmtDate(result.dataFimGerada)}`);
      }
      fetchAll();
    } catch (e) { console.error(e) }
  }

  async function handleToggleAtivo(rec: Recorrente) {
    await fetch(`/api/recorrentes/${rec.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rec, ativo: !rec.ativo, itens: undefined, cliente: undefined, formaPagamento: undefined, _count: undefined }),
    });
    fetchAll();
  }

  async function openDeleteDialog(rec: Recorrente) {
    setDeletingRec(rec);
    setDeleteSelection(new Set());
    setPendingOrders([]);
    setDeleteDialogOpen(true);
    setFetchingPending(true);
    try {
      // Fetch pending orders for this recorrente
      const res = await fetch(`/api/pedidos?statusEntrega=Pendente,Em rota`);
      if (res.ok) {
        const all: PendingOrder[] = await res.json();
        const filtered = all
          .filter((p) => p.recorrenteId === rec.id)
          .sort((a, b) => a.dataEntrega.localeCompare(b.dataEntrega));
        setPendingOrders(filtered);
        // Default: select all for deletion
        setDeleteSelection(new Set(filtered.map(p => p.id)));
      }
    } catch { /* ignore */ }
    finally { setFetchingPending(false); }
  }

  function toggleDeleteOrder(id: number) {
    setDeleteSelection(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllForDeletion() {
    setDeleteSelection(new Set(pendingOrders.map(p => p.id)));
  }

  function deselectAll() {
    setDeleteSelection(new Set());
  }

  async function confirmDelete() {
    if (!deletingRec) return;
    setDeleteLoading(true);
    try {
      const keepOrderIds = pendingOrders
        .map(p => p.id)
        .filter(id => !deleteSelection.has(id));

      const res = await fetch(`/api/recorrentes/${deletingRec.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepOrderIds }),
      });
      if (res.ok) {
        const data = await res.json();
        const msgs: string[] = ["Recorrente excluído."];
        if (data.pedidosDeletados > 0) msgs.push(`${data.pedidosDeletados} pedido(s) eliminado(s).`);
        if (data.pedidosMantidos > 0) msgs.push(`${data.pedidosMantidos} pedido(s) mantido(s).`);
        setGerarResult(msgs.join(" "));
      }
      setDeleteDialogOpen(false);
      fetchAll();
    } catch (e) { console.error(e); }
    finally { setDeleteLoading(false); }
  }

  const filteredClientes = clienteBusca.length >= 1
    ? clientes.filter(c => c.nome.toLowerCase().includes(clienteBusca.toLowerCase())).slice(0, 8)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="size-5" />
          <h1 className="text-2xl font-semibold tracking-tight">Ped. Recorrentes</h1>
        </div>
        <Button onClick={openNew}><Plus className="size-4" /> Novo Recorrente</Button>
      </div>

      {gerarResult && (
        <div className="text-sm text-green-500 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
          {gerarResult}
        </div>
      )}

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente, produto ou bairro..."
          className="pl-9"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {/* Lista */}
      {loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Repeat} title={busca ? "Nenhum recorrente encontrado" : "Nenhum pedido recorrente"} actionLabel={busca ? undefined : "+ Novo Recorrente"} onAction={busca ? undefined : () => openNew()} />
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportCSV}>
              <Download className="size-3.5" /> CSV
            </Button>
            <div className="relative">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setColunasOpen(o => !o)}>
                <SlidersHorizontal className="size-3.5" /> Colunas
              </Button>
              {colunasOpen && (
                <div className="absolute right-0 top-8 z-20 bg-popover border border-border rounded-lg shadow-lg p-3 w-52">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Colunas visíveis</p>
                  <div className="space-y-1">
                    {colunasConfig.map((col, i) => {
                      const label = COLUNAS_DEFAULT.find(c => c.key === col.key)?.label ?? col.key;
                      return (
                        <div key={col.key} className="flex items-center gap-2">
                          <input type="checkbox" checked={col.visible} onChange={() => toggleCol(col.key)} className="accent-[var(--color-primary)] size-3.5 cursor-pointer" />
                          <span className="text-sm flex-1">{label}</span>
                          <button onClick={() => moveCol(col.key, -1)} disabled={i === 0} className="p-0.5 rounded hover:bg-accent disabled:opacity-30"><ChevronUp className="size-3" /></button>
                          <button onClick={() => moveCol(col.key, 1)} disabled={i === colunasConfig.length - 1} className="p-0.5 rounded hover:bg-accent disabled:opacity-30"><ChevronDown className="size-3" /></button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {colunasConfig.filter(c => c.visible).map(col => (
                    <TableHead key={col.key} className={col.key === "gerados" ? "text-center" : ""}>
                      {COLUNAS_DEFAULT.find(c => c.key === col.key)?.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((rec) => {
                  const dias = rec.diasSemana.split(",").map(Number);
                  return (
                    <TableRow
                      key={rec.id}
                      className={`cursor-pointer ${!rec.ativo ? "opacity-50" : ""}`}
                      onDoubleClick={() => openEdit(rec)}
                    >
                      {colunasConfig.filter(c => c.visible).map(col => {
                        switch (col.key) {
                          case "cliente": return (
                            <TableCell key="cliente">
                              <span className="font-medium">{rec.cliente.nome}</span>
                            </TableCell>
                          );
                          case "bairro": return (
                            <TableCell key="bairro" className="text-xs text-muted-foreground">{rec.cliente.bairro || "—"}</TableCell>
                          );
                          case "dias": return (
                            <TableCell key="dias">
                              <div className="flex gap-0.5 flex-wrap">
                                {DIAS.map((nome, i) => (
                                  <span key={i} className={`inline-block px-1 h-5 text-center text-[10px] leading-5 rounded ${dias.includes(i) ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground/30"}`}>{nome}</span>
                                ))}
                              </div>
                            </TableCell>
                          );
                          case "produtos": return (
                            <TableCell key="produtos">
                              <div className="space-y-0.5">
                                {rec.itens.map((item) => (
                                  <div key={item.id} className="text-xs">
                                    {item.produto.nome} <span className="text-muted-foreground">x{item.quantidade}</span>
                                    {item.precoManual != null && <span className="text-muted-foreground ml-1">R$ {item.precoManual.toFixed(2).replace(".", ",")}</span>}
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          );
                          case "periodo": return (
                            <TableCell key="periodo">
                              <div className="text-xs space-y-0.5">
                                <div className="flex items-center gap-1"><Calendar className="size-3 text-muted-foreground" />{fmtDate(rec.dataInicio)}</div>
                                <div className="text-muted-foreground">{rec.dataFim ? `até ${fmtDate(rec.dataFim)}` : "Sem data fim"}</div>
                              </div>
                            </TableCell>
                          );
                          case "formaPgto": return (
                            <TableCell key="formaPgto" className="text-xs">{rec.formaPagamento?.nome || "—"}</TableCell>
                          );
                          case "status": return (
                            <TableCell key="status"><StatusBadge status={rec.ativo ? "Ativo" : "Inativo"} /></TableCell>
                          );
                          case "gerados": return (
                            <TableCell key="gerados" className="text-center"><span className="text-sm font-medium">{rec._count.pedidosGerados}</span></TableCell>
                          );
                          case "taxa": return (
                            <TableCell key="taxa" className="text-xs">{formatPrice(rec.taxaEntrega)}</TableCell>
                          );
                          case "obs": return (
                            <TableCell key="obs" className="text-xs text-muted-foreground max-w-[150px] truncate">{rec.observacoes || "—"}</TableCell>
                          );
                          default: return null;
                        }
                      })}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => handleToggleAtivo(rec)} title={rec.ativo ? "Desativar" : "Ativar"}>
                            <Repeat className={`size-4 ${rec.ativo ? "text-green-500" : "text-muted-foreground"}`} />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => openDeleteDialog(rec)} title="Excluir">
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {filtered.map((rec) => {
              const dias = rec.diasSemana.split(",").map(Number);
              return (
                <div
                  key={rec.id}
                  className={`rounded-lg border overflow-hidden cursor-pointer ${!rec.ativo ? "opacity-50" : ""}`}
                  onDoubleClick={() => openEdit(rec)}
                >
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-sm truncate">{rec.cliente.nome}</span>
                        <StatusBadge status={rec.ativo ? "Ativo" : "Inativo"} />
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{rec._count.pedidosGerados} gerado(s)</span>
                    </div>

                    <div className="flex gap-0.5">
                      {DIAS.map((nome, i) => (
                        <span
                          key={i}
                          className={`inline-block w-7 h-5 text-center text-[10px] leading-5 rounded ${
                            dias.includes(i)
                              ? "bg-primary text-primary-foreground font-medium"
                              : "text-muted-foreground/30"
                          }`}
                        >
                          {nome}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{fmtDate(rec.dataInicio)} {rec.dataFim ? `→ ${fmtDate(rec.dataFim)}` : "→ ∞"}</span>
                      {rec.formaPagamento && <span>{rec.formaPagamento.nome}</span>}
                    </div>

                    <div className="text-xs">
                      {rec.itens.map((item) => (
                        <span key={item.id} className="mr-2">
                          {item.produto.nome} <span className="text-muted-foreground">x{item.quantidade}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex border-t divide-x">
                    <button
                      className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
                      onClick={(e) => { e.stopPropagation(); handleToggleAtivo(rec); }}
                    >
                      <Repeat className={`size-3.5 ${rec.ativo ? "text-green-500" : ""}`} />
                      {rec.ativo ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-red-400 hover:bg-red-400/10 transition-colors"
                      onClick={(e) => { e.stopPropagation(); openDeleteDialog(rec); }}
                    >
                      <Trash2 className="size-3.5" />
                      Excluir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Dialog excluir recorrente */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Excluir Recorrente</DialogTitle>
          </DialogHeader>
          {deletingRec && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Excluir pedido recorrente de <span className="font-medium text-foreground">{deletingRec.cliente.nome}</span>.
                Pedidos já entregues ou cancelados serão mantidos na base.
              </p>

              {fetchingPending ? (
                <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Carregando pedidos pendentes...
                </div>
              ) : pendingOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum pedido pendente vinculado.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{pendingOrders.length} pedido(s) pendente(s):</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={selectAllForDeletion}>
                        Marcar todos
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={deselectAll}>
                        Desmarcar todos
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <input
                              type="checkbox"
                              checked={deleteSelection.size === pendingOrders.length}
                              onChange={() => deleteSelection.size === pendingOrders.length ? deselectAll() : selectAllForDeletion()}
                              className="size-4 accent-red-600 cursor-pointer"
                            />
                          </TableHead>
                          <TableHead>Data Entrega</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Eliminar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingOrders.map((order) => (
                          <TableRow key={order.id} className="cursor-pointer" onClick={() => toggleDeleteOrder(order.id)}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={deleteSelection.has(order.id)}
                                onChange={() => toggleDeleteOrder(order.id)}
                                className="size-4 accent-red-600 cursor-pointer"
                              />
                            </TableCell>
                            <TableCell className="text-sm">{fmtDate(order.dataEntrega)}</TableCell>
                            <TableCell className="text-sm">R$ {order.total.toFixed(2).replace(".", ",")}</TableCell>
                            <TableCell>
                              {deleteSelection.has(order.id) ? (
                                <span className="text-xs text-red-400 font-medium">Eliminar</span>
                              ) : (
                                <span className="text-xs text-green-400 font-medium">Manter</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {deleteSelection.size} pedido(s) serão eliminados, {pendingOrders.length - deleteSelection.size} serão mantidos.
                  </p>
                </>
              )}

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                  disabled={deleteLoading}
                >
                  {deleteLoading && <Loader2 className="size-4 animate-spin" />}
                  Excluir Recorrente
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Recorrente" : "Novo Recorrente"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Cliente */}
            <div className="relative space-y-1">
              <Label>Cliente</Label>
              <Input
                placeholder="Buscar cliente..."
                value={clienteBusca}
                onChange={(e) => { setClienteBusca(e.target.value); if (!e.target.value) setClienteId(""); setClienteDropdownOpen(true) }}
                onFocus={() => setClienteDropdownOpen(true)}
              />
              {clienteDropdownOpen && filteredClientes.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-40 w-full overflow-auto rounded-lg border bg-popover shadow-md">
                  {filteredClientes.map((c) => (
                    <button key={c.id} type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => { setClienteId(String(c.id)); setClienteBusca(c.nome); setClienteDropdownOpen(false) }}>
                      {c.nome} {c.bairro && <span className="text-muted-foreground">- {c.bairro}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dias da semana */}
            <div className="space-y-1">
              <Label>Dias da Semana</Label>
              <div className="flex gap-1.5 flex-wrap">
                {DIAS.map((nome, i) => (
                  <button key={i} type="button"
                    onClick={() => toggleDia(i)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      diasSemana.includes(i)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}>
                    {nome}
                  </button>
                ))}
              </div>
            </div>

            {/* Vigência */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data Início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Data Fim (opcional)</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>

            {/* Pagamento + Taxa */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Forma de Pagamento</Label>
                <select value={formaPagId} onChange={(e) => setFormaPagId(e.target.value)}
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50">
                  <option value="">Selecione...</option>
                  {formasPag.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Taxa de Entrega</Label>
                <Input type="number" step="0.01" min="0" value={taxaEntrega} onChange={(e) => setTaxaEntrega(e.target.value)} />
              </div>
            </div>

            {/* Itens */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Itens</Label>
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setItens([...itens, { produtoId: "", quantidade: "1", precoManual: "" }])}>
                  <Plus className="size-3" /> Produto
                </Button>
              </div>
              {itens.map((item, idx) => {
                const prod = produtos.find(p => String(p.id) === item.produtoId);
                return (
                <div key={idx} className="flex gap-2 items-end flex-wrap sm:flex-nowrap">
                  <div className="flex-1 min-w-[120px]">
                    <select value={item.produtoId}
                      onChange={(e) => { const n = [...itens]; n[idx].produtoId = e.target.value; n[idx].precoManual = ""; setItens(n) }}
                      className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50">
                      <option value="">Produto...</option>
                      {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </div>
                  <div className="w-16">
                    <Input type="number" min="1" step="1" value={item.quantidade} placeholder="Qtd"
                      onChange={(e) => { const n = [...itens]; n[idx].quantidade = e.target.value; setItens(n) }} />
                  </div>
                  <div className="w-24">
                    <Input type="number" step="0.01" min="0" value={item.precoManual}
                      placeholder={prod ? `R$ ${prod.preco.toFixed(2)}` : "Preço"}
                      onChange={(e) => { const n = [...itens]; n[idx].precoManual = e.target.value; setItens(n) }} />
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm"
                    onClick={() => setItens(itens.filter((_, i) => i !== idx))}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                );
              })}
            </div>

            <div className="space-y-1">
              <Label>Observações</Label>
              <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações..." />
            </div>

            <DialogFooter>
              <Button type="submit">{editingId ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
