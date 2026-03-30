"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import { TabsNav, type TabItem } from "@/components/ui/tabs-nav";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Package,
  Plus,
  Snowflake,
  ArrowRightLeft,
  History,
  Pencil,
  Trash2,
} from "lucide-react";
import { formatDate, todayStr } from "@/lib/formatting";
import {
  TIPO_MOVIMENTACAO_CONFIG,
  type TipoMovimentacao,
} from "@/lib/produto-utils";
import type { Produto, EstoqueDia, MovimentacaoEstoque } from "@/lib/types";

// ── Tab config ──

const TABS: TabItem[] = [
  { key: "estoque", label: "Estoque", icon: Package },
  { key: "movimentacao", label: "Movimentação", icon: History },
];

const FILTROS_TIPO = [
  { key: "todos", label: "Todos" },
  { key: "colheita", label: "Colheita" },
  { key: "pedido", label: "Pedidos" },
  { key: "congelamento", label: "Congelamento" },
  { key: "entrada", label: "Entrada manual" },
  { key: "consumo", label: "Consumo" },
  { key: "descarte", label: "Descarte" },
  { key: "ajuste", label: "Ajuste" },
] as const;

// ── Helpers ──

function statusFresco(disponivel: number): {
  label: string;
  cls: string;
} {
  if (disponivel > 0)
    return {
      label: "Suficiente",
      cls: "bg-green-500/10 text-green-500 border-green-500/20",
    };
  if (disponivel === 0)
    return {
      label: "Exato",
      cls: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    };
  return {
    label: "Falta",
    cls: "bg-red-500/10 text-red-500 border-red-500/20",
  };
}

function statusAcumulado(
  atual: number,
  minimo: number
): { label: string; cls: string } {
  if (minimo <= 0 || atual >= minimo)
    return {
      label: "OK",
      cls: "bg-green-500/10 text-green-500 border-green-500/20",
    };
  if (atual >= minimo * 0.5)
    return {
      label: "Baixo",
      cls: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    };
  return {
    label: "Crítico",
    cls: "bg-red-500/10 text-red-500 border-red-500/20",
  };
}

