"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Sprout } from "lucide-react";

export default function LoginPage() {
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!username.trim() || !senha) {
      setError("Preencha usuário e senha.");
      return;
    }

    setSigning(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: senha }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Usuário ou senha incorretos.");
        setSigning(false);
        return;
      }

      window.location.href = "/";
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setSigning(false);
    }
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen p-4">
      {/* Subtle radial gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.18_0.02_250)_0%,oklch(0.13_0_0)_70%)]" />

      <Card className="relative w-full max-w-sm">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="flex items-center justify-center">
            <div className="flex items-center justify-center size-14 rounded-2xl bg-primary/10 ring-1 ring-primary/20">
              <Sprout className="size-7 text-primary" />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-heading font-bold tracking-tight">Morangos</h1>
            <p className="text-sm text-muted-foreground">
              Faça login para continuar
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="seu usuário"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="text-sm text-red-400 font-medium">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={signing}>
              {signing ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
