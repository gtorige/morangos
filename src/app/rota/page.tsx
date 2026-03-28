"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
  Plus,
  Trash2,
  Star,
  X,
  Settings,
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

interface LocalFrequente {
  id: number;
  nome: string;
  endereco: string;
  plusCode: string;
}

interface Parada {
  id: number;
  nome: string;
  endereco: string;
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

  const [locaisFrequentes, setLocaisFrequentes] = useState<LocalFrequente[]>([]);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [selectedLocalId, setSelectedLocalId] = useState("");
  const [showGerenciarLocais, setShowGerenciarLocais] = useState(false);
  const [novoLocalNome, setNovoLocalNome] = useState("");
  const [novoLocalEndereco, setNovoLocalEndereco] = useState("");
  const [savingLocal, setSavingLocal] = useState(false);

  useEffect(() => {
    fetchEnderecoPartida();
    fetchLocaisFrequentes();
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

  async function fetchLocaisFrequentes() {
    try {
      const res = await fetch("/api/locais-frequentes");
      if (res.ok) {
        const data = await res.json();
        setLocaisFrequentes(data);
      }
    } catch (error) {
      console.error("Erro ao buscar locais frequentes:", error);
    }
  }

  function adicionarParada() {
    if (!selectedLocalId) return;
    const local = locaisFrequentes.find((l) => String(l.id) === selectedLocalId);
    if (!local) return;
    // Avoid duplicates
    if (paradas.some((p) => p.id === local.id)) return;
    setParadas([...paradas, { id: local.id, nome: local.nome, endereco: local.endereco }]);
    setSelectedLocalId("");
    setRotaInfo(null);
  }

  function removerParada(id: number) {
    setParadas(paradas.filter((p) => p.id !== id));
    setRotaInfo(null);
  }

  async function criarLocalFrequente() {
    if (!novoLocalNome.trim()) return;
    try {
      setSavingLocal(true);
      const res = await fetch("/api/locais-frequentes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: novoLocalNome.trim(), endereco: novoLocalEndereco.trim() }),
      });
      if (res.ok) {
        setNovoLocalNome("");
        setNovoLocalEndereco("");
        await fetchLocaisFrequentes();
      }
    } catch (error) {
      console.error("Erro ao criar local:", error);
    } finally {
      setSavingLocal(false);
    }
  }

  async function excluirLocalFrequente(id: number) {
    try {
      const res = await fetch(`/api/locais-frequentes/${id}`, { method: "DELETE" });
      if (res.ok) {
        // Remove from paradas if it was added
        setParadas(paradas.filter((p) => p.id !== id));
        await fetchLocaisFrequentes();
      }
    } catch (error) {
      console.error("Erro ao excluir local:", error);
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

      const paradasPayload = paradas.map((p) => ({ endereco: p.endereco }));

      const res = await fetch("/api/rota/otimizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: enderecoSalvo, waypoints, paradas: paradasPayload }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Erro na otimização:", JSON.stringify(err));
        const errorMsg = err.error || "";
        const details = err.details?.error?.message || "";

        if (errorMsg.includes("não configurada") || errorMsg.includes("not configured")) {
          alert(
            "API Key do Google não configurada.\n\n" +
            "Vá em Configurações (menu lateral) e adicione sua Google Routes API Key."
          );
        } else if (errorMsg.includes("permissão") || errorMsg.includes("PERMISSION_DENIED") || details.includes("PERMISSION_DENIED")) {
          alert(
            "API Key sem permissão.\n\n" +
            "Verifique se a Routes API está ativada no Google Cloud Console."
          );
        } else if (details.includes("could not be geocoded") || details.includes("GEOCODING")) {
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
            (errorMsg || details || "Verifique os endereços dos clientes e tente novamente.")
          );
        }
        return;
      }

      const data = await res.json();
      const { optimizedOrder, totalDistanceKm, totalDurationMinutes, deliveryDistanceKm, deliveryDurationMinutes, returnDurationMinutes } = data;

      // Reorder pedidos based on optimized order
      // optimizedOrder indices may include paradas (idx >= pedidos.length), filter those out
      const reordered = optimizedOrder
        .filter((idx: number) => idx < pedidos.length)
        .map((idx: number) => pedidos[idx])
        .filter(Boolean);
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

    // Include additional paradas
    paradas.forEach((p) => {
      if (p.endereco.trim()) {
        waypoints.push(encodeURIComponent(p.endereco.trim()));
      }
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

      {/* Paradas Adicionais */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm font-medium">
            <div className="flex items-center gap-2">
              <Star className="size-4" />
              Paradas Adicionais
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowGerenciarLocais(!showGerenciarLocais)}
            >
              <Settings className="size-4" />
              Gerenciar Locais
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add parada from locais frequentes */}
          <div className="flex gap-2">
            <select
              className="flex h-8 flex-1 items-center rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              value={selectedLocalId}
              onChange={(e) => setSelectedLocalId(e.target.value)}
            >
              <option value="">Selecione um local frequente...</option>
              {locaisFrequentes
                .filter((l) => !paradas.some((p) => p.id === l.id))
                .map((l) => (
                  <option key={l.id} value={String(l.id)}>
                    {l.nome} — {l.endereco}
                  </option>
                ))}
            </select>
            <Button size="sm" onClick={adicionarParada} disabled={!selectedLocalId} className="h-8">
              <Plus className="size-4" />
              Adicionar
            </Button>
          </div>

          {/* Added paradas */}
          {paradas.length > 0 && (
            <div className="space-y-2">
              {paradas.map((parada) => (
                <div
                  key={parada.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{parada.nome}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="size-3 shrink-0" />
                      {parada.endereco}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removerParada(parada.id)}
                  >
                    <X className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Gerenciar Locais Frequentes */}
          {showGerenciarLocais && (
            <div className="space-y-3 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Gerenciar Locais Frequentes
              </p>

              {/* Add new local */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Nome do local"
                  value={novoLocalNome}
                  onChange={(e) => setNovoLocalNome(e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  placeholder="Endereço completo"
                  value={novoLocalEndereco}
                  onChange={(e) => setNovoLocalEndereco(e.target.value)}
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  onClick={criarLocalFrequente}
                  disabled={savingLocal || !novoLocalNome.trim()}
                  className="h-8 shrink-0"
                >
                  <Plus className="size-4" />
                  {savingLocal ? "Salvando..." : "Criar"}
                </Button>
              </div>

              {/* List existing locais */}
              {locaisFrequentes.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum local frequente cadastrado.
                </p>
              ) : (
                <div className="space-y-1">
                  {locaisFrequentes.map((local) => (
                    <div
                      key={local.id}
                      className="flex items-center justify-between rounded-lg px-3 py-1.5 hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <span className="text-sm">{local.nome}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {local.endereco}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => excluirLocalFrequente(local.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
          <Link href="/entrega">
            <Button variant="outline">
              <Truck className="size-4" />
              Abrir Modo Entrega
            </Button>
          </Link>
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
