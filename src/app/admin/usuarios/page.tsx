"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Shield, User, KeyRound } from "lucide-react";

interface Usuario {
  id: number;
  username: string;
  nome: string;
  isAdmin: boolean;
  createdAt: string;
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [changingPassword, setChangingPassword] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    username: "",
    nome: "",
    senha: "",
    isAdmin: false,
  });

  useEffect(() => {
    loadUsuarios();
  }, []);

  async function loadUsuarios() {
    const res = await fetch("/api/admin/usuarios");
    if (res.ok) {
      setUsuarios(await res.json());
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.username.trim() || !form.senha) {
      setError("Usuário e senha são obrigatórios.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Erro ao criar usuário.");
      setSaving(false);
      return;
    }

    setForm({ username: "", nome: "", senha: "", isAdmin: false });
    setShowForm(false);
    setSaving(false);
    loadUsuarios();
  }

  async function handleChangePassword(id: number) {
    setPasswordError("");
    if (!newPassword || newPassword.length < 4) {
      setPasswordError("Senha deve ter pelo menos 4 caracteres.");
      return;
    }

    const res = await fetch(`/api/admin/usuarios/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senha: newPassword }),
    });

    if (!res.ok) {
      const data = await res.json();
      setPasswordError(data.error || "Erro ao alterar senha.");
      return;
    }

    setChangingPassword(null);
    setNewPassword("");
    alert("Senha alterada com sucesso!");
  }

  async function handleDelete(id: number) {
    if (!confirm("Excluir este usuário?")) return;

    const res = await fetch(`/api/admin/usuarios/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Erro ao excluir.");
      return;
    }

    loadUsuarios();
  }

  if (loading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Novo Usuário</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-username">Usuário</Label>
                  <Input
                    id="new-username"
                    value={form.username}
                    onChange={(e) =>
                      setForm({ ...form, username: e.target.value })
                    }
                    placeholder="nome.usuario"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-nome">Nome</Label>
                  <Input
                    id="new-nome"
                    value={form.nome}
                    onChange={(e) =>
                      setForm({ ...form, nome: e.target.value })
                    }
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-senha">Senha</Label>
                  <Input
                    id="new-senha"
                    type="password"
                    value={form.senha}
                    onChange={(e) =>
                      setForm({ ...form, senha: e.target.value })
                    }
                    placeholder="••••••••"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    id="new-admin"
                    type="checkbox"
                    checked={form.isAdmin}
                    onChange={(e) =>
                      setForm({ ...form, isAdmin: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  <Label htmlFor="new-admin">Administrador</Label>
                </div>
              </div>
              {error && (
                <p className="text-sm text-red-500 font-medium">{error}</p>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Criar"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {usuarios.map((u) => (
          <Card key={u.id}>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-accent">
                    {u.isAdmin ? (
                      <Shield className="h-5 w-5 text-primary" />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{u.nome || u.username}</span>
                      {u.isAdmin && (
                        <Badge variant="default" className="text-[10px]">
                          Admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">@{u.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setChangingPassword(changingPassword === u.id ? null : u.id);
                      setNewPassword("");
                      setPasswordError("");
                    }}
                    className="text-muted-foreground hover:text-primary"
                    title="Alterar senha"
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(u.id)}
                    className="text-muted-foreground hover:text-destructive"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {changingPassword === u.id && (
                <div className="flex items-end gap-2 pl-13">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Nova Senha</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      autoFocus
                    />
                    {passwordError && (
                      <p className="text-xs text-red-500">{passwordError}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleChangePassword(u.id)}
                  >
                    Salvar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setChangingPassword(null); setNewPassword(""); }}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
