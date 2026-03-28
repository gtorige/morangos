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
  Route,
  Clock,
  Loader2,
  Plus,
  Trash2,
  Star,
  X,
  Settings,
  Home,
  Save,
  ChevronDown,
  MessageCircle,
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
  cliente: Cliente;
  itens: PedidoItem[];
}

interface RotaInfo {
  totalDistanceKm: string;
  totalDurationMinutes: number;
  deliveryDistanceKm: string;
  deliveryDurationMinutes: number;
  returnDurationMinutes: number;
  mapUrl: string;
}

interface MensagemWhatsApp {
  id: number;
  nome: string;
  texto: string;
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

type ListItem =
  | { type: "pedido"; data: Pedido }
  | { type: "parada"; data: Parada };

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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

function fmtMin(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
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
  return [street, cliente.bairro].filter(Boolean).join(" – ");
}

const ROTA_STORAGE_KEY = "rota-lista";

function saveListaToStorage(lista: ListItem[]) {
  try { localStorage.setItem(ROTA_STORAGE_KEY, JSON.stringify(lista)); } catch {}
}

function buildListaOrdenada(pedidos: Pedido[], paradas: Parada[]): ListItem[] {
  return [
    ...pedidos.map((p) => ({ type: "pedido" as const, data: p })),
    ...paradas.map((p) => ({ type: "parada" as const, data: p })),
  ];
}

export default function RotaPage() {
  const [data, setData] = useState(todayString());
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [listaOrdenada, setListaOrdenada] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [rotaInfo, setRotaInfo] = useState<RotaInfo | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [mensagensWpp, setMensagensWpp] = useState<MensagemWhatsApp[]>([]);
  const [wppPickerId, setWppPickerId] = useState<number | null>(null);

  const [enderecoSalvo, setEnderecoSalvo] = useState("");

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
    fetch("/api/mensagens-whatsapp").then(r => r.ok ? r.json() : []).then(setMensagensWpp).catch(() => {});
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
    if (paradas.some((p) => p.id === local.id)) return;
    const novaParada: Parada = { id: local.id, nome: local.nome, endereco: local.endereco };
    const novasParadas = [...paradas, novaParada];
    setParadas(novasParadas);
    // Append to end of list
    setListaOrdenada((prev) => [...prev, { type: "parada", data: novaParada }]);
    setSelectedLocalId("");
    setRotaInfo(null);
  }

