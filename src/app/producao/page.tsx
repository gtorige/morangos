"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardAction,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Sprout,
  Save,
  Loader2,
  Check,
  MessageSquare,
  Package,
  Truck,
  CalendarDays,
  AlertCircle,
} from "lucide-react";
import { todayStr, formatDate, addDays } from "@/lib/formatting";
// classe agora vem do campo produto.classe (não mais extraído do nome)
import type { Produto, Colheita, Pedido } from "@/lib/types";

// ── Types ──

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

interface RowState {
  classe: string; // "A", "B", "C"
  produtoIds: number[]; // all product IDs in this class
  representanteId: number; // first product ID (used for colheita registration)
  quantidade: string; // controlled input (kg)
  observacao: string;
  showNote: boolean;
  hadColheita: boolean; // true if colheita existed when loaded
}

interface DemandItem {
  produtoNome: string;
  classe: string | null;
  quantidadeUnidades: number;
  quantidadeKg: number | null;
  pesoUnitarioGramas: number | null;
}

// ── Helpers ──

const WEEKDAYS_PT: Record<number, string> = {
  0: "Domingo",
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
};

function weekdayName(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return WEEKDAYS_PT[d.getDay()] ?? "";
}

function fmtKg(value: number): string {
  return `${value.toFixed(1).replace(".", ",")} kg`;
}

function calcNecessarioClasse(
  pedidos: Pedido[],
  produtoIds: number[],
  produtosMap: Map<number, Produto>
): number {
  let totalKg = 0;
  const idsSet = new Set(produtoIds);
  for (const pedido of pedidos) {
    if (pedido.statusEntrega === "Cancelado" || pedido.statusEntrega === "Entregue") continue;
    for (const item of pedido.itens) {
      if (idsSet.has(item.produtoId)) {
        const prod = produtosMap.get(item.produtoId);
        const pesoG = prod?.pesoUnitarioGramas;
        totalKg += pesoG ? (item.quantidade * pesoG) / 1000 : item.quantidade;
      }
    }
  }
  return totalKg;
}

function buildDemandFromPedidos(pedidos: Pedido[], produtos: Produto[]): DemandItem[] {
  const map = new Map<number, { unidades: number; produto: Produto }>();
  for (const pedido of pedidos) {
    if (pedido.statusEntrega === "Cancelado" || pedido.statusEntrega === "Entregue") continue;
    for (const item of pedido.itens) {
      const entry = map.get(item.produtoId);
      if (entry) {
        entry.unidades += item.quantidade;
      } else {
        const produto = produtos.find((p) => p.id === item.produtoId) ?? item.produto;
        map.set(item.produtoId, { unidades: item.quantidade, produto });
      }
    }
  }

  const items: DemandItem[] = [];
  for (const [, { unidades, produto }] of map) {
    const kg =
      produto.pesoUnitarioGramas != null
        ? unidades * (produto.pesoUnitarioGramas / 1000)
        : null;
    items.push({
      produtoNome: produto.nome,
      classe: produto.classe || null,
      quantidadeUnidades: unidades,
      quantidadeKg: kg,
      pesoUnitarioGramas: produto.pesoUnitarioGramas,
    });
  }

  // Sort by class then name
  items.sort((a, b) => {
    const ca = a.classe ?? "Z";
    const cb = b.classe ?? "Z";
    if (ca !== cb) return ca.localeCompare(cb);
    return a.produtoNome.localeCompare(b.produtoNome);
  });

  return items;
}

// ── Component ──

