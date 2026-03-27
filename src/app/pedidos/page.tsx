"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  ClipboardList,
  Search,
  Filter,
  Copy,
  Pencil,
  Trash2,
  Check,
  CreditCard,
} from "lucide-react";

interface PedidoItem {
  id: number;
  produtoId: number;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  produto: { id: number; nome: string; preco: number };
}

interface Pedido {
  id: number;
  clienteId: number;
  dataPedido: string;
  dataEntrega: string;
  formaPagamentoId: number;
  total: number;
  valorPago: number;
  situacaoPagamento: string;
  statusEntrega: string;
  ordemRota: number | null;
  observacoes: string;
  recorrenteId: number | null;
  cliente: { id: number; nome: string; bairro: string };
  formaPagamento: { id: number; nome: string } | null;
  itens: PedidoItem[];
}

function todayStr() { return new Date().toISOString().slice(0, 10) }

interface Filters {
  cliente: string;
  bairro: string;
  situacaoPagamento: string;
  statusEntrega: string[];
  dataInicio: string;
  dataFim: string;
  valorMin: string;
  valorMax: string;
  recorrente: string;
}

// Default: today, exclude cancelled
const defaultFilters: Filters = {
  cliente: "",
  bairro: "",
  situacaoPagamento: "",
  statusEntrega: ["Pendente", "Em rota", "Entregue"],
  dataInicio: todayStr(),
  dataFim: todayStr(),
  valorMin: "",
  valorMax: "",
  recorrente: "",
};

const emptyFilters: Filters = {
  cliente: "",
  bairro: "",
  situacaoPagamento: "",
  statusEntrega: [],
  dataInicio: "",
  dataFim: "",
  valorMin: "",
  valorMax: "",
  recorrente: "",
};

function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

type StatusTab = "todos" | "concluidos" | "pendente_pgto" | "pendente_tudo";

