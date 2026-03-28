"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Save, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, MessageCircle, Plus, Trash2, Pencil, X } from "lucide-react";

interface ConfigItem {
  chave: string;
  valor: string;
}

interface MensagemWhatsApp {
  id: number;
  nome: string;
  texto: string;
}

type Tab = "principal" | "apis";

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState<Tab>("principal");

  const [googleRoutesKey, setGoogleRoutesKey] = useState("");
  const [googleEmbedKey, setGoogleEmbedKey] = useState("");
  const [enderecoPartida, setEnderecoPartida] = useState("");
  const [showRoutesKey, setShowRoutesKey] = useState(false);
  const [showEmbedKey, setShowEmbedKey] = useState(false);
  const [mensagens, setMensagens] = useState<MensagemWhatsApp[]>([]);
  const [novaMensagemNome, setNovaMensagemNome] = useState("");
  const [novaMensagemTexto, setNovaMensagemTexto] = useState("");
  const [savingMensagem, setSavingMensagem] = useState(false);
  const [editingMensagem, setEditingMensagem] = useState<MensagemWhatsApp | null>(null);

  const [savingPrincipal, setSavingPrincipal] = useState(false);
  const [savedPrincipal, setSavedPrincipal] = useState(false);
  const [savingApis, setSavingApis] = useState(false);
  const [savedApis, setSavedApis] = useState(false);
  const [testingRoutes, setTestingRoutes] = useState(false);
  const [testingEmbed, setTestingEmbed] = useState(false);
  const [routesStatus, setRoutesStatus] = useState<"ok" | "error" | null>(null);
  const [routesError, setRoutesError] = useState("");
  const [embedStatus, setEmbedStatus] = useState<"ok" | "error" | null>(null);

  useEffect(() => {
    loadConfigs();
    loadMensagens();
  }, []);

  async function loadMensagens() {
    const res = await fetch("/api/mensagens-whatsapp");
    if (res.ok) setMensagens(await res.json());
  }

  async function salvarMensagem() {
    if (!novaMensagemNome.trim() || !novaMensagemTexto.trim()) return;
    setSavingMensagem(true);
    try {
      if (editingMensagem) {
        await fetch(`/api/mensagens-whatsapp/${editingMensagem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome: novaMensagemNome, texto: novaMensagemTexto }),
        });
        setEditingMensagem(null);
      } else {
        await fetch("/api/mensagens-whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome: novaMensagemNome, texto: novaMensagemTexto }),
        });
      }
      setNovaMensagemNome("");
      setNovaMensagemTexto("");
      await loadMensagens();
    } finally {
      setSavingMensagem(false);
    }
  }

  async function excluirMensagem(id: number) {
    await fetch(`/api/mensagens-whatsapp/${id}`, { method: "DELETE" });
    await loadMensagens();
  }

  function editarMensagem(m: MensagemWhatsApp) {
    setEditingMensagem(m);
    setNovaMensagemNome(m.nome);
    setNovaMensagemTexto(m.texto);
  }

  function cancelarEdicao() {
    setEditingMensagem(null);
    setNovaMensagemNome("");
    setNovaMensagemTexto("");
  }

  async function loadConfigs() {
    try {
      const res = await fetch("/api/configuracoes");
      if (!res.ok) return;
      const configs: ConfigItem[] = await res.json();
      for (const c of configs) {
        switch (c.chave) {
          case "google_routes_api_key": setGoogleRoutesKey(c.valor); break;
          case "google_embed_api_key": setGoogleEmbedKey(c.valor); break;
          case "endereco_partida": setEnderecoPartida(c.valor); break;
        }
      }
    } catch (err) {
      console.error("Erro ao carregar configurações:", err);
    }
  }

  async function saveConfig(chave: string, valor: string) {
    await fetch("/api/configuracoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chave, valor }),
    });
  }

  async function handleSavePrincipal() {
    setSavingPrincipal(true);
    setSavedPrincipal(false);
    try {
      await saveConfig("endereco_partida", enderecoPartida.trim());
      setSavedPrincipal(true);
      setTimeout(() => setSavedPrincipal(false), 3000);
    } catch (err) {
      console.error("Erro ao salvar:", err);
      alert("Erro ao salvar configurações.");
    } finally {
      setSavingPrincipal(false);
    }
  }

  async function handleSaveApis() {
    setSavingApis(true);
    setSavedApis(false);
    try {
      await Promise.all([
        saveConfig("google_routes_api_key", googleRoutesKey.trim()),
        saveConfig("google_embed_api_key", googleEmbedKey.trim()),
      ]);
      setSavedApis(true);
      setTimeout(() => setSavedApis(false), 3000);
    } catch (err) {
      console.error("Erro ao salvar:", err);
      alert("Erro ao salvar configurações.");
    } finally {
      setSavingApis(false);
    }
  }

  async function testRoutesApi() {
    setTestingRoutes(true);
    setRoutesStatus(null);
    setRoutesError("");
    try {
      const res = await fetch("/api/rota/otimizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: "Av. Paulista, 1000, Sao Paulo",
          waypoints: [{ address: "Rua Augusta, 500, Sao Paulo", pedidoId: 0 }],
        }),
      });
      if (res.ok) {
        setRoutesStatus("ok");
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("Routes API test error:", err);
        setRoutesStatus("error");
        setRoutesError(err.error || err.details?.error?.message || `HTTP ${res.status}`);
      }
    } catch (e) {
      console.error("Routes API test exception:", e);
      setRoutesStatus("error");
      setRoutesError("Erro de conexão");
    } finally {
      setTestingRoutes(false);
    }
  }

  async function testEmbedApi() {
    setTestingEmbed(true);
    setEmbedStatus(null);
    try {
      const key = googleEmbedKey.trim() || googleRoutesKey.trim();
      if (!key) { setEmbedStatus("error"); return; }
      await fetch(`https://www.google.com/maps/embed/v1/directions?key=${key}&origin=Sao+Paulo&destination=Sao+Paulo&mode=driving`, { method: "HEAD", mode: "no-cors" });
      setEmbedStatus("ok");
    } catch {
      setEmbedStatus("error");
    } finally {
      setTestingEmbed(false);
    }
  }

  function maskKey(key: string) {
    if (!key) return "";
    if (key.length <= 8) return "****";
    return key.slice(0, 6) + "..." + key.slice(-4);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "principal", label: "Principal" },
    { id: "apis", label: "APIs" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="size-5" />
        <h1 className="text-2xl font-semibold">Configurações</h1>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Principal ── */}
      {tab === "principal" && (
        <>
          {/* Endereço de Partida */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Endereço de Partida</CardTitle>
              <p className="text-sm text-muted-foreground">
                Ponto de saída para otimização de rotas de entrega.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço completo ou Plus Code</Label>
                <Input
                  id="endereco"
                  value={enderecoPartida}
                  onChange={(e) => setEnderecoPartida(e.target.value)}
                  placeholder="Ex: 588C+R5 São Paulo ou Av. Dr. Altino Arantes, 235, São Paulo"
                />
                <p className="text-xs text-muted-foreground">
                  Aceita endereço completo (Rua, Número, Bairro, Cidade), Plus Code do Google Maps (ex: 588C+R5 São Paulo) ou nome de local conhecido.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Mensagens WhatsApp */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageCircle className="size-5 text-green-500" />
                Mensagens WhatsApp
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Mensagens pré-definidas para enviar aos clientes durante a entrega.
                Use <code className="bg-muted px-1 rounded text-xs">{"{nome}"}</code> para o nome do cliente e <code className="bg-muted px-1 rounded text-xs">{"{total}"}</code> para o valor do pedido.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {editingMensagem ? "Editar mensagem" : "Nova mensagem"}
                </p>
                <Input
                  placeholder="Nome da mensagem (ex: Chegando em 5 minutos)"
                  value={novaMensagemNome}
                  onChange={(e) => setNovaMensagemNome(e.target.value)}
                  className="h-8 text-sm"
                />
                <textarea
                  placeholder={"Texto da mensagem (ex: Olá {nome}, estamos chegando para entregar seus morangos em 5 minutos!)"}
                  value={novaMensagemTexto}
                  onChange={(e) => setNovaMensagemTexto(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 resize-none"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={salvarMensagem}
                    disabled={savingMensagem || !novaMensagemNome.trim() || !novaMensagemTexto.trim()}
                    className="h-8"
                  >
                    {savingMensagem ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    {editingMensagem ? "Salvar edição" : "Adicionar"}
                  </Button>
                  {editingMensagem && (
                    <Button size="sm" variant="ghost" onClick={cancelarEdicao} className="h-8">
                      <X className="size-4" /> Cancelar
                    </Button>
                  )}
                </div>
              </div>

              {mensagens.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">Nenhuma mensagem cadastrada.</p>
              ) : (
                <div className="space-y-2">
                  {mensagens.map((m) => (
                    <div key={m.id} className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{m.nome}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{m.texto}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon-sm" onClick={() => editarMensagem(m)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => excluirMensagem(m.id)}>
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSavePrincipal}
              disabled={savingPrincipal}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {savingPrincipal ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {savingPrincipal ? "Salvando..." : "Salvar"}
            </Button>
            {savedPrincipal && (
              <span className="text-sm text-green-400 flex items-center gap-1">
                <CheckCircle className="size-4" /> Salvo!
              </span>
            )}
          </div>
        </>
      )}

      {/* ── APIs ── */}
      {tab === "apis" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Google Maps APIs</CardTitle>
              <p className="text-sm text-muted-foreground">
                Chaves de API para otimização de rotas e preview do mapa.
                Você pode usar a mesma chave para ambos os serviços.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Routes API Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="routes-key">Routes API Key</Label>
                  <div className="flex items-center gap-2">
                    {routesStatus === "ok" && (
                      <Badge className="bg-green-600 text-white gap-1">
                        <CheckCircle className="size-3" /> Funcionando
                      </Badge>
                    )}
                    {routesStatus === "error" && (
                      <div className="flex flex-col items-end gap-1">
                        <Badge className="bg-red-600 text-white gap-1">
                          <AlertCircle className="size-3" /> Erro
                        </Badge>
                        {routesError && <span className="text-xs text-red-400 max-w-[300px] text-right">{routesError}</span>}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Usada para otimização automática de rotas de entrega.
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="routes-key"
                      type={showRoutesKey ? "text" : "password"}
                      value={googleRoutesKey}
                      onChange={(e) => setGoogleRoutesKey(e.target.value)}
                      placeholder="AIzaSy..."
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRoutesKey(!showRoutesKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showRoutesKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testRoutesApi}
                    disabled={testingRoutes || !googleRoutesKey.trim()}
                  >
                    {testingRoutes ? <Loader2 className="size-4 animate-spin" /> : "Testar"}
                  </Button>
                </div>
              </div>

              {/* Embed API Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="embed-key">Maps Embed API Key</Label>
                  <div className="flex items-center gap-2">
                    {embedStatus === "ok" && (
                      <Badge className="bg-green-600 text-white gap-1">
                        <CheckCircle className="size-3" /> Funcionando
                      </Badge>
                    )}
                    {embedStatus === "error" && (
                      <Badge className="bg-red-600 text-white gap-1">
                        <AlertCircle className="size-3" /> Erro
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Usada para preview do mapa na tela de rota. Deixe em branco para usar a mesma chave da Routes API.
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="embed-key"
                      type={showEmbedKey ? "text" : "password"}
                      value={googleEmbedKey}
                      onChange={(e) => setGoogleEmbedKey(e.target.value)}
                      placeholder={googleRoutesKey ? maskKey(googleRoutesKey) + " (mesma da Routes)" : "AIzaSy..."}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmbedKey(!showEmbedKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showEmbedKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testEmbedApi}
                    disabled={testingEmbed || (!googleEmbedKey.trim() && !googleRoutesKey.trim())}
                  >
                    {testingEmbed ? <Loader2 className="size-4 animate-spin" /> : "Testar"}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Como obter as chaves:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Acesse console.cloud.google.com</li>
                  <li>Crie um projeto</li>
                  <li>Ative: <strong>Routes API</strong> e <strong>Maps Embed API</strong></li>
                  <li>Vá em Credenciais e crie uma Chave de API</li>
                  <li>Cole a chave acima</li>
                </ol>
                <p className="mt-2">O plano gratuito inclui US$200/mês de crédito — suficiente para uso pessoal.</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSaveApis}
              disabled={savingApis}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {savingApis ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {savingApis ? "Salvando..." : "Salvar"}
            </Button>
            {savedApis && (
              <span className="text-sm text-green-400 flex items-center gap-1">
                <CheckCircle className="size-4" /> Salvo!
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
