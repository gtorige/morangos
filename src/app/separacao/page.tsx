"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardCheck, Package, Users, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  statusEntrega: string;
  itens: DetalheItem[];
}

interface Separacao {
  data: string;
  totalPedidos: number;
  produtos: ProdutoResumo[];
  detalhes: Detalhe[];
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function SeparacaoPage() {
  const [data, setData] = useState(todayString());
  const [separacao, setSeparacao] = useState<Separacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSeparacao();
    setCheckedItems(new Set());
  }, [data]);

  async function fetchSeparacao() {
    try {
      setLoading(true);
      const res = await fetch(`/api/separacao?data=${data}`);
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

      <div className="max-w-xs space-y-2 print:hidden">
        <Label htmlFor="data">Data de Entrega</Label>
        <Input
          id="data"
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
        />
      </div>

      {/* Print header */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-xl font-bold">
          Lista de Separação -{" "}
          {data.split("-").reverse().join("/")}
        </h1>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground">Carregando...</p>
      ) : !separacao || separacao.totalPedidos === 0 ? (
        <p className="text-center text-muted-foreground">
          Nenhum pedido para esta data.
        </p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:hidden">
            <Card className="border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-400">
                  <Package className="size-4" />
                  Total de Itens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-200">
                  {totalItens}
                </p>
              </CardContent>
            </Card>
            <Card className="border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-400">
                  <Users className="size-4" />
                  Pedidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-purple-900 dark:text-purple-200">
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
            <div className="grid gap-3 md:grid-cols-2">
              {separacao.detalhes.map((d) => {
                const key = `ped-${d.pedidoId}`;
                const checked = checkedItems.has(key);
                return (
                  <Card
                    key={d.pedidoId}
                    className={`cursor-pointer transition-all print:break-inside-avoid ${
                      checked
                        ? "border-green-400 bg-green-50 dark:bg-green-950/20 opacity-60"
                        : ""
                    }`}
                    onClick={() => toggleCheck(key)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-sm">
                        <span className={checked ? "line-through" : ""}>
                          {d.cliente}
                        </span>
                        <div className="flex items-center gap-2">
                          {d.bairro && (
                            <Badge variant="outline" className="text-xs">
                              {d.bairro}
                            </Badge>
                          )}
                          <Badge
                            className={
                              d.statusEntrega === "Entregue"
                                ? "bg-green-600 text-white"
                                : d.statusEntrega === "Em rota"
                                ? "bg-blue-600 text-white"
                                : "bg-yellow-500 text-white"
                            }
                          >
                            {d.statusEntrega}
                          </Badge>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1">
                        {d.itens.map((item, idx) => (
                          <li
                            key={idx}
                            className={`flex justify-between text-sm ${
                              checked ? "line-through" : ""
                            }`}
                          >
                            <span>{item.produto}</span>
                            <span className="font-semibold">
                              x{item.quantidade}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
