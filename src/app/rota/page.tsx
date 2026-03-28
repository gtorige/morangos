"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  MapPin,
  Navigation,
  Check,
  CreditCard,
  ArrowUp,
  ArrowDown,
  Truck,
  Play,
  Save,
  RotateCcw,
  Home,
  Route,
  Clock,
  Loader2,
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
  cliente: Cliente;
}

interface RotaInfo {
  totalDistanceKm: string;
  totalDurationMinutes: number;
  deliveryDistanceKm: string;
  deliveryDurationMinutes: number;
  returnDurationMinutes: number;
  mapUrl: string;
}

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function buildAddress(cliente: Cliente) {
  // Use endereço alternativo if available (e.g. "Shopping Ibirapuera, São Paulo")
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

export default function RotaPage() {
  const [data, setData] = useState(todayString());
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [rotaInfo, setRotaInfo] = useState<RotaInfo | null>(null);

  const [enderecoPartida, setEnderecoPartida] = useState("");
  const [enderecoSalvo, setEnderecoSalvo] = useState("");
  const [savingEndereco, setSavingEndereco] = useState(false);
  const [showEnderecoForm, setShowEnderecoForm] = useState(false);

  useEffect(() => {
    fetchEnderecoPartida();
  }, []);

  useEffect(() => {
    fetchRota();
    setRotaInfo(null);
  }, [data]);

  async function fetchEnderecoPartida() {
    try {
      const res = await fetch("/api/configuracoes?chave=endereco_partida");
      const config = await res.json();
      if (config?.valor) {
        setEnderecoPartida(config.valor);
        setEnderecoSalvo(config.valor);
      }
    } catch (error) {
      console.error("Erro ao buscar endereço de partida:", error);
    }
  }

  async function salvarEnderecoPartida() {
    try {
      setSavingEndereco(true);
      await fetch("/api/configuracoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chave: "endereco_partida", valor: enderecoPartida }),
      });
      setEnderecoSalvo(enderecoPartida);
      setShowEnderecoForm(false);
    } catch (error) {
      console.error("Erro ao salvar endereço:", error);
    } finally {
      setSavingEndereco(false);
    }
  }

  async function fetchRota() {
    try {
      setLoading(true);
      const res = await fetch(`/api/rota?data=${data}`);
      const json = await res.json();
      setPedidos(json);
    } catch (error) {
      console.error("Erro ao buscar rota:", error);
    } finally {
      setLoading(false);
    }
  }

  async function otimizarRota() {
    if (pedidos.length === 0 || !enderecoSalvo) return;

    try {
      setOptimizing(true);
      setRotaInfo(null);

      const waypoints = pedidos.map((p) => ({
        address: buildAddress(p.cliente),
        pedidoId: p.id,
      }));

      const res = await fetch("/api/rota/otimizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: enderecoSalvo, waypoints }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("Erro na otimização:", err);
        const details = err.details?.error?.message || "";
        if (details.includes("could not be geocoded") || details.includes("GEOCODING")) {
          const badAddresses = waypoints
            .filter((w) => !w.address || w.address.trim().length < 5)
            .map((w) => `• Pedido ${w.pedidoId}`);
          alert(
            "Erro: alguns endereços não puderam ser encontrados pelo Google.\n\n" +
            "Verifique se todos os clientes têm rua, número e cidade preenchidos.\n" +
            (badAddresses.length > 0 ? "\nEndereços incompletos:\n" + badAddresses.join("\n") : "") +
            "\n\nDica: use endereços completos (ex: Av. Paulista, 1000, São Paulo) em vez de nomes de locais."
          );
        } else {
          alert(
            "Erro ao otimizar rota.\n\n" +
            (details || "Verifique os endereços dos clientes e tente novamente.")
          );
        }
        return;
      }

      const data = await res.json();
      const { optimizedOrder, totalDistanceKm, totalDurationMinutes, deliveryDistanceKm, deliveryDurationMinutes, returnDurationMinutes } = data;

      // Reorder pedidos based on optimized order
      const reordered = optimizedOrder.map((idx: number) => pedidos[idx]);
      setPedidos(reordered);

      // Fetch embed map URL from server
      const originEnc = encodeURIComponent(enderecoSalvo);
      const wps = reordered
        .map((p: Pedido) => encodeURIComponent(buildAddress(p.cliente)))
        .join("|");
      const mapRes = await fetch(`/api/rota/mapa?origin=${originEnc}&destination=${originEnc}&waypoints=${wps}`);
      let mapUrl = "";
      if (mapRes.ok) {
        const mapData = await mapRes.json();
        mapUrl = mapData.url || "";
      }

      setRotaInfo({ totalDistanceKm, totalDurationMinutes, deliveryDistanceKm, deliveryDurationMinutes, returnDurationMinutes, mapUrl });
    } catch (error) {
      console.error("Erro ao otimizar rota:", error);
      alert("Erro de conexão ao otimizar rota.");
    } finally {
      setOptimizing(false);
    }
  }

  async function marcarEntregue(pedido: Pedido) {
    try {
      setActionLoading(pedido.id);
      await fetch(`/api/pedidos/${pedido.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusEntrega: "Entregue" }),
      });
      await fetchRota();
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
      await fetchRota();
    } catch (error) {
      console.error("Erro ao registrar pagamento:", error);
    } finally {
      setActionLoading(null);
    }
  }

  async function iniciarEntregas() {
    try {
      setBulkLoading(true);
      await Promise.all(
        pedidos.map((p) =>
          fetch(`/api/pedidos/${p.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ statusEntrega: "Em rota" }),
          })
        )
      );
      await fetchRota();
      gerarRota();
    } catch (error) {
      console.error("Erro ao iniciar entregas:", error);
    } finally {
      setBulkLoading(false);
    }
  }

  function gerarRota() {
    if (pedidos.length === 0) return;
    const waypoints: string[] = [];

    if (enderecoSalvo) {
      waypoints.push(encodeURIComponent(enderecoSalvo));
    }

    pedidos.forEach((p) => {
      waypoints.push(encodeURIComponent(buildAddress(p.cliente)));
    });

    if (enderecoSalvo) {
      waypoints.push(encodeURIComponent(enderecoSalvo));
    }

    const url = `https://www.google.com/maps/dir/${waypoints.join("/")}`;
    window.open(url, "_blank");
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const updated = [...pedidos];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setPedidos(updated);
    setRotaInfo(null);
  }

  function moveDown(index: number) {
    if (index === pedidos.length - 1) return;
    const updated = [...pedidos];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setPedidos(updated);
    setRotaInfo(null);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <Truck className="size-5" />
        <h1 className="text-2xl font-semibold tracking-tight">Rota de Entrega</h1>
      </div>

      {/* Endereço de Partida */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm font-medium">
            <div className="flex items-center gap-2">
              <Home className="size-4" />
              Endereço de Partida
            </div>
            {enderecoSalvo && !showEnderecoForm && (
              <Button variant="ghost" size="sm" onClick={() => setShowEnderecoForm(true)}>
                Alterar
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!enderecoSalvo || showEnderecoForm ? (
            <div className="space-y-3">
              <Input
                placeholder="Ex: 588C+R5 São Paulo ou Rua das Flores, 100, São Paulo"
                value={enderecoPartida}
                onChange={(e) => setEnderecoPartida(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={salvarEnderecoPartida} disabled={savingEndereco || !enderecoPartida.trim()}>
                  <Save className="size-4" />
                  {savingEndereco ? "Salvando..." : "Salvar"}
                </Button>
                {enderecoSalvo && (
                  <Button size="sm" variant="ghost" onClick={() => { setEnderecoPartida(enderecoSalvo); setShowEnderecoForm(false); }}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="size-3 shrink-0" />
              {enderecoSalvo}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Data */}
      <div className="space-y-1">
        <Label htmlFor="data" className="text-xs">Data</Label>
        <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-full sm:w-44 h-8 text-sm" />
      </div>

      {/* Actions */}
      {!loading && pedidos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={otimizarRota} disabled={optimizing || !enderecoSalvo}>
            {optimizing ? <Loader2 className="size-4 animate-spin" /> : <Route className="size-4" />}
            {optimizing ? "Otimizando..." : "Otimizar Rota (Google)"}
          </Button>
          <Button variant="outline" onClick={gerarRota}>
            <Navigation className="size-4" />
            Abrir no Maps
          </Button>
          <Button variant="outline" onClick={iniciarEntregas} disabled={bulkLoading}>
            <Play className="size-4" />
            {bulkLoading ? "Iniciando..." : "Iniciar Entregas"}
          </Button>
        </div>
      )}

      {/* Route info */}
      {rotaInfo && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Route className="size-4 text-primary" />
                <span>Entregas: <strong>{rotaInfo.deliveryDistanceKm} km</strong> · <strong>{rotaInfo.deliveryDurationMinutes} min</strong></span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Home className="size-3.5" />
                <span>Volta: +{rotaInfo.returnDurationMinutes} min</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="size-3.5" />
                <span>Total: {rotaInfo.totalDistanceKm} km · {rotaInfo.totalDurationMinutes} min</span>
              </div>
              <Badge variant="outline" className="text-primary border-primary/30">
                Com trânsito
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Map preview */}
      {rotaInfo?.mapUrl && (
        <Card>
          <CardContent className="p-0 overflow-hidden rounded-xl">
            <iframe
              src={rotaInfo.mapUrl}
              className="w-full h-[250px] sm:h-[400px] border-0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </CardContent>
        </Card>
      )}

      {!enderecoSalvo && (
        <p className="text-sm text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
          Configure o endereço de partida acima para otimizar a rota.
        </p>
      )}

      <Separator />

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : pedidos.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          Nenhuma entrega pendente para esta data.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {pedidos.length} entrega{pedidos.length > 1 ? "s" : ""} pendente{pedidos.length > 1 ? "s" : ""}
          </p>

          {pedidos.map((pedido, index) => (
            <Card key={pedido.id}>
              <CardContent className="py-3">
                <div className="flex items-start gap-3">
                  {/* Number */}
                  <span className="flex items-center justify-center size-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5">
                    {index + 1}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{pedido.cliente.nome}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="size-3 shrink-0" />
                          {buildDisplayAddress(pedido.cliente)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant={pedido.statusEntrega === "Em rota" ? "default" : "outline"} className="text-xs">
                          {pedido.statusEntrega}
                        </Badge>
                        <Button variant="ghost" size="icon-sm" onClick={() => moveUp(index)} disabled={index === 0}>
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => moveDown(index)} disabled={index === pedidos.length - 1}>
                          <ArrowDown className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-bold">{fmt(pedido.total)}</span>
                        <Badge variant={pedido.situacaoPagamento === "Pago" ? "default" : "outline"} className="text-xs">
                          {pedido.situacaoPagamento}
                        </Badge>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => marcarEntregue(pedido)}
                          disabled={actionLoading === pedido.id || pedido.statusEntrega === "Entregue"}
                          className="h-7 text-xs"
                        >
                          <Check className="size-3" />
                          Entregue
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => registrarPagamento(pedido)}
                          disabled={actionLoading === pedido.id || pedido.situacaoPagamento === "Pago"}
                          className="h-7 text-xs"
                        >
                          <CreditCard className="size-3" />
                          Pagar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