  function removerParada(id: number) {
    const novasParadas = paradas.filter((p) => p.id !== id);
    setParadas(novasParadas);
    setListaOrdenada((prev) => prev.filter((item) => !(item.type === "parada" && item.data.id === id)));
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
        removerParada(id);
        await fetchLocaisFrequentes();
      }
    } catch (error) {
      console.error("Erro ao excluir local:", error);
    }
  }

  async function fetchRota() {
    try {
      setLoading(true);
      const res = await fetch(`/api/rota?data=${data}`);
      const json = await res.json();
      setPedidos(json);
      // Rebuild list preserving paradas at end (clear optimized order on date change)
      setListaOrdenada(buildListaOrdenada(json, paradas));
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

      const respData = await res.json();
      const {
        optimizedOrder,
        totalDistanceKm,
        totalDurationMinutes,
        deliveryDistanceKm,
        deliveryDurationMinutes,
        returnDurationMinutes,
      } = respData;

      const numPedidos = pedidos.length;

      // Build combined ordered list (pedidos + paradas interleaved by optimized order)
      const novaLista: ListItem[] = (optimizedOrder as number[])
        .map((idx) => {
          if (idx < numPedidos) {
            return { type: "pedido" as const, data: pedidos[idx] };
          } else {
            const paradaIdx = idx - numPedidos;
            if (paradaIdx < paradas.length) {
              return { type: "parada" as const, data: paradas[paradaIdx] };
            }
            return null;
          }
        })
        .filter(Boolean) as ListItem[];

      setListaOrdenada(novaLista);
      saveListaToStorage(novaLista);

      // Update pedidos order too (for compatibility with actions)
      const reorderedPedidos = (optimizedOrder as number[])
        .filter((idx) => idx < numPedidos)
        .map((idx) => pedidos[idx])
        .filter(Boolean);
      setPedidos(reorderedPedidos);

      // Fetch embed map URL from server
      const originEnc = encodeURIComponent(enderecoSalvo);
      const wps = reorderedPedidos
        .map((p: Pedido) => encodeURIComponent(buildAddress(p.cliente)))
        .join("|");
      const mapRes = await fetch(`/api/rota/mapa?origin=${originEnc}&destination=${originEnc}&waypoints=${wps}`);
      let mapUrl = "";
      if (mapRes.ok) {
        const mapData = await mapRes.json();
        mapUrl = mapData.url || "";
      }

      setRotaInfo({ totalDistanceKm, totalDurationMinutes, deliveryDistanceKm, deliveryDurationMinutes, returnDurationMinutes, mapUrl });
      if (mapUrl) setShowMap(true);
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
      saveListaToStorage(listaOrdenada);
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

    // Use listaOrdenada to preserve optimized order (including paradas)
    listaOrdenada.forEach((item) => {
      if (item.type === "pedido") {
        waypoints.push(encodeURIComponent(buildAddress(item.data.cliente)));
      } else {
        if (item.data.endereco.trim()) {
          waypoints.push(encodeURIComponent(item.data.endereco.trim()));
        }
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
    const updated = [...listaOrdenada];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setListaOrdenada(updated);
    setRotaInfo(null);
  }

  function moveDown(index: number) {
    if (index === listaOrdenada.length - 1) return;
    const updated = [...listaOrdenada];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setListaOrdenada(updated);
    setRotaInfo(null);
  }

  const numPedidos = pedidos.length;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-2">
        <Truck className="size-5" />
        <h1 className="text-2xl font-semibold tracking-tight">Rota de Entrega</h1>
      </div>

      {/* Data */}
      <div className="space-y-1">
        <Label htmlFor="data" className="text-xs">Data</Label>
        <div className="flex gap-1.5 items-center">
          <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-full sm:w-44 h-8 text-sm" />
          <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setData(todayString())}>Hoje</Button>
        </div>
      </div>

      {/* Warning if no address configured */}
      {!enderecoSalvo && (
        <p className="text-sm text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
          Configure o endereço de partida em{" "}
          <Link href="/admin/configuracoes" className="underline font-medium">Configurações</Link>{" "}
          para otimizar a rota.
        </p>
      )}

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

      {/* Route info + mapa colapsável */}
      {rotaInfo && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
          <button
            onClick={() => rotaInfo.mapUrl && setShowMap(!showMap)}
            className={`w-full flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm text-left ${rotaInfo.mapUrl ? "cursor-pointer hover:bg-primary/10 transition-colors" : "cursor-default"}`}
          >
            <div className="flex items-center gap-1.5">
              <Route className="size-3.5 text-primary" />
              <span className="font-medium">{rotaInfo.deliveryDistanceKm} km</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="size-3.5" />
              <span>{fmtMin(rotaInfo.totalDurationMinutes)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Home className="size-3.5" />
              <span>volta +{fmtMin(rotaInfo.returnDurationMinutes)}</span>
            </div>
            {rotaInfo.mapUrl && (
              <ChevronDown className={`size-3.5 text-muted-foreground ml-auto transition-transform ${showMap ? "rotate-180" : ""}`} />
            )}
          </button>
          {showMap && rotaInfo.mapUrl && (
            <iframe
              src={rotaInfo.mapUrl}
              className="w-full h-[250px] sm:h-[400px] border-0 border-t border-primary/20"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          )}
        </div>
      )}

      <Separator />

      {/* Paradas Adicionais */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Star className="size-3.5" />
            Paradas Adicionais
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2 text-muted-foreground"
            onClick={() => setShowGerenciarLocais(!showGerenciarLocais)}
          >
            <Settings className="size-3" />
            Gerenciar Locais
          </Button>
        </div>

        <div className="flex gap-2">
          <select
            className="flex h-8 flex-1 items-center rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
            value={selectedLocalId}
            onChange={(e) => setSelectedLocalId(e.target.value)}
          >
            <option value="">Selecione um local para adicionar...</option>
            {locaisFrequentes
              .filter((l) => !paradas.some((p) => p.id === l.id))
              .map((l) => (
                <option key={l.id} value={String(l.id)}>
                  {l.nome} — {l.endereco}
                </option>
              ))}
          </select>
          <Button size="sm" onClick={adicionarParada} disabled={!selectedLocalId} className="h-8 shrink-0">
            <Plus className="size-4" />
            Adicionar
          </Button>
        </div>

        {/* Gerenciar Locais Frequentes */}
        {showGerenciarLocais && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
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

            {locaisFrequentes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum local frequente cadastrado.</p>
            ) : (
              <div className="space-y-1">
                {locaisFrequentes.map((local) => (
                  <div
                    key={local.id}
                    className="flex items-center justify-between rounded-lg px-2 py-1 hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <span className="text-sm">{local.nome}</span>
                      <span className="text-xs text-muted-foreground ml-2">{local.endereco}</span>
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
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : numPedidos === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          Nenhuma entrega pendente para esta data.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {numPedidos} entrega{numPedidos > 1 ? "s" : ""} pendente{numPedidos > 1 ? "s" : ""}
            {paradas.length > 0 && ` · ${paradas.length} parada${paradas.length > 1 ? "s" : ""}`}
          </p>

          {listaOrdenada.map((item, index) =>
            item.type === "pedido" ? (
              /* Pedido card */
              <Card key={`pedido-${item.data.id}`} className="cursor-pointer" onClick={() => setExpandedId(expandedId === item.data.id ? null : item.data.id)}>
                <CardContent className="py-1.5 px-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center size-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-tight truncate">{item.data.cliente.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">{buildDisplayAddress(item.data.cliente)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-sm font-bold">{fmt(item.data.total)}</span>
                      <Badge variant={item.data.situacaoPagamento === "Pago" ? "default" : "outline"} className="text-xs hidden sm:flex">
                        {item.data.situacaoPagamento}
                      </Badge>
                      <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); moveUp(index); }} disabled={index === 0}>
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); moveDown(index); }} disabled={index === listaOrdenada.length - 1}>
                        <ArrowDown className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {expandedId === item.data.id && (
                    <div className="mt-2 pt-2 border-t border-border space-y-2">
                      {item.data.itens.length > 0 && (
                        <div className="space-y-0.5">
                          {item.data.itens.map((it) => (
                            <div key={it.id} className="flex justify-between text-xs">
                              <span>{it.quantidade}x {it.produto.nome}</span>
                              <span className="text-muted-foreground">{fmt(it.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={() => marcarEntregue(item.data)} disabled={actionLoading === item.data.id || item.data.statusEntrega === "Entregue"} className="h-6 text-xs px-2 flex-1">
                          <Check className="size-3" />
                          Entregue
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => registrarPagamento(item.data)} disabled={actionLoading === item.data.id || item.data.situacaoPagamento === "Pago"} className="h-6 text-xs px-2 flex-1">
                          <CreditCard className="size-3" />
                          Pagar
                        </Button>
                        {item.data.cliente.telefone && mensagensWpp.length > 0 && (
                          <Button size="sm" variant="outline" onClick={() => setWppPickerId(wppPickerId === item.data.id ? null : item.data.id)} className="h-6 text-xs px-2">
                            <MessageCircle className="size-3 text-green-500" />
                          </Button>
                        )}
                      </div>
                      {wppPickerId === item.data.id && (
                        <div className="rounded-lg border border-border bg-muted/30 p-2 space-y-1" onClick={(e) => e.stopPropagation()}>
                          <p className="text-xs text-muted-foreground font-medium">Enviar mensagem:</p>
                          {mensagensWpp.map((m) => {
                            const preview = applyVars(m.texto, { nome: item.data.cliente.nome, total: fmt(item.data.total) });
                            return (
                              <button
                                key={m.id}
                                onClick={() => {
                                  window.open(buildWppUrl(item.data.cliente.telefone, preview), "_blank");
                                  setWppPickerId(null);
                                }}
                                className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted transition-colors"
                              >
                                <p className="text-xs font-medium">{m.nome}</p>
                                <p className="text-xs text-muted-foreground truncate">{preview}</p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              /* Parada card */
              <div
                key={`parada-${item.data.id}`}
                className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-1.5"
              >
                <span className="flex items-center justify-center size-6 rounded-full bg-muted text-muted-foreground text-xs font-semibold shrink-0">
                  {index + 1}
                </span>
                <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{item.data.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.data.endereco}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon-sm" onClick={() => moveUp(index)} disabled={index === 0}>
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => moveDown(index)} disabled={index === listaOrdenada.length - 1}>
                    <ArrowDown className="size-3.5" />
                  </Button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