export default function PedidosPage() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tab, setTab] = useState<StatusTab>("todos");

  // Auto-fetch when filters change
  useEffect(() => {
    const timer = setTimeout(() => fetchPedidos(), 300);
    return () => clearTimeout(timer);
  }, [filters]);

  async function fetchPedidos(customFilters?: Filters) {
    try {
      setLoading(true);
      const f = customFilters ?? filters;
      const params = new URLSearchParams();

      if (f.bairro) params.set("bairro", f.bairro);
      if (f.situacaoPagamento) params.set("situacaoPagamento", f.situacaoPagamento);
      if (f.statusEntrega.length > 0 && f.statusEntrega.length < 4) {
        params.set("statusEntrega", f.statusEntrega.join(","));
      }
      if (f.dataInicio) params.set("dataInicio", f.dataInicio);
      if (f.dataFim) params.set("dataFim", f.dataFim);
      if (f.valorMin) params.set("valorMin", f.valorMin);
      if (f.valorMax) params.set("valorMax", f.valorMax);

      const query = params.toString();
      const res = await fetch(`/api/pedidos${query ? `?${query}` : ""}`);
      const data = await res.json();

      let filtered = data;
      if (f.cliente) {
        const term = f.cliente.toLowerCase();
        filtered = filtered.filter((p: Pedido) =>
          p.cliente?.nome?.toLowerCase().includes(term)
        );
      }
      if (f.recorrente === "sim") {
        filtered = filtered.filter((p: Pedido) => p.recorrenteId != null);
      } else if (f.recorrente === "nao") {
        filtered = filtered.filter((p: Pedido) => p.recorrenteId == null);
      }

      setPedidos(filtered);
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleClearFilters() {
    setFilters(emptyFilters);
  }

  async function handleMarkPago(pedido: Pedido) {
    try {
      await fetch(`/api/pedidos/${pedido.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          situacaoPagamento: "Pago",
          valorPago: pedido.total,
        }),
      });
      fetchPedidos();
    } catch (error) {
      console.error("Erro ao marcar como pago:", error);
    }
  }

  async function handleMarkEntregue(pedido: Pedido) {
    try {
      await fetch(`/api/pedidos/${pedido.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusEntrega: "Entregue" }),
      });
      fetchPedidos();
    } catch (error) {
      console.error("Erro ao marcar como entregue:", error);
    }
  }

  async function handleDuplicar(pedidoId: number) {
    try {
      const res = await fetch(`/api/pedidos?duplicar=${pedidoId}`);
      const novo = await res.json();
      if (novo && novo.id) {
        router.push(`/pedidos/${novo.id}`);
      }
    } catch (error) {
      console.error("Erro ao duplicar pedido:", error);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Tem certeza que deseja excluir este pedido?")) return;

    try {
      await fetch(`/api/pedidos/${id}`, { method: "DELETE" });
      fetchPedidos();
    } catch (error) {
      console.error("Erro ao excluir pedido:", error);
    }
  }

  function getPagamentoBadge(situacao: string) {
    switch (situacao) {
      case "Pago":
        return <Badge className="bg-green-600 text-white">Pago</Badge>;
      case "Pendente":
      default:
        return <Badge className="bg-yellow-500 text-white">Pendente</Badge>;
    }
  }

  function getEntregaBadge(status: string) {
    switch (status) {
      case "Entregue":
        return <Badge className="bg-green-600 text-white">Entregue</Badge>;
      case "Em rota":
        return <Badge className="bg-blue-600 text-white">Em rota</Badge>;
      case "Cancelado":
        return <Badge className="bg-red-600 text-white">Cancelado</Badge>;
      case "Pendente":
      default:
        return <Badge className="bg-gray-500 text-white">Pendente</Badge>;
    }
  }

  const filteredByTab = pedidos.filter((p) => {
    switch (tab) {
      case "concluidos":
        return p.statusEntrega === "Entregue" && p.situacaoPagamento === "Pago";
      case "pendente_pgto":
        return p.statusEntrega === "Entregue" && p.situacaoPagamento !== "Pago";
      case "pendente_tudo":
        return p.statusEntrega !== "Entregue" && p.statusEntrega !== "Cancelado";
      default:
        return true;
    }
  }).sort((a, b) => {
    // Pending tabs: oldest first (date asc). Others: newest first (date desc)
    if (tab === "pendente_tudo" || tab === "pendente_pgto") {
      return a.dataEntrega.localeCompare(b.dataEntrega);
    }
    return b.dataEntrega.localeCompare(a.dataEntrega);
  });

  const counts = {
    todos: pedidos.length,
    concluidos: pedidos.filter((p) => p.statusEntrega === "Entregue" && p.situacaoPagamento === "Pago").length,
    pendente_pgto: pedidos.filter((p) => p.statusEntrega === "Entregue" && p.situacaoPagamento !== "Pago").length,
    pendente_tudo: pedidos.filter((p) => p.statusEntrega !== "Entregue" && p.statusEntrega !== "Cancelado").length,
  };

  const tabs: { key: StatusTab; label: string; count: number }[] = [
    { key: "todos", label: "Todos", count: counts.todos },
    { key: "pendente_tudo", label: "Pendente Entrega", count: counts.pendente_tudo },
    { key: "pendente_pgto", label: "Pendente Pgto", count: counts.pendente_pgto },
    { key: "concluidos", label: "Concluídos", count: counts.concluidos },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-5" />
          <h1 className="text-2xl font-semibold">Pedidos</h1>
        </div>
        <Link href="/pedidos/novo">
          <Button className="bg-green-600 hover:bg-green-700 text-white">
            <Plus className="size-4" />
            Novo Pedido
          </Button>
        </Link>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 border-b border-border pb-0 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              tab === t.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Date range shortcuts */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: "Hoje", fn: () => { const t = todayStr(); setFilters(f => ({ ...f, dataInicio: t, dataFim: t })) } },
          { label: "Semana", fn: () => {
            const d = new Date(); const day = d.getDay();
            const mon = new Date(d); mon.setDate(d.getDate() - ((day + 6) % 7));
            const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
            setFilters(f => ({ ...f, dataInicio: mon.toISOString().slice(0,10), dataFim: sun.toISOString().slice(0,10) }));
          }},
          { label: "Mês", fn: () => {
            const d = new Date(); const y = d.getFullYear(); const m = d.getMonth();
            setFilters(f => ({ ...f, dataInicio: new Date(y,m,1).toISOString().slice(0,10), dataFim: new Date(y,m+1,0).toISOString().slice(0,10) }));
          }},
          { label: "Todos", fn: () => { setFilters(f => ({ ...f, dataInicio: "", dataFim: "" })) } },
        ].map((s) => (
          <Button key={s.label} variant="outline" size="sm" onClick={s.fn} className="h-7 text-xs">
            {s.label}
          </Button>
        ))}
        {filters.dataInicio && (
          <span className="text-xs text-muted-foreground self-center ml-1">
            {formatDate(filters.dataInicio)}{filters.dataFim && filters.dataInicio !== filters.dataFim ? ` a ${formatDate(filters.dataFim)}` : ""}
          </span>
        )}
      </div>

      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <div className="flex items-center gap-2">
            <Filter className="size-4" />
            <CardTitle>Filtros</CardTitle>
          </div>
        </CardHeader>
        {filtersOpen && (
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="filter-cliente">Cliente</Label>
                <Input
                  id="filter-cliente"
                  placeholder="Nome do cliente"
                  value={filters.cliente}
                  onChange={(e) =>
                    setFilters({ ...filters, cliente: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-bairro">Bairro</Label>
                <Input
                  id="filter-bairro"
                  placeholder="Bairro"
                  value={filters.bairro}
                  onChange={(e) =>
                    setFilters({ ...filters, bairro: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Situação Pagamento</Label>
                <select
                  value={filters.situacaoPagamento}
                  onChange={(e) =>
                    setFilters({ ...filters, situacaoPagamento: e.target.value })
                  }
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                >
                  <option value="">Todos</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Pago">Pago</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Status Entrega</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {["Pendente", "Em rota", "Entregue", "Cancelado"].map((st) => (
                    <button key={st} type="button"
                      onClick={() => {
                        const arr = filters.statusEntrega.includes(st)
                          ? filters.statusEntrega.filter(s => s !== st)
                          : [...filters.statusEntrega, st];
                        setFilters({ ...filters, statusEntrega: arr });
                      }}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        filters.statusEntrega.includes(st)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      }`}>
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-data-inicio">Data de</Label>
                <Input
                  id="filter-data-inicio"
                  type="date"
                  value={filters.dataInicio}
                  onChange={(e) =>
                    setFilters({ ...filters, dataInicio: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-data-fim">Data até</Label>
                <Input
                  id="filter-data-fim"
                  type="date"
                  value={filters.dataFim}
                  onChange={(e) =>
                    setFilters({ ...filters, dataFim: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-valor-min">Valor min</Label>
                <Input
                  id="filter-valor-min"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={filters.valorMin}
                  onChange={(e) =>
                    setFilters({ ...filters, valorMin: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-valor-max">Valor max</Label>
                <Input
                  id="filter-valor-max"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={filters.valorMax}
                  onChange={(e) =>
                    setFilters({ ...filters, valorMax: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Recorrente</Label>
                <select
                  value={filters.recorrente}
                  onChange={(e) =>
                    setFilters({ ...filters, recorrente: e.target.value })
                  }
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                >
                  <option value="">Todos</option>
                  <option value="sim">Recorrentes</option>
                  <option value="nao">Avulsos</option>
                </select>
              </div>
            </div>

            <Separator className="my-4" />

            <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-xs text-muted-foreground">
              Limpar filtros
            </Button>
          </CardContent>
        )}
      </Card>

      {loading ? (
        <p className="text-center text-muted-foreground">Carregando...</p>
      ) : filteredByTab.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          Nenhum pedido nesta categoria.
        </p>
      ) : (
        <>
        {/* Mobile card view */}
        <div className="sm:hidden space-y-2">
          {filteredByTab.map((pedido) => (
            <div key={pedido.id} className="rounded-lg border overflow-hidden">
              {/* Card header - clickable to edit */}
              <div
                className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => router.push(`/pedidos/${pedido.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium text-sm truncate">{pedido.cliente?.nome}</span>
                    {pedido.recorrenteId && <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">Rec</Badge>}
                  </div>
                  <span className="font-bold text-sm shrink-0 ml-2">{formatPrice(pedido.total)}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  {getPagamentoBadge(pedido.situacaoPagamento)}
                  {getEntregaBadge(pedido.statusEntrega)}
                  <span className="text-xs text-muted-foreground ml-auto">{formatDate(pedido.dataEntrega)}</span>
                </div>
                {pedido.cliente?.bairro && (
                  <div className="text-xs text-muted-foreground mt-1">{pedido.cliente.bairro}</div>
                )}
              </div>
              {/* Action buttons */}
              <div className="flex border-t divide-x">
                {pedido.situacaoPagamento !== "Pago" && (
                  <button
                    className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-green-400 hover:bg-green-400/10 transition-colors"
                    onClick={() => handleMarkPago(pedido)}
                  >
                    <CreditCard className="size-3.5" />
                    Pago
                  </button>
                )}
                {pedido.statusEntrega !== "Entregue" && (
                  <button
                    className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-blue-400 hover:bg-blue-400/10 transition-colors"
                    onClick={() => handleMarkEntregue(pedido)}
                  >
                    <Check className="size-3.5" />
                    Entregue
                  </button>
                )}
                <button
                  className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
                  onClick={() => handleDuplicar(pedido.id)}
                >
                  <Copy className="size-3.5" />
                  Duplicar
                </button>
                <button
                  className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
                  onClick={() => router.push(`/pedidos/${pedido.id}`)}
                >
                  <Pencil className="size-3.5" />
                  Editar
                </button>
                <button
                  className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-red-400 hover:bg-red-400/10 transition-colors"
                  onClick={() => handleDelete(pedido.id)}
                >
                  <Trash2 className="size-3.5" />
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table view */}
        <div className="hidden sm:block overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden lg:table-cell">Bairro</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Pgto</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead className="hidden md:table-cell">Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredByTab.map((pedido) => (
                <TableRow key={pedido.id}>
                  <TableCell className="font-medium">{pedido.id}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      {pedido.cliente?.nome}
                      {pedido.recorrenteId && <Badge variant="outline" className="text-[10px] px-1 py-0">Rec</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{pedido.cliente?.bairro}</TableCell>
                  <TableCell className="text-right font-medium">{formatPrice(pedido.total)}</TableCell>
                  <TableCell>
                    {getPagamentoBadge(pedido.situacaoPagamento)}
                  </TableCell>
                  <TableCell>
                    {getEntregaBadge(pedido.statusEntrega)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{formatDate(pedido.dataEntrega)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {pedido.situacaoPagamento !== "Pago" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkPago(pedido)}
                          title="Marcar como Pago"
                        >
                          <CreditCard className="size-4" />
                          Pago
                        </Button>
                      )}
                      {pedido.statusEntrega !== "Entregue" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkEntregue(pedido)}
                          title="Marcar como Entregue"
                        >
                          <Check className="size-4" />
                          Entregue
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDuplicar(pedido.id)}
                        title="Duplicar"
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Link href={`/pedidos/${pedido.id}`}>
                        <Button variant="ghost" size="icon-sm" title="Editar">
                          <Pencil className="size-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        onClick={() => handleDelete(pedido.id)}
                        title="Excluir"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </>
      )}
    </div>
  );
}
