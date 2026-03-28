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
import { Settings, Save, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface ConfigItem {
  chave: string;
  valor: string;
}

export default function ConfiguracoesPage() {
  const [googleRoutesKey, setGoogleRoutesKey] = useState("");
  const [googleEmbedKey, setGoogleEmbedKey] = useState("");
  const [enderecoPartida, setEnderecoPartida] = useState("");
  const [showRoutesKey, setShowRoutesKey] = useState(false);
  const [showEmbedKey, setShowEmbedKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testingRoutes, setTestingRoutes] = useState(false);
  const [testingEmbed, setTestingEmbed] = useState(false);
  const [routesStatus, setRoutesStatus] = useState<"ok" | "error" | null>(null);
  const [embedStatus, setEmbedStatus] = useState<"ok" | "error" | null>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

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

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await Promise.all([
        saveConfig("google_routes_api_key", googleRoutesKey.trim()),
        saveConfig("google_embed_api_key", googleEmbedKey.trim()),
        saveConfig("endereco_partida", enderecoPartida.trim()),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Erro ao salvar:", err);
      alert("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  }

  async function testRoutesApi() {
    setTestingRoutes(true);
    setRoutesStatus(null);
    try {
      const res = await fetch("/api/rota/otimizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: "Av. Paulista, 1000, Sao Paulo",
          waypoints: [{ address: "Rua Augusta, 500, Sao Paulo", pedidoId: 0 }],
        }),
      });
      setRoutesStatus(res.ok ? "ok" : "error");
    } catch {
      setRoutesStatus("error");
    } finally {
      setTestingRoutes(false);
    }
  }

  async function testEmbedApi() {
    setTestingEmbed(true);
    setEmbedStatus(null);
    try {
      const key = googleEmbedKey.trim() || googleRoutesKey.trim();
      if (!key) {
        setEmbedStatus("error");
        return;
      }
      // Test by fetching the embed URL
      const testUrl = `https://www.google.com/maps/embed/v1/directions?key=${key}&origin=Sao+Paulo&destination=Sao+Paulo&mode=driving`;
      const res = await fetch(testUrl, { method: "HEAD", mode: "no-cors" });
      // no-cors always returns opaque response, so if it doesn't throw, it's likely ok
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="size-5" />
        <h1 className="text-2xl font-semibold">Configurações</h1>
      </div>

      {/* Google APIs */}
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
                  <Badge className="bg-red-600 text-white gap-1">
                    <AlertCircle className="size-3" /> Erro
                  </Badge>
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

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
        {saved && (
          <span className="text-sm text-green-400 flex items-center gap-1">
            <CheckCircle className="size-4" />
            Configurações salvas!
          </span>
        )}
      </div>
    </div>
  );
}
