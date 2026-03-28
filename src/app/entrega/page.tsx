"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Check,
  CreditCard,
  MapPin,
  Navigation,
  RefreshCw,
  Loader2,
  X,
} from "lucide-react";

interface Cliente {
  id: number;
  nome: string;
  telefone: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  enderecoAlternativo?: string;
}

interface Pedido {
  id: number;
  clienteId: number;
  total: number;
  valorPago: number;
  statusEntrega: string;
  situacaoPagamento: string;
  ordemRota: number | null;
  cliente: Cliente;
}

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function buildAddress(cliente: Cliente) {
  if (cliente.enderecoAlternativo?.trim()) {
    return cliente.enderecoAlternativo.trim();
  }
  return [cliente.rua, cliente.numero, cliente.bairro, cliente.cidade]
    .filter(Boolean)
    .join(", ");
}

function buildDisplayAddress(cliente: Cliente) {
  if (cliente.enderecoAlternativo?.trim()) {
    return cliente.enderecoAlternativo.trim();
  }
  const street = [cliente.rua, cliente.numero].filter(Boolean).join(", ");
  return [street, cliente.bairro].filter(Boolean).join(" - ");
}

export default function EntregaPage() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const fetchPedidos = useCallback(async () => {
    try {
      const res = await fetch(`/api/rota?data=${todayString()}`);
      const json = await res.json();
      // Sort by ordemRota (nulls last), then by id
      const sorted = (json as Pedido[]).sort((a, b) => {
        if (a.ordemRota != null && b.ordemRota != null)
          return a.ordemRota - b.ordemRota;
        if (a.ordemRota != null) return -1;
        if (b.ordemRota != null) return 1;
        return a.id - b.id;
      });
      setPedidos(sorted);
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchPedidos();
  }

  async function marcarEntregue(pedido: Pedido) {
    try {
      setActionLoading(pedido.id);
      await fetch(`/api/pedidos/${pedido.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusEntrega: "Entregue" }),
      });
      await fetchPedidos();
    } catch (error) {
      console.error("Erro ao marcar entregue:", error);
    } finally {
      setActionLoading(null);
    }
  }

  async function registrarPagamento(pedido: Pedido) {
    try {
      setActionLoading(pedido.id);
      await fetch(`/api/pedidos/${pedido.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situacaoPagamento: "Pago", valorPago: pedido.total }),
      });
      await fetchPedidos();
    } catch (error) {
      console.error("Erro ao registrar pagamento:", error);
    } finally {
      setActionLoading(null);
    }
  }

  function abrirMaps(cliente: Cliente) {
    const address = encodeURIComponent(buildAddress(cliente));
    window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, "_blank");
  }

  // Summary stats (all orders that were "Em rota" or delivered today)
  const entregasRestantes = pedidos.filter(
    (p) => p.statusEntrega === "Em rota" || p.statusEntrega === "Pendente"
  ).length;
  const totalAReceber = pedidos
    .filter((p) => p.situacaoPagamento === "Pendente")
    .reduce((sum, p) => sum + p.total, 0);

  // For the final summary popup, we need all today's delivered orders too
  // Since the API only returns non-delivered, we track delivered ones locally
  const [entregasRealizadas, setEntregasRealizadas] = useState(0);
  const [totalRecebido, setTotalRecebido] = useState(0);
  const [pgtosPendentes, setPgtosPendentes] = useState(0);

  async function finalizarRota() {
    // Fetch all today's orders for the summary
    try {
      const res = await fetch(`/api/pedidos?dataEntrega=${todayString()}`);
      const todos: Pedido[] = await res.json();
      const entregues = todos.filter((p) => p.statusEntrega === "Entregue");
      const recebido = todos
        .filter((p) => p.situacaoPagamento === "Pago")
        .reduce((sum, p) => sum + p.valorPago, 0);
      const pendentes = todos.filter(
        (p) => p.statusEntrega === "Entregue" && p.situacaoPagamento === "Pendente"
      ).length;

      setEntregasRealizadas(entregues.length);
      setTotalRecebido(recebido);
      setPgtosPendentes(pendentes);
      setShowSummary(true);
    } catch (error) {
      console.error("Erro ao buscar resumo:", error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/rota")}>
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-lg font-bold tracking-tight flex-1">Modo Entrega</h1>
        <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`size-5 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Summary bar */}
      <div className="px-4 py-3 bg-card border-b">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            <strong className="text-foreground">{entregasRestantes}</strong> entrega{entregasRestantes !== 1 ? "s" : ""} restante{entregasRestantes !== 1 ? "s" : ""}
          </span>
          <span className="text-muted-foreground">
            <strong className="text-foreground">{fmt(totalAReceber)}</strong> a receber
          </span>
        </div>
      </div>

      {/* Order cards */}
      <div className="p-4 space-y-3">
        {pedidos.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">Nenhuma entrega pendente</p>
            <p className="text-sm mt-1">Todas as entregas do dia foram concluidas!</p>
          </div>
        ) : (
          pedidos.map((pedido, index) => (
            <Card key={pedido.id}>
              <CardContent className="py-4 space-y-3">
                {/* Client info */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-lg font-bold truncate">{pedido.cliente.nome}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">{buildDisplayAddress(pedido.cliente)}</span>
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={pedido.statusEntrega === "Em rota" ? "default" : "outline"}
                    className="shrink-0 text-xs"
                  >
                    {pedido.statusEntrega}
                  </Badge>
                </div>

                {/* Total and payment */}
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold">{fmt(pedido.total)}</span>
                  <Badge
                    variant={pedido.situacaoPagamento === "Pago" ? "default" : "outline"}
                    className="text-xs"
                  >
                    {pedido.situacaoPagamento}
                  </Badge>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1 min-h-[48px] bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => marcarEntregue(pedido)}
                    disabled={actionLoading === pedido.id || pedido.statusEntrega === "Entregue"}
                  >
                    {actionLoading === pedido.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    Entregue
                  </Button>
                  <Button
                    className="flex-1 min-h-[48px] bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => registrarPagamento(pedido)}
                    disabled={actionLoading === pedido.id || pedido.situacaoPagamento === "Pago"}
                  >
                    {actionLoading === pedido.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CreditCard className="size-4" />
                    )}
                    Recebeu Pgto
                  </Button>
                </div>

                {/* Maps button */}
                <Button
                  variant="outline"
                  className="w-full min-h-[48px]"
                  onClick={() => abrirMaps(pedido.cliente)}
                >
                  <Navigation className="size-4" />
                  Abrir no Google Maps
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Finish route button - fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
        <Button
          className="w-full min-h-[48px] bg-primary hover:bg-primary/90"
          onClick={finalizarRota}
        >
          Finalizar Rota
        </Button>
      </div>

      {/* Summary popup */}
      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card rounded-2xl border shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Resumo da Rota</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowSummary(false)}>
                <X className="size-5" />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-muted-foreground">Entregas realizadas</span>
                <span className="text-lg font-bold">{entregasRealizadas}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-muted-foreground">Recebido</span>
                <span className="text-lg font-bold text-green-500">{fmt(totalRecebido)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Pagamentos pendentes</span>
                <span className="text-lg font-bold text-yellow-500">{pgtosPendentes}</span>
              </div>
            </div>

            <Button
              className="w-full min-h-[48px]"
              onClick={() => router.push("/")}
            >
              Voltar ao Inicio
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
