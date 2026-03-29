"use client";

import { useState, useEffect } from "react";
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
import { ClipboardCheck, Package, Users, Printer, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, todayStr as todayString } from "@/lib/formatting";

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

export default function SeparacaoPage() {
  const [modo, setModo] = useState<"dia" | "semana">("dia");
  const [data, setData] = useState(todayString());
  const [separacao, setSeparacao] = useState<Separacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSeparacao();
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

  function toggleCheck(key: string) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handlePrint() {
    window.print();
  }

  const totalItens =
    separacao?.produtos.reduce((acc, p) => acc + p.quantidadeTotal, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="size-5" />
          <h1 className="text-2xl font-semibold">Lista de Separação</h1>
        </div>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="size-4 mr-2" />
          Imprimir
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 print:hidden">
        {/* Mode toggle */}
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
            <Input
              id="data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-40 h-8 text-sm"
            />
          </div>
        )}
        {modo === "semana" && (() => {
          const { inicio, fim } = weekRange();
          return (
            <span className="text-sm text-muted-foreground">
              {formatDate(inicio)} – {formatDate(fim)}
            </span>
          );
        })()}
      </div>

      {/* Print header */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-xl font-bold">
          Lista de Separação -{" "}
          {modo === "semana" ? (() => { const { inicio, fim } = weekRange(); return `${formatDate(inicio)} a ${formatDate(fim)}`; })() : data.split("-").reverse().join("/")}
        </h1>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={3} />
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
                <p className="text-3xl font-bold text-foreground">
                  {totalItens}
                </p>
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
                <p className="text-3xl font-bold text-foreground">
                  {separacao.totalPedidos}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Product totals - main picking list */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Package className="size-5" />
              O que carregar
            </h2>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 print:hidden">OK</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {separacao.produtos.map((p) => {
                    const key = `prod-${p.produtoId}`;
                    const checked = checkedItems.has(key);
                    return (
                      <TableRow
                        key={p.produtoId}
                        className={
                          checked
                            ? "bg-green-50 dark:bg-green-950/30 line-through opacity-60"
                            : ""
                        }
                      >
                        <TableCell className="print:hidden">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCheck(key)}
                            className="size-5 accent-green-600 cursor-pointer"
                          />
                        </TableCell>
                        <TableCell className="font-semibold text-base">
                          {p.nome}
                        </TableCell>
                        <TableCell className="text-right text-xl font-bold">
                          {p.quantidadeTotal}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <Separator />

          {/* Detail per client */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="size-5" />
              Detalhe por Cliente
            </h2>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 print:hidden">OK</TableHead>
                    {modo === "semana" && <TableHead className="w-24">Data</TableHead>}
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden sm:table-cell">Bairro</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {separacao.detalhes.map((d) => {
                    const key = `ped-${d.pedidoId}`;
                    const checked = checkedItems.has(key);
                    return (
                      <TableRow
                        key={d.pedidoId}
                        className={`cursor-pointer transition-colors ${checked ? "opacity-50 line-through bg-green-500/10" : ""}`}
                        onClick={() => toggleCheck(key)}
                      >
                        <TableCell className="print:hidden" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCheck(key)}
                            className="size-4 accent-green-600 cursor-pointer"
                          />
                        </TableCell>
                        {modo === "semana" && <TableCell className="text-xs text-muted-foreground">{formatDate(d.dataEntrega)}</TableCell>}
                        <TableCell className="font-medium">{d.cliente}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{d.bairro}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            {d.itens.map((item, idx) => (
                              <span key={idx} className="text-sm">
                                {item.produto} <span className="font-semibold">x{item.quantidade}</span>
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <StatusBadge status={d.statusEntrega} context="entrega" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
