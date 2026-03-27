"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, Trash2, Tag } from "lucide-react";

interface Produto {
  id: number;
  nome: string;
  preco: number;
}

interface Promocao {
  id: number;
  nome: string;
  produtoId: number;
  produto: Produto;
  tipo: string;
  precoPromocional: number;
  leveQuantidade: number | null;
  pagueQuantidade: number | null;
  dataInicio: string;
  dataFim: string;
  ativo: boolean;
}

interface FormData {
  nome: string;
  produtoId: string;
  tipo: string;
  precoPromocional: string;
  leveQuantidade: string;
  pagueQuantidade: string;
  dataInicio: string;
  dataFim: string;
  ativo: boolean;
}

const emptyForm: FormData = {
  nome: "",
  produtoId: "",
  tipo: "desconto",
  precoPromocional: "",
  leveQuantidade: "",
  pagueQuantidade: "",
  dataInicio: "",
  dataFim: "",
  ativo: true,
};

function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

export default function PromocoesPage() {
  const [items, setItems] = useState<Promocao[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function fetchItems() {
    try {
      const res = await fetch("/api/promocoes");
      const data = await res.json();
      setItems(data);
    } catch (error) {
      console.error("Erro ao buscar promoções:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProdutos() {
    try {
      const res = await fetch("/api/produtos");
      const data = await res.json();
      setProdutos(data);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
    }
  }

  useEffect(() => {
    fetchItems();
    fetchProdutos();
  }, []);

  function openNew() {
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(item: Promocao) {
    setForm({
      nome: item.nome,
      produtoId: String(item.produtoId),
      tipo: item.tipo || "desconto",
      precoPromocional: String(item.precoPromocional ?? ""),
      leveQuantidade: String(item.leveQuantidade ?? ""),
      pagueQuantidade: String(item.pagueQuantidade ?? ""),
      dataInicio: item.dataInicio,
      dataFim: item.dataFim,
      ativo: item.ativo,
    });
    setEditingId(item.id);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const body = {
      nome: form.nome,
      produtoId: Number(form.produtoId),
      tipo: form.tipo,
      precoPromocional: form.tipo === "desconto" ? parseFloat(form.precoPromocional) : undefined,
      leveQuantidade: form.tipo === "leve_x_pague_y" ? Number(form.leveQuantidade) : undefined,
      pagueQuantidade: form.tipo === "leve_x_pague_y" ? Number(form.pagueQuantidade) : undefined,
      dataInicio: form.dataInicio,
      dataFim: form.dataFim,
      ativo: form.ativo,
    };

    try {
      if (editingId) {
        await fetch(`/api/promocoes/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await fetch("/api/promocoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      fetchItems();
    } catch (error) {
      console.error("Erro ao salvar promoção:", error);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Deseja realmente excluir esta promoção?")) return;

    try {
      await fetch(`/api/promocoes/${id}`, { method: "DELETE" });
      fetchItems();
    } catch (error) {
      console.error("Erro ao excluir promoção:", error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="size-5" />
          <h1 className="text-2xl font-bold">Promoções</h1>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4" />
          Nova Promoção
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden sm:table-cell">Produto</TableHead>
              <TableHead className="hidden md:table-cell">Tipo</TableHead>
              <TableHead className="hidden md:table-cell">Início</TableHead>
              <TableHead className="hidden md:table-cell">Fim</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma promoção cadastrada
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.nome}</TableCell>
                  <TableCell className="hidden sm:table-cell">{item.produto?.nome}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {(item.tipo || "desconto") === "desconto" ? (
                      <span>Desconto &middot; {formatPrice(item.precoPromocional)}</span>
                    ) : (
                      <span>Leve {item.leveQuantidade} Pague {item.pagueQuantidade}</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{formatDate(item.dataInicio)}</TableCell>
                  <TableCell className="hidden md:table-cell">{formatDate(item.dataFim)}</TableCell>
                  <TableCell>
                    {item.ativo ? (
                      <Badge className="bg-green-600 text-white">Ativo</Badge>
                    ) : (
                      <Badge className="bg-red-600 text-white">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(item)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(item.id)}>
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
              {editingId ? "Editar Promoção" : "Nova Promoção"}
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
              <Label>Produto</Label>
              <select
                value={form.produtoId}
                onChange={(e) => setForm({ ...form, produtoId: e.target.value })}
                required
                className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              >
                <option value="">Selecione um produto</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                required
                className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              >
                <option value="desconto">Desconto no Preço</option>
                <option value="leve_x_pague_y">Leve X Pague Y</option>
              </select>
            </div>

            {form.tipo === "desconto" && (
              <div className="space-y-2">
                <Label htmlFor="precoPromocional">Preço Promocional</Label>
                <Input
                  id="precoPromocional"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.precoPromocional}
                  onChange={(e) =>
                    setForm({ ...form, precoPromocional: e.target.value })
                  }
                  required
                />
              </div>
            )}

            {form.tipo === "leve_x_pague_y" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="leveQuantidade">Leve (quantidade)</Label>
                  <Input
                    id="leveQuantidade"
                    type="number"
                    min="1"
                    step="1"
                    value={form.leveQuantidade}
                    onChange={(e) =>
                      setForm({ ...form, leveQuantidade: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pagueQuantidade">Pague (quantidade)</Label>
                  <Input
                    id="pagueQuantidade"
                    type="number"
                    min="1"
                    step="1"
                    value={form.pagueQuantidade}
                    onChange={(e) =>
                      setForm({ ...form, pagueQuantidade: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dataInicio">Data Início</Label>
                <Input
                  id="dataInicio"
                  type="date"
                  value={form.dataInicio}
                  onChange={(e) =>
                    setForm({ ...form, dataInicio: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataFim">Data Fim</Label>
                <Input
                  id="dataFim"
                  type="date"
                  value={form.dataFim}
                  onChange={(e) =>
                    setForm({ ...form, dataFim: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="ativo"
                type="checkbox"
                checked={form.ativo}
                onChange={(e) =>
                  setForm({ ...form, ativo: e.target.checked })
                }
                className="size-4 rounded border-input"
              />
              <Label htmlFor="ativo">Ativo</Label>
            </div>

            <DialogFooter>
              <Button type="submit">
                {editingId ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
