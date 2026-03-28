"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Store } from "lucide-react";

interface Fornecedor {
  id: number;
  nome: string;
  _count: { contas: number };
}

export default function FornecedoresPage() {
  const [items, setItems] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState("");

  async function fetchItems() {
    try {
      const res = await fetch("/api/fornecedores");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error("Erro ao buscar fornecedores:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchItems();
  }, []);

  function openNew() {
    setNome("");
    setEditingId(null);
    setError("");
    setDialogOpen(true);
  }

  function openEdit(item: Fornecedor) {
    setNome(item.nome);
    setEditingId(item.id);
    setError("");
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      const url = editingId
        ? `/api/fornecedores/${editingId}`
        : "/api/fornecedores";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erro ao salvar");
        return;
      }

      setDialogOpen(false);
      fetchItems();
    } catch (err) {
      console.error("Erro ao salvar fornecedor:", err);
      setError("Erro ao salvar fornecedor");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Deseja realmente excluir este fornecedor?")) return;

    try {
      const res = await fetch(`/api/fornecedores/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Erro ao excluir");
        return;
      }
      fetchItems();
    } catch (err) {
      console.error("Erro ao excluir fornecedor:", err);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="size-5" />
          <h1 className="text-2xl font-bold">Fornecedores</h1>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4" />
          Novo Fornecedor
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-center">Contas</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center py-8 text-muted-foreground"
                >
                  Carregando...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center py-8 text-muted-foreground"
                >
                  Nenhum fornecedor cadastrado
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onDoubleClick={() => openEdit(item)}>
                  <TableCell className="font-medium">{item.nome}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{item._count.contas}</Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Fornecedor" : "Novo Fornecedor"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <DialogFooter>
              <Button type="submit">{editingId ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