function progressColor(pct: number): string {
  if (pct >= 100) return "bg-green-500";
  if (pct >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

// ── Page ──

export default function EstoquePage() {
  const [tab, setTab] = useState("estoque");
  const [loading, setLoading] = useState(true);
  const [estoque, setEstoque] = useState<EstoqueDia[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEstoque[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [filtroTipo, setFiltroTipo] = useState("todos");

  // Modals
  const [congelarOpen, setCongelarOpen] = useState(false);
  const [movimentarOpen, setMovimentarOpen] = useState(false);
  const [entradaOpen, setEntradaOpen] = useState(false);
  const [entradaProduto, setEntradaProduto] = useState<EstoqueDia | null>(null);

  // Saving state
  const [saving, setSaving] = useState(false);

  // Edit movimentação
  const [editMovOpen, setEditMovOpen] = useState(false);
  const [editMovId, setEditMovId] = useState<number | null>(null);
  const [editMovForm, setEditMovForm] = useState({ quantidade: "", motivo: "", data: "" });

  // ── Congelar form ──
  const [congelarForm, setCongelarForm] = useState({
    data: todayStr(),
    produtoFrescoId: "",
    quantidadeKg: "",
    produtoCongeladoId: "",
    observacao: "",
  });

  // ── Movimentar form ──
  const [movimentarForm, setMovimentarForm] = useState({
    data: todayStr(),
    tipo: "entrada",
    produtoId: "",
    quantidade: "",
    unidade: "un",
    motivo: "",
  });

  // ── Entrada form ──
  const [entradaForm, setEntradaForm] = useState({
    data: todayStr(),
    quantidade: "",
    motivo: "Lote produzido",
    observacao: "",
  });

  // ── Fetch data ──

  const fetchEstoque = useCallback(async () => {
    try {
      const res = await fetch(`/api/estoque/dia?data=${todayStr()}`);
      if (!res.ok) return;
      const data = await res.json();
      setEstoque(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao buscar estoque:", err);
    }
  }, []);

  const fetchMovimentacoes = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filtroTipo !== "todos") params.set("tipo", filtroTipo);
      const res = await fetch(`/api/movimentacoes?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setMovimentacoes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao buscar movimentacoes:", err);
    }
  }, [filtroTipo]);

  const fetchProdutos = useCallback(async () => {
    try {
      const res = await fetch("/api/produtos");
      if (!res.ok) return;
      const data = await res.json();
      setProdutos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao buscar produtos:", err);
    }
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchEstoque(), fetchProdutos()]);
      setLoading(false);
    }
    load();
  }, [fetchEstoque, fetchProdutos]);

  useEffect(() => {
    if (tab === "movimentacao") {
      fetchMovimentacoes();
    }
  }, [tab, fetchMovimentacoes]);

  // ── Derived data ──

  const frescos = estoque.filter((e) => e.tipoEstoque === "diario");
  const acumulados = estoque.filter((e) => e.tipoEstoque === "estoque");

  const produtosFrescos = produtos.filter((p) => p.tipoEstoque === "diario");
  const produtosAcumulados = produtos.filter(
    (p) => p.tipoEstoque === "estoque"
  );

  // ── Congelar preview ──

  const congelarProdutoFresco = produtosFrescos.find(
    (p) => p.id === Number(congelarForm.produtoFrescoId)
  );
  const congelarProdutoCongelado = produtosAcumulados.find(
    (p) => p.id === Number(congelarForm.produtoCongeladoId)
  );
  const congelarQtd = parseFloat(congelarForm.quantidadeKg) || 0;

  // ── Handlers ──

  async function handleCongelar(e: React.FormEvent) {
    e.preventDefault();
    if (!congelarForm.produtoFrescoId || !congelarForm.produtoCongeladoId || congelarQtd <= 0)
      return;
    setSaving(true);
    try {
      const res = await fetch("/api/congelamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produtoFrescoId: Number(congelarForm.produtoFrescoId),
          produtoCongeladoId: Number(congelarForm.produtoCongeladoId),
          quantidadeKg: congelarQtd,
          data: congelarForm.data,
          observacao: congelarForm.observacao || undefined,
        }),
      });
      if (res.ok) {
        setCongelarOpen(false);
        setCongelarForm({
          data: todayStr(),
          produtoFrescoId: "",
          quantidadeKg: "",
          produtoCongeladoId: "",
          observacao: "",
        });
        await fetchEstoque();
      }
    } catch (err) {
      console.error("Erro ao congelar:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleMovimentar(e: React.FormEvent) {
    e.preventDefault();
    if (!movimentarForm.produtoId || !movimentarForm.quantidade) return;
    setSaving(true);
    try {
      const res = await fetch("/api/movimentacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produtoId: Number(movimentarForm.produtoId),
          tipo: movimentarForm.tipo,
          quantidade: parseFloat(movimentarForm.quantidade),
          unidade: movimentarForm.unidade,
          motivo: movimentarForm.motivo || undefined,
          data: movimentarForm.data,
        }),
      });
      if (res.ok) {
        setMovimentarOpen(false);
        setMovimentarForm({
          data: todayStr(),
          tipo: "entrada",
          produtoId: "",
          quantidade: "",
          unidade: "un",
          motivo: "",
        });
        await fetchEstoque();
        if (tab === "movimentacao") await fetchMovimentacoes();
      }
    } catch (err) {
      console.error("Erro ao movimentar:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleEntrada(e: React.FormEvent) {
    e.preventDefault();
    if (!entradaProduto || !entradaForm.quantidade) return;
    setSaving(true);
    try {
      const res = await fetch("/api/movimentacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produtoId: entradaProduto.produtoId,
          tipo: "entrada",
          quantidade: parseFloat(entradaForm.quantidade),
          unidade: "un",
          motivo: entradaForm.motivo,
          data: entradaForm.data,
        }),
      });
      if (res.ok) {
        setEntradaOpen(false);
        setEntradaProduto(null);
        setEntradaForm({
          data: todayStr(),
          quantidade: "",
          motivo: "Lote produzido",
          observacao: "",
        });
        await fetchEstoque();
        if (tab === "movimentacao") await fetchMovimentacoes();
      }
    } catch (err) {
      console.error("Erro ao registrar entrada:", err);
    } finally {
      setSaving(false);
    }
  }

  function openEditMov(mov: MovimentacaoEstoque) {
    setEditMovId(mov.id);
    setEditMovForm({
      quantidade: String(Math.abs(mov.quantidade)),
      motivo: mov.motivo || "",
      data: mov.data,
    });
    setEditMovOpen(true);
  }

  async function handleEditMov(e: React.FormEvent) {
    e.preventDefault();
    if (!editMovId) return;
    try {
      setSaving(true);
      const mov = movimentacoes.find(m => m.id === editMovId);
      if (!mov) return;
      const isNegative = ["pedido", "consumo", "descarte"].includes(mov.tipo);
      const qty = parseFloat(editMovForm.quantidade) || 0;
      const finalQty = isNegative ? -qty : qty;

      await fetch(`/api/movimentacoes/${editMovId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantidade: finalQty,
          motivo: editMovForm.motivo,
          data: editMovForm.data,
        }),
      });
      setEditMovOpen(false);
      setEditMovId(null);
      await Promise.all([fetchEstoque(), fetchMovimentacoes()]);
    } catch (error) {
      console.error("Erro ao editar movimentação:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMov(id: number) {
    if (!confirm("Excluir esta movimentação? O estoque será revertido.")) return;
    try {
      await fetch(`/api/movimentacoes/${id}`, { method: "DELETE" });
      await Promise.all([fetchEstoque(), fetchMovimentacoes()]);
    } catch (error) {
      console.error("Erro ao excluir movimentação:", error);
    }
  }

  function openEntrada(item: EstoqueDia) {
    setEntradaProduto(item);
    setEntradaForm({
      data: todayStr(),
      quantidade: "",
      motivo: "Lote produzido",
      observacao: "",
    });
    setEntradaOpen(true);
  }

  // ── Placeholders por tipo ──

  function motivoPlaceholder(tipo: string): string {
    switch (tipo) {
      case "entrada":
        return "Ex: Lote produzido, compra...";
      case "consumo":
        return "Ex: Uso interno, degustacao...";
      case "descarte":
        return "Ex: Produto vencido, danificado...";
      case "ajuste":
        return "Ex: Correcao de inventario...";
      default:
        return "Observação";
    }
  }

  // ── Render ──

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Estoque</h1>
          <p className="text-sm text-muted-foreground">
            Posição atual de todos os produtos
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-orange-500/30 text-orange-500 hover:bg-orange-500/10"
            onClick={() => {
              setCongelarForm({
                data: todayStr(),
                produtoFrescoId: "",
                quantidadeKg: "",
                produtoCongeladoId: "",
                observacao: "",
              });
              setCongelarOpen(true);
            }}
          >
            <Snowflake className="size-4 mr-1.5" />
            Congelar
          </Button>
          <Button
            onClick={() => {
              setMovimentarForm({
                data: todayStr(),
                tipo: "entrada",
                produtoId: "",
                quantidade: "",
                unidade: "un",
                motivo: "",
              });
              setMovimentarOpen(true);
            }}
          >
            <Plus className="size-4 mr-1.5" />
            Movimentar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <TabsNav items={TABS} value={tab} onChange={setTab} />

      {/* Tab: Estoque */}
      {tab === "estoque" && (
        <Card>
          <CardHeader>
            <CardTitle>Todos os produtos</CardTitle>
            <CardDescription>Posição atual</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableSkeleton rows={6} cols={7} />
            ) : estoque.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Nenhum produto cadastrado"
                description="Cadastre produtos para controlar o estoque."
              />
            ) : (
              <div className="overflow-x-auto -mx-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Tipo
                      </TableHead>
                      <TableHead className="text-right">
                        Estoque atual
                      </TableHead>
                      <TableHead className="hidden md:table-cell text-right">
                        Mínimo
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Cobertura
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[1%]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Frescos section */}
                    {frescos.length > 0 && (
                      <>
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="bg-muted/30 py-1.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                          >
                            Frescos — saldo de hoje
                          </TableCell>
                        </TableRow>
                        {frescos.map((item) => {
                          const st = statusFresco(item.disponivel);
                          return (
                            <TableRow key={item.produtoId}>
                              <TableCell className="font-medium">
                                {item.nome}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <Badge
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  fresco
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {item.disponivel.toFixed(1)} kg
                                <span className="block text-[10px] text-muted-foreground">
                                  {(item.colhidoHoje ?? 0).toFixed(1)} colhido
                                  {" - "}
                                  {(item.vendidoHoje ?? 0).toFixed(1)} vendido
                                </span>
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-right text-muted-foreground">
                                —
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                                Ciclo diário
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${st.cls}`}
                                >
                                  {st.label}
                                </span>
                              </TableCell>
                              <TableCell />
                            </TableRow>
                          );
                        })}
                      </>
                    )}

                    {/* Acumulados section */}
                    {acumulados.length > 0 && (
                      <>
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="bg-muted/30 py-1.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                          >
                            Acumulados
                          </TableCell>
                        </TableRow>
                        {acumulados.map((item) => {
                          const atual = item.estoqueAtual ?? 0;
                          const minimo = item.estoqueMinimo ?? 0;
                          const pct =
                            minimo > 0
                              ? Math.round((atual / minimo) * 100)
                              : 100;
                          const st = statusAcumulado(atual, minimo);
                          return (
                            <TableRow key={item.produtoId}>
                              <TableCell className="font-medium">
                                {item.nome}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <span className="inline-flex items-center rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-500">
                                  acumulado
                                </span>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {atual} {item.unidadeVenda}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-right tabular-nums">
                                {minimo > 0 ? minimo : "—"}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                {minimo > 0 ? (
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all ${progressColor(pct)}`}
                                        style={{
                                          width: `${Math.min(pct, 100)}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs tabular-nums text-muted-foreground">
                                      {Math.min(pct, 100)}%
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${st.cls}`}
                                >
                                  {st.label}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  className="text-primary"
                                  onClick={() => openEntrada(item)}
                                >
                                  <Plus className="size-3 mr-1" />
                                  Entrada
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Movimentação */}
      {tab === "movimentacao" && (
        <Card>
          <CardHeader>
            <CardTitle>Historico de movimentacoes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filter chips */}
            <div className="flex flex-wrap gap-1.5">
              {FILTROS_TIPO.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFiltroTipo(f.key)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    filtroTipo === f.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {loading ? (
              <TableSkeleton rows={8} cols={8} />
            ) : movimentacoes.length === 0 ? (
              <EmptyState
                icon={ArrowRightLeft}
                title="Nenhuma movimentacao encontrada"
                description="Registre movimentacoes para acompanhar o historico."
              />
            ) : (
              <div className="overflow-x-auto -mx-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Lote
                      </TableHead>
                      <TableHead className="hidden md:table-cell text-right">
                        Saldo ini.
                      </TableHead>
                      <TableHead className="text-right">
                        Movimentação
                      </TableHead>
                      <TableHead className="hidden md:table-cell text-right">
                        Saldo fin.
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Observação
                      </TableHead>
                      <TableHead className="w-[1%]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimentacoes.map((mov) => {
                      const config =
                        TIPO_MOVIMENTACAO_CONFIG[
                          mov.tipo as TipoMovimentacao
                        ] ?? {
                          label: mov.tipo,
                          badgeClass:
                            "bg-muted text-muted-foreground border-border",
                        };
                      const isNegative = [
                        "pedido",
                        "consumo",
                        "descarte",
                        "congelamento",
                      ].includes(mov.tipo);
                      return (
                        <TableRow key={mov.id}>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {formatDate(mov.data)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {mov.produto?.nome ?? `#${mov.produtoId}`}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${config.badgeClass}`}
                            >
                              {config.label}
                            </span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {mov.lote ? (
                              <span className="inline-flex items-center rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 font-mono text-[10px] text-blue-500">
                                {mov.lote}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-right tabular-nums">
                            {mov.saldoInicial}
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums font-medium ${
                              isNegative ? "text-red-500" : "text-green-500"
                            }`}
                          >
                            {isNegative ? "-" : "+"}
                            {mov.quantidade} {mov.unidade}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-right tabular-nums">
                            {mov.saldoFinal}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground text-xs max-w-[200px] truncate">
                            {mov.motivo || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon-sm" title="Editar" onClick={() => openEditMov(mov)}>
                                <Pencil className="size-3.5 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon-sm" title="Excluir" onClick={() => handleDeleteMov(mov.id)}>
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Modal: Congelar ── */}
      <Dialog open={congelarOpen} onOpenChange={setCongelarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Congelar produto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCongelar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cong-data">Data</Label>
              <Input
                id="cong-data"
                type="date"
                value={congelarForm.data}
                onChange={(e) =>
                  setCongelarForm({ ...congelarForm, data: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cong-fresco">Classe do fresco</Label>
              <select
                id="cong-fresco"
                value={congelarForm.produtoFrescoId}
                onChange={(e) =>
                  setCongelarForm({
                    ...congelarForm,
                    produtoFrescoId: e.target.value,
                  })
                }
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                required
              >
                <option value="">Selecione o produto fresco</option>
                {produtosFrescos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cong-qtd">Quantidade (kg)</Label>
              <Input
                id="cong-qtd"
                type="number"
                step="0.1"
                min="0.1"
                placeholder="Ex: 2.5"
                value={congelarForm.quantidadeKg}
                onChange={(e) =>
                  setCongelarForm({
                    ...congelarForm,
                    quantidadeKg: e.target.value,
                  })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cong-congelado">Produto congelado</Label>
              <select
                id="cong-congelado"
                value={congelarForm.produtoCongeladoId}
                onChange={(e) =>
                  setCongelarForm({
                    ...congelarForm,
                    produtoCongeladoId: e.target.value,
                  })
                }
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                required
              >
                <option value="">Selecione o produto congelado</option>
                {produtosAcumulados.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cong-obs">Observação (opcional)</Label>
              <Input
                id="cong-obs"
                value={congelarForm.observacao}
                onChange={(e) =>
                  setCongelarForm({
                    ...congelarForm,
                    observacao: e.target.value,
                  })
                }
                placeholder="Ex: Morango maduro demais"
              />
            </div>

            {/* Preview */}
            {congelarProdutoFresco &&
              congelarProdutoCongelado &&
              congelarQtd > 0 && (
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-1.5">
                  <p className="text-xs font-medium text-blue-400">
                    Pre-visualizacao
                  </p>
                  <div className="space-y-1 text-xs">
                    <p className="text-red-400">
                      Saida: -{congelarQtd.toFixed(1)} kg de{" "}
                      {congelarProdutoFresco.nome}
                    </p>
                    <p className="text-green-400">
                      Entrada: +{congelarQtd.toFixed(1)} un de{" "}
                      {congelarProdutoCongelado.nome}
                    </p>
                    <p className="text-muted-foreground">
                      {congelarProdutoFresco.nome} ({congelarQtd.toFixed(1)} kg){" "}
                      → {congelarProdutoCongelado.nome}
                    </p>
                  </div>
                </div>
              )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCongelarOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {saving ? "Salvando..." : "Congelar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Movimentar ── */}
      <Dialog open={movimentarOpen} onOpenChange={setMovimentarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova movimentacao</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMovimentar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mov-data">Data</Label>
              <Input
                id="mov-data"
                type="date"
                value={movimentarForm.data}
                onChange={(e) =>
                  setMovimentarForm({
                    ...movimentarForm,
                    data: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mov-tipo">Tipo</Label>
              <select
                id="mov-tipo"
                value={movimentarForm.tipo}
                onChange={(e) =>
                  setMovimentarForm({
                    ...movimentarForm,
                    tipo: e.target.value,
                  })
                }
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="entrada">Entrada</option>
                <option value="consumo">Consumo</option>
                <option value="descarte">Descarte</option>
                <option value="ajuste">Ajuste</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mov-produto">Produto</Label>
              <select
                id="mov-produto"
                value={movimentarForm.produtoId}
                onChange={(e) =>
                  setMovimentarForm({
                    ...movimentarForm,
                    produtoId: e.target.value,
                  })
                }
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                required
              >
                <option value="">Selecione um produto</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="mov-qtd">Quantidade</Label>
                <Input
                  id="mov-qtd"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={movimentarForm.quantidade}
                  onChange={(e) =>
                    setMovimentarForm({
                      ...movimentarForm,
                      quantidade: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mov-unidade">Unidade</Label>
                <select
                  id="mov-unidade"
                  value={movimentarForm.unidade}
                  onChange={(e) =>
                    setMovimentarForm({
                      ...movimentarForm,
                      unidade: e.target.value,
                    })
                  }
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="un">un</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mov-motivo">Observação</Label>
              <Input
                id="mov-motivo"
                value={movimentarForm.motivo}
                onChange={(e) =>
                  setMovimentarForm({
                    ...movimentarForm,
                    motivo: e.target.value,
                  })
                }
                placeholder={motivoPlaceholder(movimentarForm.tipo)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMovimentarOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Entrada rapida ── */}
      <Dialog open={entradaOpen} onOpenChange={setEntradaOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Entrada — {entradaProduto?.nome ?? "Produto"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEntrada} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ent-data">Data</Label>
              <Input
                id="ent-data"
                type="date"
                value={entradaForm.data}
                onChange={(e) =>
                  setEntradaForm({ ...entradaForm, data: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ent-qtd">Quantidade (un)</Label>
              <Input
                id="ent-qtd"
                type="number"
                step="1"
                min="1"
                value={entradaForm.quantidade}
                onChange={(e) =>
                  setEntradaForm({
                    ...entradaForm,
                    quantidade: e.target.value,
                  })
                }
                placeholder="Ex: 50"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ent-motivo">Motivo</Label>
              <select
                id="ent-motivo"
                value={entradaForm.motivo}
                onChange={(e) =>
                  setEntradaForm({ ...entradaForm, motivo: e.target.value })
                }
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="Lote produzido">Lote produzido</option>
                <option value="Compra">Compra</option>
                <option value="Ajuste">Ajuste</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ent-obs">Observação (opcional)</Label>
              <Input
                id="ent-obs"
                value={entradaForm.observacao}
                onChange={(e) =>
                  setEntradaForm({
                    ...entradaForm,
                    observacao: e.target.value,
                  })
                }
                placeholder="Detalhes adicionais..."
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEntradaOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Registrar entrada"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Editar Movimentação ── */}
      <Dialog open={editMovOpen} onOpenChange={setEditMovOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Movimentação</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditMov} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-mov-data">Data</Label>
              <Input
                id="edit-mov-data"
                type="date"
                value={editMovForm.data}
                onChange={(e) => setEditMovForm({ ...editMovForm, data: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-mov-qty">Quantidade</Label>
              <Input
                id="edit-mov-qty"
                type="number"
                step="0.1"
                min="0"
                value={editMovForm.quantidade}
                onChange={(e) => setEditMovForm({ ...editMovForm, quantidade: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-mov-motivo">Observação</Label>
              <Input
                id="edit-mov-motivo"
                value={editMovForm.motivo}
                onChange={(e) => setEditMovForm({ ...editMovForm, motivo: e.target.value })}
                placeholder="Motivo da movimentação..."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditMovOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
