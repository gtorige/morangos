"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { ClipboardCheck, Package, Users, Printer, PackageOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatCurrency as fmt, todayStr as todayString } from "@/lib/formatting";
import { FluxoBanner } from "@/components/fluxo-banner";
import type { EstoqueDia } from "@/lib/types";

interface ProdutoResumo {
  produtoId: number;
  nome: string;
  quantidadeTotal: number;
}

interface DetalheItem {
  produto: string;
  quantidade: number;
}

interface Detalhe {
  pedidoId: number;
  cliente: string;
  bairro: string;
  dataEntrega: string;
  statusEntrega: string;
  total?: number;
  itens: DetalheItem[];
}

interface Separacao {
  data: string;
  dataFim?: string;
  totalPedidos: number;
  produtos: ProdutoResumo[];
  detalhes: Detalhe[];
}

function weekRange(): { inicio: string; fim: string } {
  const d = new Date();
  const dow = d.getDay();
  const diffMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diffMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return {
    inicio: mon.toISOString().slice(0, 10),
    fim: sun.toISOString().slice(0, 10),
  };
}

function statusDisponivel(necessario: number, disponivel: number) {
  const diff = disponivel - necessario;
  if (diff > 0) return { label: `+${diff} sobra`, cls: "text-green-500", dot: "bg-green-500" };
  if (diff === 0) return { label: "Exato", cls: "text-yellow-500", dot: "bg-yellow-500" };
  return { label: `${diff} falta`, cls: "text-red-500", dot: "bg-red-500" };
}

