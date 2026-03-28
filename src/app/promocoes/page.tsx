"use client";

import { useEffect, useState, useRef } from "react";
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
import { Plus, Pencil, Trash2, Tag, SlidersHorizontal, Download, ChevronUp, ChevronDown } from "lucide-react";

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
  quantidadeMinima: number | null;
  produtoId2: number | null;
  produto2Nome?: string;
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
  quantidadeMinima: string;
  produtoId2: string;
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
  quantidadeMinima: "",
  produtoId2: "",
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

function tipoLabel(item: Promocao, produtos: Produto[]): string {
  switch (item.tipo) {
    case "desconto":
      return `Desconto · ${formatPrice(item.precoPromocional)}`;
    case "leve_x_pague_y":
      return `Leve ${item.leveQuantidade} Pague ${item.pagueQuantidade}`;
    case "quantidade_minima": {
      const min = item.quantidadeMinima ?? 0;
      return `Acima de ${min} un. · ${formatPrice(item.precoPromocional)}`;
    }
    case "compra_casada": {
      const p2 = produtos.find((p) => p.id === item.produtoId2);
      return `Casada com ${p2?.nome ?? "?"} · ${formatPrice(item.precoPromocional)}`;
    }
    default:
      return item.tipo;
  }
}

type ColKey = 'nome' | 'produto' | 'tipo' | 'inicio' | 'fim' | 'ativo';

const COLUNAS_DEFAULT: { key: ColKey; label: string; visible: boolean; required?: boolean }[] = [
  { key: 'nome', label: 'Nome', visible: true, required: true },
  { key: 'produto', label: 'Produto', visible: true },
  { key: 'tipo', label: 'Tipo / Condição', visible: true },
  { key: 'inicio', label: 'Início', visible: false },
  { key: 'fim', label: 'Fim', visible: false },
  { key: 'ativo', label: 'Ativo', visible: true },
];

const STORAGE_KEY = 'promocoes-columns-v1';

function loadColunas(): typeof COLUNAS_DEFAULT {
  if (typeof window === 'undefined') return COLUNAS_DEFAULT;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const keys = new Set(parsed.map((c: { key: string }) => c.key));
        const missing = COLUNAS_DEFAULT.filter(c => !keys.has(c.key));
        return [...parsed, ...missing];
      }
    }
  } catch {}
  return COLUNAS_DEFAULT;
}

