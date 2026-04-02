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
  MessageCircle,
} from "lucide-react";
import { formatCurrency as fmt, todayStr as todayString } from "@/lib/formatting";
import { FluxoBanner } from "@/components/fluxo-banner";

const ROTA_STORAGE_KEY = "rota-lista";

interface Cliente {
  id: number;
  nome: string;
  telefone: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  enderecoAlternativo?: string;
  observacoes?: string;
}

interface PedidoItem {
  id: number;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  produto: { id: number; nome: string };
}

interface Pedido {
  id: number;
  clienteId: number;
  total: number;
  valorPago: number;
  statusEntrega: string;
  situacaoPagamento: string;
  observacoes: string;
  ordemRota: number | null;
  updatedAt?: string;
  cliente: Cliente;
  itens: PedidoItem[];
}

interface MensagemWhatsApp {
  id: number;
  nome: string;
  texto: string;
}

interface Parada {
  id: number;
  nome: string;
  endereco: string;
}

type ListItem =
  | { type: "pedido"; data: Pedido }
  | { type: "parada"; data: Parada };

function buildWppUrl(telefone: string, texto: string) {
  const num = telefone.replace(/\D/g, "");
  const full = num.startsWith("55") ? num : `55${num}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(texto)}`;
}

function applyVars(texto: string, vars: Record<string, string>) {
  // Normalize various unicode curly brace chars + strip zero-width chars
  let result = texto
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "") // zero-width chars
    .replace(/[\uFF5B\u2774\u2775\u007B]/g, "{") // → {
    .replace(/[\uFF5D\u2776\u2777\u007D]/g, "}"); // → }
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\s*${key}\\s*\\}`, "gi"), value ?? "");
  }
  return result;
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
  const [lista, setLista] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [mensagensWpp, setMensagensWpp] = useState<MensagemWhatsApp[]>([]);
  const [wppPickerId, setWppPickerId] = useState<number | null>(null);

  const fetchPedidos = useCallback(async () => {
    try {
      const res = await fetch(`/api/rota?data=${todayString()}`);
      const fetched: Pedido[] = await res.json();

      // Try to restore ordered list from localStorage
      let storedLista: ListItem[] | null = null;
      try {
        const raw = localStorage.getItem(ROTA_STORAGE_KEY);
        if (raw) storedLista = JSON.parse(raw);
      } catch {}

      if (storedLista) {
        // Merge: replace pedido data with fresh fetched data, keep paradas as-is
        const fetchedMap = new Map(fetched.map((p) => [p.id, p]));
        const merged: ListItem[] = storedLista
          .map((item) => {
            if (item.type === "parada") return item;
            const fresh = fetchedMap.get(item.data.id);
            return fresh ? { type: "pedido" as const, data: fresh } : null;
          })
          .filter(Boolean) as ListItem[];

        // Add any fetched pedidos not in stored list (new orders added after optimization)
        const storedIds = new Set(storedLista.filter((i) => i.type === "pedido").map((i) => (i.data as Pedido).id));
        for (const p of fetched) {
          if (!storedIds.has(p.id)) {
            merged.push({ type: "pedido", data: p });
          }
        }

        setLista(merged);
      } else {
        // No stored order — sort by ordemRota
        const sorted = fetched.sort((a, b) => {
          if (a.ordemRota != null && b.ordemRota != null) return a.ordemRota - b.ordemRota;
          if (a.ordemRota != null) return -1;
          if (b.ordemRota != null) return 1;
          return a.id - b.id;
        });
        setLista(sorted.map((p) => ({ type: "pedido", data: p })));
      }
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPedidos();
    fetch("/api/mensagens-whatsapp").then(r => r.ok ? r.json() : []).then(setMensagensWpp).catch(() => {});
  }, [fetchPedidos]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchPedidos();
  }

  function saveListaToStorage(l: ListItem[]) {
    try { localStorage.setItem(ROTA_STORAGE_KEY, JSON.stringify(l)); } catch {}
  }

  async function marcarEntregue(pedido: Pedido) {
    try {
      setActionLoading(pedido.id);
      await fetch(`/api/pedidos/${pedido.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusEntrega: "Entregue", updatedAt: pedido.updatedAt }),
      });
      // Update local list immediately for responsive UI
      setLista(prev => {
        const updated = prev.map(item =>
          item.type === "pedido" && item.data.id === pedido.id
            ? { ...item, data: { ...item.data, statusEntrega: "Entregue" } }
            : item
        );
        saveListaToStorage(updated);
        return updated;
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
        body: JSON.stringify({ situacaoPagamento: "Pago", valorPago: pedido.total, updatedAt: pedido.updatedAt }),
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

  const pedidos = lista.filter((i) => i.type === "pedido").map((i) => i.data as Pedido);
  const entregasRestantes = pedidos.filter((p) => p.statusEntrega === "Em rota" || p.statusEntrega === "Pendente").length;
  const totalAReceber = pedidos.filter((p) => p.situacaoPagamento === "Pendente").reduce((sum, p) => sum + p.total, 0);

  const [entregasRealizadas, setEntregasRealizadas] = useState(0);
  const [totalRecebido, setTotalRecebido] = useState(0);
  const [pgtosPendentes, setPgtosPendentes] = useState(0);

  async function finalizarRota() {
    try {
      const res = await fetch(`/api/pedidos?dataEntrega=${todayString()}`);
      const todos: Pedido[] = await res.json();
      const entregues = todos.filter((p) => p.statusEntrega === "Entregue");
      const recebido = todos.filter((p) => p.situacaoPagamento === "Pago").reduce((sum, p) => sum + p.total, 0);
      const pendentes = todos.filter((p) => p.statusEntrega === "Entregue" && p.situacaoPagamento === "Pendente").length;
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
      {/* Flow Banner */}
      <div className="px-4 pt-3">
        <FluxoBanner stepAtual="entrega" />
      </div>
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

      {/* List */}
      <div className="p-4 space-y-3">
        {lista.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">Nenhuma entrega pendente</p>
            <p className="text-sm mt-1">Todas as entregas do dia foram concluidas!</p>
          </div>
        ) : (
          [...lista].sort((a, b) => {
            // Entregues go to the end
            const aEntregue = a.type === "pedido" && a.data.statusEntrega === "Entregue" ? 1 : 0;
            const bEntregue = b.type === "pedido" && b.data.statusEntrega === "Entregue" ? 1 : 0;
            return aEntregue - bEntregue;
          }).map((item, index) => {
            const isEntregue = item.type === "pedido" && item.data.statusEntrega === "Entregue";
            return item.type === "parada" ? (
              /* Parada */
              <div
                key={`parada-${item.data.id}`}
                className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3"
              >
                <span className="flex items-center justify-center size-8 rounded-full bg-muted text-muted-foreground text-sm font-bold shrink-0">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{item.data.nome}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="size-3 shrink-0" />
                    {item.data.endereco}
                  </p>
                </div>
              </div>
            ) : (
              /* Pedido */
              <Card
                key={`pedido-${item.data.id}`}
                className={`cursor-pointer ${isEntregue ? "opacity-40" : ""}`}
                onClick={() => setExpandedId(expandedId === item.data.id ? null : item.data.id)}
              >
                <CardContent className="py-3 px-4 space-y-0">
                  {/* Header row */}
                  <div className="flex items-center gap-3">
                    {isEntregue ? (
                      <span className="flex items-center justify-center size-8 rounded-full bg-green-600 text-white text-sm font-bold shrink-0">✓</span>
                    ) : (
                      <span className="flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
                        {index + 1}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-base font-bold truncate ${isEntregue ? "line-through text-muted-foreground" : ""}`}>{item.data.cliente.nome}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="size-3 shrink-0" />
                        <span className="truncate">{buildDisplayAddress(item.data.cliente)}</span>
                      </p>
                      {item.data.observacoes && (
                        <p className="text-xs text-yellow-500 italic mt-0.5">Obs: {item.data.observacoes}</p>
                      )}
                      {item.data.cliente.observacoes && (
                        <p className="text-xs text-muted-foreground italic mt-0.5">Cliente: {item.data.cliente.observacoes}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-bold">{fmt(item.data.total)}</p>
                      {isEntregue ? (
                        <Badge className="text-xs bg-green-600 text-white">Entregue</Badge>
                      ) : (
                        <Badge variant={item.data.situacaoPagamento === "Pago" ? "default" : "outline"} className="text-xs">
                          {item.data.situacaoPagamento}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Expanded */}
                  {expandedId === item.data.id && (
                    <div className="mt-3 pt-3 border-t border-border space-y-3" onClick={(e) => e.stopPropagation()}>
                      {/* Items */}
                      {item.data.itens.length > 0 && (
                        <div className="space-y-1">
                          {item.data.itens.map((it) => (
                            <div key={it.id} className="flex justify-between text-sm">
                              <span>{it.quantidade}x {it.produto.nome}</span>
                              <span className="text-muted-foreground">{fmt(it.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 min-h-[44px] bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => marcarEntregue(item.data)}
                          disabled={actionLoading === item.data.id || item.data.statusEntrega === "Entregue"}
                        >
                          {actionLoading === item.data.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                          Entregue
                        </Button>
                        <Button
                          className="flex-1 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => registrarPagamento(item.data)}
                          disabled={actionLoading === item.data.id || item.data.situacaoPagamento === "Pago"}
                        >
                          {actionLoading === item.data.id ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                          Recebeu Pgto
                        </Button>
                      </div>

                      <Button variant="outline" className="w-full min-h-[44px]" onClick={() => abrirMaps(item.data.cliente)}>
                        <Navigation className="size-4" />
                        Abrir no Google Maps
                      </Button>

                      {item.data.cliente.telefone && mensagensWpp.length > 0 && (
                        <div>
                          <Button
                            variant="outline"
                            className="w-full min-h-[44px] border-green-600/40 text-green-400 hover:bg-green-600/10"
                            onClick={() => setWppPickerId(wppPickerId === item.data.id ? null : item.data.id)}
                          >
                            <MessageCircle className="size-4" />
                            Enviar WhatsApp
                          </Button>
                          {wppPickerId === item.data.id && (
                            <div className="mt-2 rounded-lg border border-border bg-muted/30 p-2 space-y-1">
                              {mensagensWpp.map((m) => {
                                const preview = applyVars(m.texto, { nome: item.data.cliente.nome, total: fmt(item.data.total) });
                                return (
                                  <button
                                    key={m.id}
                                    onClick={() => {
                                      window.open(buildWppUrl(item.data.cliente.telefone, preview), "_blank");
                                      setWppPickerId(null);
                                    }}
                                    className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors"
                                  >
                                    <p className="text-sm font-medium">{m.nome}</p>
                                    <p className="text-xs text-muted-foreground truncate">{preview}</p>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Finish route button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
        <Button className="w-full min-h-[48px] bg-primary hover:bg-primary/90" onClick={finalizarRota}>
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
            <Button className="w-full min-h-[48px]" onClick={() => router.push("/")}>
              Voltar ao Inicio
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