export default function SeparacaoPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"dia" | "semana">("dia");
  const [data, setData] = useState(todayString());
  const [separacao, setSeparacao] = useState<Separacao | null>(null);
  const [estoque, setEstoque] = useState<EstoqueDia[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSeparacao();
    fetchEstoque();
    setCheckedItems(new Set());
  }, [data, modo]);

  async function fetchSeparacao() {
    try {
      setLoading(true);
      let url: string;
      if (modo === "semana") {
        const { inicio, fim } = weekRange();
        url = `/api/separacao?dataInicio=${inicio}&dataFim=${fim}`;
      } else {
        url = `/api/separacao?data=${data}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      setSeparacao(json);
    } catch (error) {
      console.error("Erro ao buscar separação:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchEstoque() {
    try {
      const res = await fetch(`/api/estoque/dia?data=${data}`);
      if (res.ok) setEstoque(await res.json());
    } catch {}
  }

  function toggleCheck(key: string) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handlePrint() { window.print(); }

  const totalItens = separacao?.produtos.reduce((acc, p) => acc + p.quantidadeTotal, 0) || 0;
  const totalProdutos = separacao?.produtos.length || 0;
  const checkedProdutos = separacao?.produtos.filter(p => checkedItems.has(`prod-${p.produtoId}`)).length || 0;
  const allChecked = totalProdutos > 0 && checkedProdutos === totalProdutos;

  // Map estoque by produtoId for quick lookup
  const estoqueMap = new Map(estoque.map(e => [e.produtoId, e]));

  return (
    <div className="space-y-6">
      <FluxoBanner stepAtual="separacao" />
      <div className="flex items-center justify-between print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-5" />
            <h1 className="text-2xl font-semibold">Separação</h1>
          </div>
          {separacao && <p className="text-xs text-muted-foreground mt-1">{formatDate(data)} · {separacao.totalPedidos} pedidos</p>}
        </div>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="size-4 mr-2" />
          Imprimir
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setModo("dia")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${modo === "dia" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Hoje
          </button>
          <button
            onClick={() => setModo("semana")}
            className={`px-3 py-1.5 text-xs font-medium border-l border-border transition-colors ${modo === "semana" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Semana
          </button>
        </div>
        {modo === "dia" && (
          <div className="space-y-1">
            <Label htmlFor="data" className="text-xs">Data de Entrega</Label>
            <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-40 h-8 text-sm" />
          </div>
        )}
        {modo === "semana" && (() => {
          const { inicio, fim } = weekRange();
          return <span className="text-sm text-muted-foreground">{formatDate(inicio)} – {formatDate(fim)}</span>;
        })()}
      </div>

      {/* Print header */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-xl font-bold">
          Lista de Separação - {modo === "semana" ? (() => { const { inicio, fim } = weekRange(); return `${formatDate(inicio)} a ${formatDate(fim)}`; })() : data.split("-").reverse().join("/")}
        </h1>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : !separacao || separacao.totalPedidos === 0 ? (
        <EmptyState icon={PackageOpen} title="Nenhum pedido para esta data." />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:hidden">
            <Card className="border-l-4 border-l-indigo-500">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-indigo-400">
                  <Package className="size-4" />
                  Total de Itens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">{totalItens}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-purple-400">
                  <Users className="size-4" />
                  Pedidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">{separacao.totalPedidos}</p>
              </CardContent>
            </Card>
          </div>

          {/* Product totals - picking list with availability */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">O que carregar — por SKU com disponibilidade</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 print:hidden pl-4">✓</TableHead>
                    <TableHead>Produto / SKU</TableHead>
                    <TableHead className="text-right">Necessário</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Disponível</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {separacao.produtos.map((p) => {
                    const key = `prod-${p.produtoId}`;
                    const checked = checkedItems.has(key);
                    const est = estoqueMap.get(p.produtoId);
                    const disponivel = est?.disponivel ?? 0;
                    const st = statusDisponivel(p.quantidadeTotal, disponivel);
                    const isFresco = est?.tipoEstoque === "diario";
                    const pesoKg = est?.pesoUnitarioGramas ? (est.pesoUnitarioGramas / 1000).toFixed(1) : null;

                    return (
                      <TableRow
                        key={p.produtoId}
                        className={`cursor-pointer ${checked ? "bg-green-500/5 line-through opacity-50" : ""}`}
                        onClick={() => toggleCheck(key)}
                      >
                        <TableCell className="print:hidden pl-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCheck(key)}
                            className="size-4 accent-green-600 cursor-pointer"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{p.nome}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {isFresco ? "fresco" : "estoque"} · {pesoKg ? `${pesoKg} kg/un` : "un"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {p.quantidadeTotal} un
                        </TableCell>
                        <TableCell className={`text-right tabular-nums font-semibold hidden sm:table-cell ${st.cls}`}>
                          {disponivel} {isFresco ? "un" : "un"}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
                            <span className={`size-1.5 rounded-full ${st.dot}`} />
                            <span className={st.cls}>{st.label}</span>
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Separator />

          {/* Detail per client */}
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Detalhe por Cliente</h2>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 print:hidden pl-4">✓</TableHead>
                      {modo === "semana" && <TableHead className="w-24">Data</TableHead>}
                      <TableHead>Cliente</TableHead>
                      <TableHead className="hidden sm:table-cell">Bairro</TableHead>
                      <TableHead>Itens</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">Total</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {separacao.detalhes.map((d) => {
                      const key = `ped-${d.pedidoId}`;
                      const checked = checkedItems.has(key);
                      // Check if any item has stock issue
                      const hasStockIssue = d.itens.some(item => {
                        const prod = separacao.produtos.find(p => p.nome === item.produto);
                        if (!prod) return false;
                        const est = estoqueMap.get(prod.produtoId);
                        return est && est.disponivel < prod.quantidadeTotal;
                      });

                      return (
                        <TableRow
                          key={d.pedidoId}
                          className={`cursor-pointer transition-colors ${checked ? "opacity-50 line-through bg-green-500/5" : ""}`}
                          onClick={() => toggleCheck(key)}
                        >
                          <TableCell className="print:hidden pl-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCheck(key)}
                              className="size-4 accent-green-600 cursor-pointer"
                            />
                          </TableCell>
                          {modo === "semana" && <TableCell className="text-xs text-muted-foreground">{formatDate(d.dataEntrega)}</TableCell>}
                          <TableCell className="font-medium">{d.cliente}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{d.bairro || "—"}</TableCell>
                          <TableCell>
                            <div className="text-xs">
                              {d.itens.map((item, idx) => (
                                <span key={idx}>
                                  {item.produto} <span className="font-semibold">x{item.quantidade}</span>
                                  {idx < d.itens.length - 1 && " · "}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right hidden sm:table-cell tabular-nums font-medium">
                            {d.total ? fmt(d.total) : ""}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {hasStockIssue ? (
                              <span className="inline-flex items-center rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-500">Falta</span>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-500">OK</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Footer bar with progress + go to rota */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3 print:hidden">
            <div>
              <p className="text-sm text-muted-foreground">Progresso da separação</p>
              <p className={`text-sm font-semibold ${allChecked ? "text-green-500" : "text-foreground"}`}>
                {checkedProdutos} de {totalProdutos} produtos conferidos
              </p>
            </div>
            <Button
              onClick={() => router.push("/rota")}
              disabled={!allChecked}
              className={!allChecked ? "opacity-40" : ""}
            >
              Separação concluída — Ir para Rota
              <ArrowRight className="size-4 ml-1" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