export default function PromocoesPage() {
  const [items, setItems] = useState<Promocao[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [colunasConfig, setColunasConfig] = useState(COLUNAS_DEFAULT);
  const [colunasOpen, setColunasOpen] = useState(false);
  const colunasRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setColunasConfig(loadColunas()); }, []);

  useEffect(() => {
    if (!colunasOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (colunasRef.current && !colunasRef.current.contains(e.target as Node)) setColunasOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [colunasOpen]);

  function moveCol(i: number, dir: -1 | 1) {
    setColunasConfig(prev => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function toggleCol(key: ColKey) {
    setColunasConfig(prev => {
      const next = prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function exportCSV() {
    const visCols = colunasConfig.filter(c => c.visible);
    const header = visCols.map(c => c.label);
    const csvRows = items.map(item => visCols.map(c => {
      switch (c.key) {
        case 'nome': return item.nome;
        case 'produto': return item.produto?.nome ?? '';
        case 'tipo': return tipoLabel(item, produtos);
        case 'inicio': return formatDate(item.dataInicio);
        case 'fim': return formatDate(item.dataFim);
        case 'ativo': return item.ativo ? 'Ativo' : 'Inativo';
        default: return '';
      }
    }));
    const csv = [header, ...csvRows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'promocoes.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  async function fetchItems() {
    try {
      const res = await fetch("/api/promocoes");
      if (!res.ok) return;
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao buscar promoções:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProdutos() {
    try {
      const res = await fetch("/api/produtos");
      if (!res.ok) return;
      const data = await res.json();
      setProdutos(Array.isArray(data) ? data : []);
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
      quantidadeMinima: String(item.quantidadeMinima ?? ""),
      produtoId2: String(item.produtoId2 ?? ""),
      dataInicio: item.dataInicio,
      dataFim: item.dataFim,
      ativo: item.ativo,
    });
    setEditingId(item.id);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const body: Record<string, unknown> = {
      nome: form.nome,
      produtoId: Number(form.produtoId),
      tipo: form.tipo,
      dataInicio: form.dataInicio,
      dataFim: form.dataFim,
      ativo: form.ativo,
    };

    if (form.tipo === "desconto") {
      body.precoPromocional = parseFloat(form.precoPromocional);
    } else if (form.tipo === "leve_x_pague_y") {
      body.leveQuantidade = Number(form.leveQuantidade);
      body.pagueQuantidade = Number(form.pagueQuantidade);
    } else if (form.tipo === "quantidade_minima") {
      body.quantidadeMinima = Number(form.quantidadeMinima);
      body.precoPromocional = parseFloat(form.precoPromocional);
    } else if (form.tipo === "compra_casada") {
      body.produtoId2 = Number(form.produtoId2);
      body.precoPromocional = parseFloat(form.precoPromocional);
    }

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

  const visCols = colunasConfig.filter(c => c.visible);

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

      <div className="flex justify-end gap-2">
        <div className="relative" ref={colunasRef}>
          <Button variant="outline" size="sm" onClick={() => setColunasOpen(v => !v)} className="h-9">
            <SlidersHorizontal className="size-4" />
            <span className="hidden sm:inline">Colunas</span>
          </Button>
          {colunasOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-card border rounded-lg shadow-lg p-3 space-y-1 min-w-[200px]">
              {colunasConfig.map((col, i) => (
                <div key={col.key} className="flex items-center gap-1">
                  <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                    <input type="checkbox" checked={col.visible} onChange={() => toggleCol(col.key)} disabled={col.required} />
                    {col.label}
                  </label>
                  <div className="flex gap-0.5">
                    <button onClick={() => moveCol(i, -1)} disabled={i === 0} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded"><ChevronUp className="size-3" /></button>
                    <button onClick={() => moveCol(i, 1)} disabled={i === colunasConfig.length - 1} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded"><ChevronDown className="size-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="h-9">
          <Download className="size-4" />
          <span className="hidden sm:inline">CSV</span>
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {visCols.map(col => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={visCols.length + 1} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visCols.length + 1} className="text-center py-8 text-muted-foreground">
                  Nenhuma promoção cadastrada
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onDoubleClick={() => openEdit(item)}>
                  {visCols.map(col => {
                    switch (col.key) {
                      case 'nome':
                        return <TableCell key={col.key} className="font-medium">{item.nome}</TableCell>;
                      case 'produto':
                        return <TableCell key={col.key}>{item.produto?.nome}</TableCell>;
                      case 'tipo':
                        return <TableCell key={col.key} className="text-sm text-muted-foreground">{tipoLabel(item, produtos)}</TableCell>;
                      case 'inicio':
                        return <TableCell key={col.key}>{formatDate(item.dataInicio)}</TableCell>;
                      case 'fim':
                        return <TableCell key={col.key}>{formatDate(item.dataFim)}</TableCell>;
                      case 'ativo':
                        return (
                          <TableCell key={col.key}>
                            {item.ativo ? (
                              <Badge className="bg-green-600 text-white">Ativo</Badge>
                            ) : (
                              <Badge className="bg-red-600 text-white">Inativo</Badge>
                            )}
                          </TableCell>
                        );
                      default:
                        return <TableCell key={col.key} />;
                    }
                  })}
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
                <option value="quantidade_minima">Acima de X unidades → preço especial</option>
                <option value="compra_casada">Compra Casada (leva 2 produtos)</option>
              </select>
            </div>

            {/* Desconto */}
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

            {/* Leve X Pague Y */}
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

            {/* Quantidade mínima */}
            {form.tipo === "quantidade_minima" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantidadeMinima">A partir de (un.)</Label>
                  <Input
                    id="quantidadeMinima"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="ex: 10"
                    value={form.quantidadeMinima}
                    onChange={(e) =>
                      setForm({ ...form, quantidadeMinima: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="precoPromocionalQty">Preço por unidade</Label>
                  <Input
                    id="precoPromocionalQty"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="ex: 4,50"
                    value={form.precoPromocional}
                    onChange={(e) =>
                      setForm({ ...form, precoPromocional: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
            )}

            {/* Compra casada */}
            {form.tipo === "compra_casada" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Produto parceiro (deve estar no mesmo pedido)</Label>
                  <select
                    value={form.produtoId2}
                    onChange={(e) => setForm({ ...form, produtoId2: e.target.value })}
                    required
                    className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  >
                    <option value="">Selecione o segundo produto</option>
                    {produtos
                      .filter((p) => String(p.id) !== form.produtoId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="precoPromocionalCasada">Preço promocional do produto parceiro</Label>
                  <Input
                    id="precoPromocionalCasada"
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