export default function ProducaoPage() {
  const hoje = todayStr();

  // Data state
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [colheitas, setColheitas] = useState<Colheita[]>([]);
  const [pedidosHoje, setPedidosHoje] = useState<Pedido[]>([]);
  const [pedidosProxima, setPedidosProxima] = useState<Pedido[]>([]);
  const [proximaData, setProximaData] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [rows, setRows] = useState<RowState[]>([]);
  const [saving, setSaving] = useState(false);

  // Refs for tab navigation
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);

  // Filter daily products
  const produtosDiarios = useMemo(
    () => produtos.filter((p) => p.tipoEstoque === "diario"),
    [produtos]
  );

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, colRes, pedHojeRes] = await Promise.all([
        fetch("/api/produtos"),
        fetch(`/api/colheita?data=${hoje}`),
        fetch(`/api/pedidos?dataInicio=${hoje}&dataFim=${hoje}`),
      ]);

      if (!prodRes.ok) throw new Error("Erro ao carregar produtos");
      if (!colRes.ok) throw new Error("Erro ao carregar colheitas");
      if (!pedHojeRes.ok) throw new Error("Erro ao carregar pedidos de hoje");

      const prodData: Produto[] = await prodRes.json();
      const colData: Colheita[] = await colRes.json();
      const pedHojeData: Pedido[] = await pedHojeRes.json();

      setProdutos(prodData);
      setColheitas(colData);
      setPedidosHoje(pedHojeData);

      // Init rows grouped by classe
      const diarios = prodData.filter((p) => p.tipoEstoque === "diario" && p.classe);
      const classeMap = new Map<string, Produto[]>();
      for (const p of diarios) {
        const cls = p.classe!;
        classeMap.set(cls, [...(classeMap.get(cls) || []), p]);
      }
      const rowStates: RowState[] = [...classeMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cls, prods]) => {
          const repId = prods[0].id;
          // Sum colheitas for all products in this class
          const classColheitas = colData.filter((c) => prods.some((p) => p.id === c.produtoId));
          const totalColhido = classColheitas.reduce((s, c) => s + c.quantidade, 0);
          const firstObs = classColheitas.find((c) => c.observacao)?.observacao ?? "";
          return {
            classe: cls,
            produtoIds: prods.map((p) => p.id),
            representanteId: repId,
            quantidade: totalColhido > 0 ? String(totalColhido) : "",
            observacao: firstObs,
            showNote: false,
            hadColheita: classColheitas.length > 0,
          };
        });
      setRows(rowStates);
      setSaveStatus("idle");

      // Fetch next delivery date (try next 7 days)
      await fetchProximaEntrega(prodData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [hoje]);

  const fetchProximaEntrega = async (prodData: Produto[]) => {
    // Try next 7 days to find the next date with orders
    for (let i = 1; i <= 7; i++) {
      const data = addDays(hoje, i);
      try {
        const res = await fetch(`/api/pedidos?dataInicio=${data}&dataFim=${data}`);
        if (!res.ok) continue;
        const pedidos: Pedido[] = await res.json();
        const active = pedidos.filter((p) => p.statusEntrega !== "Cancelado");
        if (active.length > 0) {
          setPedidosProxima(active);
          setProximaData(data);
          return;
        }
      } catch {
        // continue searching
      }
    }
    setPedidosProxima([]);
    setProximaData(null);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Row handlers ──

  const updateRow = (index: number, field: keyof RowState, value: string | boolean) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    if (field === "quantidade" || field === "observacao") {
      setSaveStatus("dirty");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      const nextIndex = index + 1;
      if (nextIndex < inputRefs.current.length) {
        inputRefs.current[nextIndex]?.focus();
      } else {
        saveButtonRef.current?.focus();
      }
    }
  };

  // ── Save ──

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("saving");
    try {
      // Envia TODOS os rows (inclusive qty=0 para deletar colheita existente)
      const promises = rows
        .map((r) => {
          const qty = parseFloat(r.quantidade);
          return { ...r, qty: isNaN(qty) ? 0 : qty };
        })
        .filter((r) => r.qty > 0 || r.hadColheita)
        .map((r) =>
          fetch("/api/colheita", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              produtoId: r.representanteId,
              quantidade: r.qty,
              data: hoje,
              observacao: r.observacao || null,
            }),
          })
        );

      const results = await Promise.all(promises);
      const allOk = results.every((r) => r.ok);
      if (!allOk) {
        throw new Error("Erro ao salvar algumas colheitas");
      }

      setSaveStatus("saved");
      // Refresh colheita data
      const colRes = await fetch(`/api/colheita?data=${hoje}`);
      if (colRes.ok) {
        setColheitas(await colRes.json());
      }
    } catch (err) {
      setSaveStatus("error");
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  // ── Computed values ──

  const totalColhido = useMemo(() => {
    return rows.reduce((sum, r) => {
      const qty = parseFloat(r.quantidade);
      return sum + (isNaN(qty) ? 0 : qty);
    }, 0);
  }, [rows]);

  const demandaHoje = useMemo(
    () => buildDemandFromPedidos(pedidosHoje, produtos),
    [pedidosHoje, produtos]
  );

  const demandaProxima = useMemo(
    () => buildDemandFromPedidos(pedidosProxima, produtos),
    [pedidosProxima, produtos]
  );

  // ── Render helpers ──

  function renderSaveStatusBadge() {
    switch (saveStatus) {
      case "dirty":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
            Alterado · não salvo
          </Badge>
        );
      case "saving":
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <Loader2 className="size-3 animate-spin mr-1" />
            Salvando...
          </Badge>
        );
      case "saved":
        return (
          <Badge className="bg-green-500/10 text-green-500 border border-green-500/20">
            <Check className="size-3 mr-1" />
            Salvo
          </Badge>
        );
      case "error":
        return (
          <Badge className="bg-red-500/10 text-red-500 border border-red-500/20">
            <AlertCircle className="size-3 mr-1" />
            Erro ao salvar
          </Badge>
        );
      default:
        return null;
    }
  }

  function renderStatus(colhido: number, necessarioKg: number | null) {
    if (colhido === 0 && (necessarioKg === null || necessarioKg === 0)) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-muted-foreground/40" />
          Não informado
        </span>
      );
    }

    if (necessarioKg === null || necessarioKg === 0) {
      if (colhido > 0) {
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-green-500">
            <span className="size-2 rounded-full bg-green-500" />
            Suficiente
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-muted-foreground/40" />
          Não informado
        </span>
      );
    }

    const saldo = colhido - necessarioKg;

    if (saldo > 0) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-green-500">
          <span className="size-2 rounded-full bg-green-500" />
          Suficiente
        </span>
      );
    }
    if (saldo === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-yellow-500">
          <span className="size-2 rounded-full bg-yellow-500" />
          Exato
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-500">
        <span className="size-2 rounded-full bg-red-500" />
        Faltam {fmtKg(Math.abs(saldo))}
      </span>
    );
  }

  function renderSaldo(colhido: number, necessarioKg: number | null) {
    if (necessarioKg === null || necessarioKg === 0) {
      if (colhido === 0) {
        return <span className="text-muted-foreground">&mdash;</span>;
      }
      return <span className="text-green-500">+{fmtKg(colhido)}</span>;
    }
    const saldo = colhido - necessarioKg;
    if (saldo > 0) return <span className="text-green-500">+{fmtKg(saldo)}</span>;
    if (saldo < 0) return <span className="text-red-500">{fmtKg(saldo)}</span>;
    return <span className="text-muted-foreground">0,0 kg</span>;
  }

  function renderDemandCard(
    title: string,
    subtitle: string,
    items: DemandItem[],
    icon: React.ReactNode
  ) {
    // Group by class
    const grouped = new Map<string, DemandItem[]>();
    for (const item of items) {
      const key = item.classe ?? "Outros";
      const list = grouped.get(key) ?? [];
      list.push(item);
      grouped.set(key, list);
    }

    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum pedido
            </p>
          ) : (
            <div className="space-y-3">
              {Array.from(grouped.entries()).map(([classe, groupItems]) => (
                <div key={classe}>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    {classe === "Outros" ? "Outros produtos" : `Classe ${classe}`}
                  </p>
                  <div className="space-y-1">
                    {groupItems.map((item) => (
                      <div
                        key={item.produtoNome}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="truncate">{item.produtoNome}</span>
                        <span className="font-medium tabular-nums ml-2 shrink-0">
                          {item.quantidadeKg != null
                            ? fmtKg(item.quantidadeKg)
                            : `${item.quantidadeUnidades} un`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Main render ──

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produção do Dia</h1>
          <p className="text-sm text-muted-foreground mt-1">Carregando...</p>
        </div>
        <Card>
          <CardContent className="pt-4">
            <TableSkeleton rows={4} cols={5} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && produtos.length === 0) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produção do Dia</h1>
        </div>
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={AlertCircle}
              title="Erro ao carregar dados"
              description={error}
              actionLabel="Tentar novamente"
              onAction={fetchData}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const weekday = weekdayName(hoje);
  const dateDisplay = formatDate(hoje);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Produção do Dia</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {weekday}, {dateDisplay} &mdash; Digite os kg colhidos e salve
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Main harvest card */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Sprout className="size-5 text-green-500" />
            Colheita de hoje &mdash; frescos
          </CardTitle>
          <CardAction>{renderSaveStatusBadge()}</CardAction>
        </CardHeader>

        <CardContent className="p-0">
          {produtosDiarios.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={Package}
                title="Nenhum produto diário cadastrado"
                description="Cadastre produtos com tipo de estoque 'diário' para registrar colheitas"
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">
                    Necessário
                  </TableHead>
                  <TableHead className="text-right">Colhido (kg)</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">
                    Saldo
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => {
                  const produtosMap = new Map(produtos.map(p => [p.id, p]));
                  const necessarioKg = calcNecessarioClasse(
                    pedidosHoje,
                    row.produtoIds,
                    produtosMap
                  );
                  const colhido = parseFloat(row.quantidade) || 0;
                  const saldo = colhido - necessarioKg;
                  const inputBorderClass =
                    colhido > 0
                      ? saldo >= 0
                        ? "border-green-500/40 focus:border-green-500"
                        : "border-red-500/40 focus:border-red-500"
                      : "";

                  return (
                    <TableRow key={row.classe}>
                      {/* Class name */}
                      <TableCell>
                        <div>
                          <p className="font-medium">Morango Classe {row.classe}</p>
                          <p className="text-xs text-muted-foreground">
                            fresco · ciclo diário
                          </p>
                        </div>
                      </TableCell>

                      {/* Necessario */}
                      <TableCell className="hidden sm:table-cell text-right tabular-nums">
                        {fmtKg(necessarioKg)}
                      </TableCell>

                      {/* Colhido input */}
                      <TableCell className="text-right">
                        <Input
                          ref={(el) => {
                            inputRefs.current[index] = el;
                          }}
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="0,0"
                          value={row.quantidade}
                          onChange={(e) =>
                            updateRow(index, "quantidade", e.target.value)
                          }
                          onKeyDown={(e) => handleKeyDown(e, index)}
                          className={`w-24 text-right tabular-nums ml-auto ${inputBorderClass}`}
                        />
                      </TableCell>

                      {/* Saldo */}
                      <TableCell className="hidden sm:table-cell text-right tabular-nums">
                        {renderSaldo(colhido, necessarioKg > 0 ? necessarioKg : null)}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="hidden md:table-cell">
                        {renderStatus(colhido, necessarioKg > 0 ? necessarioKg : null)}
                      </TableCell>

                      {/* Note toggle */}
                      <TableCell>
                        <button
                          type="button"
                          onClick={() =>
                            updateRow(index, "showNote", !row.showNote)
                          }
                          className={`p-1 rounded hover:bg-muted transition-colors ${
                            row.observacao
                              ? "text-blue-500"
                              : "text-muted-foreground"
                          }`}
                          title="Observação"
                        >
                          <MessageSquare className="size-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* Observation rows (rendered separately to maintain table structure) */}
                {/* We render them inline by re-mapping and inserting conditionally */}
              </TableBody>

              {/* Render observation inputs in a flat list after each product row */}
              {/* Since we can't nest rows conditionally inside map easily,
                  we use a different approach: render product + note row pairs */}

              <TableFooter>
                <TableRow>
                  <TableCell className="font-medium">Total colhido</TableCell>
                  <TableCell className="hidden sm:table-cell" />
                  <TableCell className="text-right font-medium tabular-nums">
                    {fmtKg(totalColhido)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell" />
                  <TableCell className="hidden md:table-cell" />
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>

        {/* Observation rows displayed below the table when expanded */}
        {rows.some((r) => r.showNote) && (
          <CardContent className="border-t space-y-2 pt-4">
            {rows.map((row, index) => {
              if (!row.showNote) return null;
              return (
                <div key={row.classe} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-40 shrink-0 truncate">
                    Morango Classe {row.classe}
                  </span>
                  <Input
                    placeholder="Observação..."
                    value={row.observacao}
                    onChange={(e) =>
                      updateRow(index, "observacao", e.target.value)
                    }
                    className="text-sm"
                  />
                </div>
              );
            })}
          </CardContent>
        )}

        {rows.length > 0 && (
          <CardFooter className="justify-end gap-3">
            <Button
              ref={saveButtonRef}
              onClick={handleSave}
              disabled={saving || saveStatus === "idle"}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="size-4 mr-2" />
                  Registrar colheita
                </>
              )}
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Demand section */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Demanda por entrega</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderDemandCard(
            "Hoje",
            `${weekday}, ${dateDisplay}`,
            demandaHoje,
            <CalendarDays className="size-4 text-blue-500" />
          )}

          {renderDemandCard(
            proximaData ? "Próxima" : "Próxima",
            proximaData
              ? `${weekdayName(proximaData)}, ${formatDate(proximaData)}`
              : "Nenhuma entrega nos próximos 7 dias",
            demandaProxima,
            <Truck className="size-4 text-orange-500" />
          )}
        </div>
      </div>
    </div>
  );
}
