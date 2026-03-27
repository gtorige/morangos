"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function SetupPage() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    username: "",
    nome: "",
    senha: "",
    confirmarSenha: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.username.trim()) {
      setError("Digite um nome de usuário.");
      return;
    }
    if (form.senha.length < 4) {
      setError("Senha deve ter pelo menos 4 caracteres.");
      return;
    }
    if (form.senha !== form.confirmarSenha) {
      setError("As senhas não coincidem.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.username.trim(),
        nome: form.nome.trim() || form.username.trim(),
        senha: form.senha,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Erro ao criar administrador.");
      setSaving(false);
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8 space-y-4">
            <h2 className="text-xl font-bold text-green-500">Administrador criado!</h2>
            <p className="text-sm text-muted-foreground">
              Agora faça login com suas credenciais.
            </p>
            <a href="/login">
              <Button className="w-full mt-2">Ir para Login</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Configuração Inicial</h1>
          <p className="text-sm text-muted-foreground">
            Crie o administrador do sistema
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="admin"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Administrador"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmarSenha">Confirmar Senha</Label>
              <Input
                id="confirmarSenha"
                type="password"
                value={form.confirmarSenha}
                onChange={(e) =>
                  setForm({ ...form, confirmarSenha: e.target.value })
                }
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="text-sm text-red-500 font-medium">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Criando..." : "Criar Administrador"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
