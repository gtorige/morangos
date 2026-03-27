"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function LoginPage() {
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState("");
  const [needsSetup, setNeedsSetup] = useState(false);
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNeedsSetup(false);

    if (!username.trim() || !senha) {
      setError("Preencha usuário e senha.");
      return;
    }

    setSigning(true);

    // Check if admin exists before trying to sign in
    try {
      const setupRes = await fetch("/api/setup");
      const setupData = await setupRes.json();
      if (!setupData.hasAdmin) {
        setNeedsSetup(true);
        setSigning(false);
        return;
      }
    } catch {
      // Continue with sign in attempt
    }

    const result = await signIn("credentials", {
      username: username.trim(),
      password: senha,
      redirect: false,
    });

    if (result?.error) {
      setError("Usuário ou senha incorretos.");
      setSigning(false);
      return;
    }

    window.location.href = "/";
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Morangos</h1>
          <p className="text-sm text-muted-foreground">
            Faça login para continuar
          </p>
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
              <p className="text-sm text-red-500 font-medium">{error}</p>
            )}
            {needsSetup && (
              <div className="rounded-lg border border-yellow-600/50 bg-yellow-950/20 p-3 text-sm">
                <p className="text-yellow-500 font-medium">Nenhum administrador cadastrado.</p>
                <a href="/setup" className="text-primary underline mt-1 inline-block">
                  Configurar agora
                </a>
              </div>
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
