"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Trash2, Package, Download } from "lucide-react";
import { formatCurrency as formatPreço } from "@/lib/formatting";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { extrairPesoDoNome, extrairClasseDoNome } from "@/lib/produto-utils";
import type { Produto } from "@/lib/types";

const emptyForm = {
  nome: "",
  preco: "",
  tipoEstoque: "diario" as "diario" | "estoque",
  pesoUnitarioGramas: "",
  estoqueMinimo: "0",
  estoqueAtual: "0",
  unidadeVenda: "unidade",
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

  useEffect(() => { fetchProdutos() }, []);

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
      tipoEstoque: (produto.tipoEstoque || "diario") as "diario" | "estoque",
      pesoUnitarioGramas: produto.pesoUnitarioGramas ? String(produto.pesoUnitarioGramas) : "",
      estoqueMinimo: String(produto.estoqueMinimo || 0),
      estoqueAtual: String(produto.estoqueAtual || 0),
      unidadeVenda: produto.unidadeVenda || "unidade",
    });
    setDialogOpen(true);
  }

  function handleNew() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  // Auto-extract weight from name
  function handleNomeChange(nome: string) {
    const peso = extrairPesoDoNome(nome);
    setForm((f) => ({
      ...f,
      nome,
      pesoUnitarioGramas: peso !== null ? String(peso) : f.pesoUnitarioGramas,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      nome: form.nome,
      preco: parseFloat(form.preco),
      tipoEstoque: form.tipoEstoque,
      pesoUnitarioGramas: form.pesoUnitarioGramas ? parseFloat(form.pesoUnitarioGramas) : null,
      estoqueMinimo: parseInt(form.estoqueMinimo) || 0,
      estoqueAtual: parseInt(form.estoqueAtual) || 0,
      unidadeVenda: form.unidadeVenda,
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

  function exportCSV() {
    const header = 'Nome;Preco;Tipo;Classe;Peso (g);Est. Mínimo';
    const rows = produtos.map(p => {
      const classe = extrairClasseDoNome(p.nome) || "";
      return '"' + p.nome.replace(/"/g, '""') + '";' + p.preco.toFixed(2).replace('.', ',') + ';' + p.tipoEstoque + ';' + classe + ';' + (p.pesoUnitarioGramas || '') + ';' + (p.tipoEstoque === "estoque" ? p.estoqueMinimo : '');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'produtos.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // Separate products by type
  const frescos = produtos.filter(p => p.tipoEstoque === "diario");
  const acumulados = produtos.filter(p => p.tipoEstoque === "estoque");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Package className="size-5" />
            <h1 className="text-2xl font-semibold">Produtos</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Clique na linha para editar · Tipo, Classe e Peso usados pelo módulo de Estoque</p>
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
                <Label htmlFor="nome">Nome do produto</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => handleNomeChange(e.target.value)}
                  placeholder="Ex: Morango Classe A 500g"
                  required
                />
                <p className="text-[10px] text-muted-foreground">O peso será extraído automaticamente do nome (ex: 500g)</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
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

                <div className="space-y-2">
                  <Label htmlFor="tipoEstoque">Tipo de estoque</Label>
                  <select
                    id="tipoEstoque"
                    value={form.tipoEstoque}
                    onChange={(e) => setForm({ ...form, tipoEstoque: e.target.value as "diario" | "estoque" })}
                    className="flex h-9 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  >
                    <option value="diario">Fresco (ciclo diário)</option>
                    <option value="estoque">Acumulado (persistente)</option>
                  </select>
                </div>
              </div>

              {form.tipoEstoque === "diario" && (
                <div className="space-y-3 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Configuração — Fresco</p>
                  <div className="space-y-2">
                    <Label htmlFor="peso">Peso por unidade (gramas)</Label>
                    <Input
                      id="peso"
                      type="number"
                      step="1"
                      min="0"
                      value={form.pesoUnitarioGramas}
                      onChange={(e) => setForm({ ...form, pesoUnitarioGramas: e.target.value })}
                      placeholder="Ex: 500"
                    />
                    {form.pesoUnitarioGramas && <p className="text-[10px] text-muted-foreground">{(parseFloat(form.pesoUnitarioGramas) / 1000).toFixed(3)} kg/un</p>}
                  </div>
                </div>
              )}

              {form.tipoEstoque === "estoque" && (
                <div className="space-y-3 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Configuração — Acumulado</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="estoqueMinimo">Estoque mínimo (un)</Label>
                      <Input
                        id="estoqueMinimo"
                        type="number"
                        min="0"
                        step="1"
                        value={form.estoqueMinimo}
                        onChange={(e) => setForm({ ...form, estoqueMinimo: e.target.value })}
                      />
                    </div>
                    {!editingId && (
                      <div className="space-y-2">
                        <Label htmlFor="estoqueAtual">Estoque inicial (un)</Label>
                        <Input
                          id="estoqueAtual"
                          type="number"
                          min="0"
                          step="1"
                          value={form.estoqueAtual}
                          onChange={(e) => setForm({ ...form, estoqueAtual: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

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
        <TableSkeleton rows={5} cols={6} />
      ) : produtos.length === 0 ? (
        <EmptyState icon={Package} title="Nenhum produto cadastrado" actionLabel="+ Novo Produto" onAction={() => handleNew()} />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Peso (kg/un)</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Est. mínimo</TableHead>
                <TableHead className="text-right w-14" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {frescos.length > 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide bg-muted/30">
                    Frescos — ciclo diário
                  </TableCell>
                </TableRow>
              )}
              {frescos.map((produto) => (
                <ProdutoRow key={produto.id} produto={produto} onEdit={handleEdit} onDelete={handleDelete}
                  editingCell={editingCell} editingValue={editingValue} setEditingCell={setEditingCell}
                  setEditingValue={setEditingValue} saveInlineEdit={saveInlineEdit} />
              ))}
              {acumulados.length > 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide bg-muted/30 border-t border-border">
                    Acumulados — estoque persistente
                  </TableCell>
                </TableRow>
              )}
              {acumulados.map((produto) => (
                <ProdutoRow key={produto.id} produto={produto} onEdit={handleEdit} onDelete={handleDelete}
                  editingCell={editingCell} editingValue={editingValue} setEditingCell={setEditingCell}
                  setEditingValue={setEditingValue} saveInlineEdit={saveInlineEdit} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ProdutoRow({ produto, onEdit, onDelete, editingCell, editingValue, setEditingCell, setEditingValue, saveInlineEdit }: {
  produto: Produto; onEdit: (p: Produto) => void; onDelete: (id: number) => void;
  editingCell: {id: number, field: string} | null; editingValue: string;
  setEditingCell: (v: {id: number, field: string} | null) => void;
  setEditingValue: (v: string) => void;
  saveInlineEdit: (id: number, field: string, value: string) => void;
}) {
  const classe = extrairClasseDoNome(produto.nome);
  const pesoKg = produto.pesoUnitarioGramas ? (produto.pesoUnitarioGramas / 1000).toFixed(3) : null;

  return (
    <TableRow className="cursor-pointer" onDoubleClick={() => onEdit(produto)}>
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
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
            className="h-7 w-24 bg-transparent border-b border-primary text-sm outline-none text-right"
          />
        ) : (
          <span
            className="cursor-pointer hover:text-primary transition-colors font-mono text-sm"
            onClick={() => { setEditingCell({id: produto.id, field: "preco"}); setEditingValue(String(produto.preco)); }}
          >
            {formatPreço(produto.preco)}
          </span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={produto.tipoEstoque === "diario"
          ? "bg-muted text-muted-foreground border-border text-[10px]"
          : "bg-orange-500/10 text-orange-500 border-orange-500/20 text-[10px]"
        }>
          {produto.tipoEstoque === "diario" ? "fresco" : "acumulado"}
        </Badge>
      </TableCell>
      <TableCell>
        {classe ? (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px]">{classe}</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell className="text-right font-mono text-sm hidden sm:table-cell">
        {pesoKg || <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-right font-mono text-sm hidden sm:table-cell">
        {produto.tipoEstoque === "estoque" ? `${produto.estoqueMinimo} un` : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon-sm" title="Excluir" onClick={() => onDelete(produto.id)}>
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
