"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Package, Download } from "lucide-react";

interface Produto {
  id: number;
  nome: string;
  preco: number;
}

const emptyForm = {
  nome: "",
  preco: "",
};

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Inline cell editing state
  const [editingCell, setEditingCell] = useState<{id: number, field: string} | null>(null);
  const [editingValue, setEditingValue] = useState("");

  useEffect(() => {
    fetchProdutos();
  }, []);

  async function fetchProdutos() {
    try {
      setLoading(true);
      const res = await fetch("/api/produtos");
      if (!res.ok) return;
      const data = await res.json();
      setProdutos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(produto: Produto) {
    setEditingId(produto.id);
    setForm({
      nome: produto.nome,
      preco: String(produto.preco),
    });
    setDialogOpen(true);
  }

  function handleNew() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      nome: form.nome,
      preco: parseFloat(form.preco),
    };

    try {
      if (editingId) {
        await fetch(`/api/produtos/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/produtos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      fetchProdutos();
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
    }
  }

  async function saveInlineEdit(id: number, field: string, value: string) {
    setEditingCell(null);
    try {
      const payload = field === "preco" ? { [field]: parseFloat(value) || 0 } : { [field]: value };
      await fetch(`/api/produtos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      fetchProdutos();
    } catch (error) {
      console.error("Erro ao salvar:", error);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;

    try {
      const res = await fetch(`/api/produtos/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (res.status === 400) {
        alert(data.error);
        return;
      }

      if (res.status === 409 && data.requerConfirmacao) {
        if (!confirm(data.aviso)) return;
        const res2 = await fetch(`/api/produtos/${id}?confirmarPromocoes=true`, { method: "DELETE" });
        if (!res2.ok) {
          const err2 = await res2.json();
          alert(err2.error || "Erro ao excluir produto.");
          return;
        }
      }

      fetchProdutos();
    } catch (error) {
      console.error("Erro ao excluir produto:", error);
    }
  }

  function formatPreço(valor: number) {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function exportCSV() {
    const csv = ["Nome;Preço", ...produtos.map(p => `"${p.nome}";${p.preco.toFixed(2).replace(".", ",")}`).join('\n')];
    const blob = new Blob(['\uFEFF' + csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'produtos.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="size-5" />
          <h1 className="text-2xl font-semibold">Produtos</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="h-9 gap-1.5">
            <Download className="size-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button onClick={handleNew} />}>
            <Plus className="size-4" />
            Novo Produto
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Produto" : "Novo Produto"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preco">Preço (R$)</Label>
                <Input
                  id="preco"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.preco}
                  onChange={(e) => setForm({ ...form, preco: e.target.value })}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Salvar</Button>
              </div>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground">Carregando...</p>
      ) : produtos.length === 0 ? (
        <p className="text-center text-muted-foreground">
          Nenhum produto encontrado.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtos.map((produto) => (
                <TableRow key={produto.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onDoubleClick={() => handleEdit(produto)}>
                  <TableCell className="font-medium" onClick={(e) => e.stopPropagation()}>
                    {editingCell?.id === produto.id && editingCell?.field === "nome" ? (
                      <input
                        autoFocus
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={() => saveInlineEdit(produto.id, "nome", editingValue)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveInlineEdit(produto.id, "nome", editingValue);
                          if (e.key === "Escape") setEditingCell(null);
                        }}
                        className="h-7 w-full bg-transparent border-b border-primary text-sm font-medium outline-none"
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:text-primary transition-colors"
                        onClick={() => { setEditingCell({id: produto.id, field: "nome"}); setEditingValue(produto.nome); }}
                      >
                        {produto.nome}
                      </span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {editingCell?.id === produto.id && editingCell?.field === "preco" ? (
                      <input
                        autoFocus
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={() => saveInlineEdit(produto.id, "preco", editingValue)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveInlineEdit(produto.id, "preco", editingValue);
                          if (e.key === "Escape") setEditingCell(null);
                        }}
                        className="h-7 w-24 bg-transparent border-b border-primary text-sm outline-none"
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:text-primary transition-colors"
                        onClick={() => { setEditingCell({id: produto.id, field: "preco"}); setEditingValue(String(produto.preco)); }}
                      >
                        {formatPreço(produto.preco)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleEdit(produto)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        onClick={() => handleDelete(produto.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
