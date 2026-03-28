"use client";

import { useEffect, useState } from "react";
import { differenceInDays, parseISO, isToday, isPast } from "date-fns";
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
import { Plus, Pencil, Trash2, Receipt, Store, Tag, Check } from "lucide-react";

// ── Types ──

interface Conta {
  id: number;
  fornecedorNome: string;
  categoria: string;
  categoriaId: number | null;
  valor: number;
  vencimento: string;
  situacao: string;
}

interface ContaForm {
  fornecedorNome: string;
  categoriaId: string;
  valor: string;
  vencimento: string;
  situacao: string;
}

interface Fornecedor {
  id: number;
  nome: string;
  _count: { contas: number };
}

interface Categoria {
  id: number;
  nome: string;
  _count: { contas: number };
}

type Tab = "contas" | "fornecedores" | "categorias";

const emptyContaForm: ContaForm = {
  fornecedorNome: "",
  categoriaId: "",
  valor: "",
  vencimento: "",
  situacao: "Pendente",
};

// ── Helpers ──

function formatPrice(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function getRowClassName(conta: Conta) {
  if (conta.situacao !== "Pendente") return "";
  try {
    const venc = parseISO(conta.vencimento);
    if (isToday(venc) || isPast(venc)) return "bg-red-500/10 border-l-2 border-l-red-500";
    const diff = differenceInDays(venc, new Date());
    if (diff > 0 && diff <= 5) return "bg-yellow-500/10 border-l-2 border-l-yellow-500";
  } catch {}
  return "";
}

function getSituacaoBadge(conta: Conta) {
  if (conta.situacao === "Pago") return <Badge className="bg-green-600 text-white">Pago</Badge>;
  try {
    const venc = parseISO(conta.vencimento);
    if (isToday(venc) || isPast(venc)) return <Badge className="bg-red-600 text-white">Vencida</Badge>;
  } catch {}
  return <Badge className="bg-yellow-500 text-white">Pendente</Badge>;
}

// ── Component ──

export default function ContasPage() {
  const [tab, setTab] = useState<Tab>("contas");

  // Contas state
  const [contas, setContas] = useState<Conta[]>([]);
  const [contasLoading, setContasLoading] = useState(true);
  const [contaForm, setContaForm] = useState<ContaForm>(emptyContaForm);
  const [contaEditingId, setContaEditingId] = useState<number | null>(null);
  const [contaDialogOpen, setContaDialogOpen] = useState(false);

  // Fornecedores state
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [fornecedoresLoading, setFornecedoresLoading] = useState(true);
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [fornecedorEditingId, setFornecedorEditingId] = useState<number | null>(null);
  const [fornecedorDialogOpen, setFornecedorDialogOpen] = useState(false);
  const [fornecedorError, setFornecedorError] = useState("");

  // Categorias state
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriasLoading, setCategoriasLoading] = useState(true);
  const [categoriaNome, setCategoriaNome] = useState("");
  const [categoriaDialogOpen, setCategoriaDialogOpen] = useState(false);
  const [categoriaError, setCategoriaError] = useState("");

  // Fornecedor names for autocomplete
  const fornecedorNames = fornecedores.map((f) => f.nome);

  useEffect(() => {
    fetchContas();
    fetchFornecedores();
    fetchCategorias();
  }, []);

  // ── Contas CRUD ──

  async function fetchContas() {
    try {
      setContasLoading(true);
      const res = await fetch("/api/contas");
      setContas(await res.json());
    } catch (e) {
      console.error("Erro ao buscar contas:", e);
    } finally {
      setContasLoading(false);
    }
  }

  function openNewConta() {
    setContaForm(emptyContaForm);
    setContaEditingId(null);
    setContaDialogOpen(true);
  }

  function openEditConta(item: Conta) {
    setContaForm({
      fornecedorNome: item.fornecedorNome,
      categoriaId: item.categoriaId ? String(item.categoriaId) : "",
      valor: String(item.valor),
      vencimento: item.vencimento,
      situacao: item.situacao,
    });
    setContaEditingId(item.id);
    setContaDialogOpen(true);
  }

  async function handleContaSubmit(e: React.FormEvent) {
    e.preventDefault();
    const catId = contaForm.categoriaId ? Number(contaForm.categoriaId) : null;
    const catNome = catId ? (categorias.find((c) => c.id === catId)?.nome ?? "") : "";
    const body = {
      fornecedorNome: contaForm.fornecedorNome,
      categoria: catNome,
      categoriaId: catId,
      valor: parseFloat(contaForm.valor),
      vencimento: contaForm.vencimento,
      situacao: contaForm.situacao,
    };
    try {
      if (contaEditingId) {
        await fetch(`/api/contas/${contaEditingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        await fetch("/api/contas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      setContaDialogOpen(false);
      setContaForm(emptyContaForm);
      setContaEditingId(null);
      fetchContas();
    } catch (e) {
      console.error("Erro ao salvar conta:", e);
    }
  }

  async function handleDeleteConta(id: number) {
    if (!confirm("Deseja realmente excluir esta conta?")) return;
    try {
      await fetch(`/api/contas/${id}`, { method: "DELETE" });
      fetchContas();
    } catch (e) {
      console.error("Erro ao excluir conta:", e);
    }
  }

  async function handleMarkPago(id: number) {
    try {
      await fetch(`/api/contas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situacao: "Pago" }),
      });
      fetchContas();
    } catch (e) {
      console.error("Erro ao marcar como pago:", e);
    }
  }

  // ── Fornecedores CRUD ──

  async function fetchFornecedores() {
    try {
      setFornecedoresLoading(true);
      const res = await fetch("/api/fornecedores");
      setFornecedores(await res.json());
    } catch (e) {
      console.error("Erro ao buscar fornecedores:", e);
    } finally {
      setFornecedoresLoading(false);
    }
  }

  function openNewFornecedor() {
    setFornecedorNome("");
    setFornecedorEditingId(null);
    setFornecedorError("");
    setFornecedorDialogOpen(true);
  }

  function openEditFornecedor(item: Fornecedor) {
    setFornecedorNome(item.nome);
    setFornecedorEditingId(item.id);
    setFornecedorError("");
    setFornecedorDialogOpen(true);
  }

  async function handleFornecedorSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFornecedorError("");
    try {
      const url = fornecedorEditingId ? `/api/fornecedores/${fornecedorEditingId}` : "/api/fornecedores";
      const method = fornecedorEditingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: fornecedorNome }) });
      if (!res.ok) {
        const data = await res.json();
        setFornecedorError(data.error || "Erro ao salvar");
        return;
      }
      setFornecedorDialogOpen(false);
      fetchFornecedores();
    } catch (e) {
      console.error("Erro ao salvar fornecedor:", e);
      setFornecedorError("Erro ao salvar fornecedor");
    }
  }

  async function handleDeleteFornecedor(id: number) {
    if (!confirm("Deseja realmente excluir este fornecedor?")) return;
    try {
      const res = await fetch(`/api/fornecedores/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Erro ao excluir");
        return;
      }
      fetchFornecedores();
    } catch (e) {
      console.error("Erro ao excluir fornecedor:", e);
    }
  }

  // ── Categorias CRUD ──

  async function fetchCategorias() {
    try {
      setCategoriasLoading(true);
      const res = await fetch("/api/categorias");
      setCategorias(await res.json());
    } catch (e) {
      console.error("Erro ao buscar categorias:", e);
    } finally {
      setCategoriasLoading(false);
    }
  }

  function openNewCategoria() {
    setCategoriaNome("");
    setCategoriaError("");
    setCategoriaDialogOpen(true);
  }

  async function handleCategoriaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCategoriaError("");
    try {
      const res = await fetch("/api/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: categoriaNome }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCategoriaError(data.error || "Erro ao salvar");
        return;
      }
      setCategoriaDialogOpen(false);
      fetchCategorias();
    } catch (e) {
      console.error("Erro ao salvar categoria:", e);
      setCategoriaError("Erro ao salvar categoria");
    }
  }

  async function handleDeleteCategoria(id: number) {
    if (!confirm("Deseja realmente excluir esta categoria?")) return;
    try {
      const res = await fetch(`/api/categorias/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Erro ao excluir");
        return;
      }
      fetchCategorias();
    } catch (e) {
      console.error("Erro ao excluir categoria:", e);
    }
  }

  // ── Helper: get categoria name for display ──

  function getCategoriaNome(conta: Conta) {
    if (conta.categoriaId) {
      const cat = categorias.find((c) => c.id === conta.categoriaId);
      if (cat) return cat.nome;
    }
    return conta.categoria || "";
  }

  // ── Render ──

  const tabs: { key: Tab; label: string; icon: typeof Receipt }[] = [
    { key: "contas", label: "Contas", icon: Receipt },
    { key: "fornecedores", label: "Fornecedores", icon: Store },
    { key: "categorias", label: "Categorias", icon: Tag },
  ];

  function getAddButtonLabel() {
    if (tab === "contas") return "Nova Conta";
    if (tab === "fornecedores") return "Novo Fornecedor";
    return "Nova Categoria";
  }

  function handleAddButton() {
    if (tab === "contas") openNewConta();
    else if (tab === "fornecedores") openNewFornecedor();
    else openNewCategoria();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="size-5" />
          <h1 className="text-2xl font-semibold">Financeiro</h1>
        </div>
        <Button onClick={handleAddButton}>
          <Plus className="size-4" />
          {getAddButtonLabel()}
        </Button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ═══ CONTAS TAB ═══ */}
      {tab === "contas" && (
        <>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="hidden sm:table-cell">Vencimento</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contasLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                  </TableRow>
                ) : contas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma conta cadastrada</TableCell>
                  </TableRow>
                ) : (
                  contas.map((item) => (
                    <TableRow key={item.id} className={`cursor-pointer hover:bg-accent/50 transition-colors ${getRowClassName(item)}`} onDoubleClick={() => openEditConta(item)}>
                      <TableCell className="font-medium">{item.fornecedorNome}</TableCell>
                      <TableCell className="hidden sm:table-cell">{getCategoriaNome(item)}</TableCell>
                      <TableCell>{formatPrice(item.valor)}</TableCell>
                      <TableCell className="hidden sm:table-cell">{formatDate(item.vencimento)}</TableCell>
                      <TableCell>{getSituacaoBadge(item)}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {item.situacao === "Pendente" && (
                            <Button variant="ghost" size="icon-sm" onClick={() => handleMarkPago(item.id)} title="Marcar como pago">
                              <Check className="size-4 text-green-500" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon-sm" onClick={() => openEditConta(item)}><Pencil className="size-4" /></Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteConta(item.id)}><Trash2 className="size-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Conta Dialog */}
          <Dialog open={contaDialogOpen} onOpenChange={setContaDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{contaEditingId ? "Editar Conta" : "Nova Conta"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleContaSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fornecedor">Fornecedor</Label>
                  <Input id="fornecedor" list="fornecedor-suggestions" value={contaForm.fornecedorNome} onChange={(e) => setContaForm({ ...contaForm, fornecedorNome: e.target.value })} required />
                  <datalist id="fornecedor-suggestions">
                    {fornecedorNames.map((s) => (<option key={s} value={s} />))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria</Label>
                  <select
                    id="categoria"
                    value={contaForm.categoriaId}
                    onChange={(e) => setContaForm({ ...contaForm, categoriaId: e.target.value })}
                    className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  >
                    <option value="">Sem categoria</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor</Label>
                  <Input id="valor" type="number" step="0.01" min="0" value={contaForm.valor} onChange={(e) => setContaForm({ ...contaForm, valor: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vencimento">Vencimento</Label>
                  <Input id="vencimento" type="date" value={contaForm.vencimento} onChange={(e) => setContaForm({ ...contaForm, vencimento: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Situação</Label>
                  <select value={contaForm.situacao} onChange={(e) => setContaForm({ ...contaForm, situacao: e.target.value })} className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50">
                    <option value="Pendente">Pendente</option>
                    <option value="Pago">Pago</option>
                  </select>
                </div>
                <DialogFooter>
                  <Button type="submit">{contaEditingId ? "Salvar" : "Criar"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ═══ FORNECEDORES TAB ═══ */}
      {tab === "fornecedores" && (
        <>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-center">Contas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fornecedoresLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                  </TableRow>
                ) : fornecedores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Nenhum fornecedor cadastrado</TableCell>
                  </TableRow>
                ) : (
                  fornecedores.map((item) => (
                    <TableRow key={item.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onDoubleClick={() => openEditFornecedor(item)}>
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell className="text-center"><Badge variant="outline">{item._count.contas}</Badge></TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => openEditFornecedor(item)}><Pencil className="size-4" /></Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteFornecedor(item.id)}><Trash2 className="size-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Fornecedor Dialog */}
          <Dialog open={fornecedorDialogOpen} onOpenChange={setFornecedorDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{fornecedorEditingId ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleFornecedorSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input id="nome" value={fornecedorNome} onChange={(e) => setFornecedorNome(e.target.value)} required autoFocus />
                </div>
                {fornecedorError && <p className="text-sm text-destructive">{fornecedorError}</p>}
                <DialogFooter>
                  <Button type="submit">{fornecedorEditingId ? "Salvar" : "Criar"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ═══ CATEGORIAS TAB ═══ */}
      {tab === "categorias" && (
        <>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-center">Contas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoriasLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                  </TableRow>
                ) : categorias.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Nenhuma categoria cadastrada</TableCell>
                  </TableRow>
                ) : (
                  categorias.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell className="text-center"><Badge variant="outline">{item._count.contas}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteCategoria(item.id)}><Trash2 className="size-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Categoria Dialog */}
          <Dialog open={categoriaDialogOpen} onOpenChange={setCategoriaDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nova Categoria</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCategoriaSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="categoriaNome">Nome</Label>
                  <Input id="categoriaNome" value={categoriaNome} onChange={(e) => setCategoriaNome(e.target.value)} required autoFocus />
                </div>
                {categoriaError && <p className="text-sm text-destructive">{categoriaError}</p>}
                <DialogFooter>
                  <Button type="submit">Criar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
