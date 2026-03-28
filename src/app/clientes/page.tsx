"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { Plus, Pencil, Trash2, Search, Users, SlidersHorizontal } from "lucide-react";

function formatPhone(phone: string) {
  const raw = phone.replace(/\D/g, "");
  if (raw.length === 11) return `(${raw.slice(0,2)}) ${raw.slice(2,7)}-${raw.slice(7)}`;
  if (raw.length === 10) return `(${raw.slice(0,2)}) ${raw.slice(2,6)}-${raw.slice(6)}`;
  return phone;
}

interface Cliente {
  id: number;
  nome: string;
  telefone: string;
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  enderecoAlternativo: string;
  observacoes: string;
}

const emptyForm = {
  nome: "",
  telefone: "",
  cep: "",
  rua: "",
  numero: "",
  bairro: "",
  cidade: "",
  enderecoAlternativo: "",
  observacoes: "",
};

const columnDefs = [
  { key: "nome", label: "Nome", required: true },
  { key: "telefone", label: "Telefone", defaultVisible: true },
  { key: "endereco", label: "Endereço", defaultVisible: false },
  { key: "bairro", label: "Bairro", defaultVisible: true },
  { key: "cidade", label: "Cidade", defaultVisible: true },
  { key: "cep", label: "CEP", defaultVisible: false },
  { key: "enderecoAlternativo", label: "Plus Code", defaultVisible: false },
  { key: "observacoes", label: "Observações", defaultVisible: false },
] as const;

const STORAGE_KEY = "clientes-columns";

function getDefaultVisibility(): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  for (const col of columnDefs) {
    defaults[col.key] = ("required" in col && col.required) ? true : ("defaultVisible" in col ? col.defaultVisible : false);
  }
  return defaults;
}

function loadVisibility(): Record<string, boolean> {
  if (typeof window === "undefined") return getDefaultVisibility();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const defaults = getDefaultVisibility();
      // Merge with defaults to handle new columns
      return { ...defaults, ...parsed };
    }
  } catch {
    // ignore
  }
  return getDefaultVisibility();
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(getDefaultVisibility);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);

  // Inline cell editing state
  const [editingCell, setEditingCell] = useState<{id: number, field: string} | null>(null);
  const [editingValue, setEditingValue] = useState("");

  // Load column visibility from localStorage on mount
  useEffect(() => {
    setColumnVisibility(loadVisibility());
  }, []);

  // Save to localStorage when visibility changes
  const updateColumnVisibility = useCallback((key: string, visible: boolean) => {
    setColumnVisibility((prev) => {
      const next = { ...prev, [key]: visible };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    if (!columnsOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node)) {
        setColumnsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [columnsOpen]);

  function colClass(key: string, responsiveClass?: string): string {
    if (!columnVisibility[key]) return "hidden";
    return responsiveClass ?? "";
  }

  async function buscarCep(cep: string) {
    const cleaned = cep.replace(/\D/g, "");
    if (cleaned.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((f) => ({
          ...f,
          rua: data.logradouro || f.rua,
          bairro: data.bairro || f.bairro,
          cidade: data.localidade || f.cidade,
        }));
      }
    } catch {
      // silently fail
    } finally {
      setBuscandoCep(false);
    }
  }

  useEffect(() => {
    fetchClientes();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchClientes();
    }, 300);
    return () => clearTimeout(timeout);
  }, [busca]);

  async function fetchClientes() {
    try {
      setLoading(true);
      const params = busca ? `?busca=${encodeURIComponent(busca)}` : "";
      const res = await fetch(`/api/clientes${params}`);
      const data = await res.json();
      setClientes(data);
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(cliente: Cliente) {
    setEditingId(cliente.id);
    setForm({
      nome: cliente.nome,
      telefone: cliente.telefone,
      rua: cliente.rua,
      numero: cliente.numero,
      cep: cliente.cep || "",
      bairro: cliente.bairro,
      cidade: cliente.cidade,
      enderecoAlternativo: cliente.enderecoAlternativo || "",
      observacoes: cliente.observacoes,
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

    try {
      if (editingId) {
        await fetch(`/api/clientes/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        await fetch("/api/clientes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }

      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      fetchClientes();
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
    }
  }

  async function saveInlineEdit(id: number, field: string, value: string) {
    setEditingCell(null);
    try {
      await fetch(`/api/clientes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      fetchClientes();
    } catch (error) {
      console.error("Erro ao salvar:", error);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;

    try {
      await fetch(`/api/clientes/${id}`, { method: "DELETE" });
      fetchClientes();
    } catch (error) {
      console.error("Erro ao excluir cliente:", error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-5" />
          <h1 className="text-2xl font-semibold">Clientes</h1>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button onClick={handleNew} />}>
            <Plus className="size-4" />
            Novo Cliente
          </DialogTrigger>

          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Cliente" : "Novo Cliente"}
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
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="(11) 99999-9999"
                  value={form.telefone}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
                    let f = raw;
                    if (raw.length > 6) f = `(${raw.slice(0,2)}) ${raw.slice(2,7)}-${raw.slice(7)}`;
                    else if (raw.length > 2) f = `(${raw.slice(0,2)}) ${raw.slice(2)}`;
                    else if (raw.length > 0) f = `(${raw}`;
                    setForm({ ...form, telefone: f });
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <div className="flex gap-2">
                  <Input
                    id="cep"
                    inputMode="numeric"
                    placeholder="00000-000"
                    value={form.cep}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
                      let formatted = raw;
                      if (raw.length > 5) formatted = `${raw.slice(0, 5)}-${raw.slice(5)}`;
                      setForm({ ...form, cep: formatted });
                      if (raw.length === 8) buscarCep(raw);
                    }}
                    className="w-36"
                  />
                  {buscandoCep && (
                    <span className="text-xs text-muted-foreground self-center">Buscando...</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Digite o CEP para preencher o endereço automaticamente.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rua">Rua</Label>
                  <Input
                    id="rua"
                    value={form.rua}
                    onChange={(e) => setForm({ ...form, rua: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero">Número</Label>
                  <Input
                    id="numero"
                    value={form.numero}
                    onChange={(e) =>
                      setForm({ ...form, numero: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input
                    id="bairro"
                    value={form.bairro}
                    onChange={(e) =>
                      setForm({ ...form, bairro: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    value={form.cidade}
                    onChange={(e) =>
                      setForm({ ...form, cidade: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="enderecoAlternativo">Plus Code / Local</Label>
                <Input
                  id="enderecoAlternativo"
                  value={form.enderecoAlternativo}
                  onChange={(e) =>
                    setForm({ ...form, enderecoAlternativo: e.target.value })
                  }
                  placeholder="Ex: 588C+R5 São Paulo"
                />
                <p className="text-xs text-muted-foreground">
                  Plus Code do Google Maps ou nome do local (ex: Shopping Ibirapuera, São Paulo). Quando preenchido, será usado no lugar do endereço para rotas de entrega.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Input
                  id="observacoes"
                  value={form.observacoes}
                  onChange={(e) =>
                    setForm({ ...form, observacoes: e.target.value })
                  }
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

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="relative" ref={columnsRef}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setColumnsOpen((v) => !v)}
            title="Colunas"
            className="h-9"
          >
            <SlidersHorizontal className="size-4" />
            <span className="hidden sm:inline">Colunas</span>
          </Button>
          {columnsOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-card border rounded-lg shadow-lg p-3 space-y-2 min-w-[180px]">
              {columnDefs.map((col) => (
                <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={columnVisibility[col.key] ?? true}
                    onChange={(e) => updateColumnVisibility(col.key, e.target.checked)}
                    disabled={"required" in col && col.required}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground">Carregando...</p>
      ) : clientes.length === 0 ? (
        <p className="text-center text-muted-foreground">
          Nenhum cliente encontrado.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className={colClass("telefone", "hidden sm:table-cell")}>Telefone</TableHead>
                <TableHead className={colClass("endereco")}>Endereço</TableHead>
                <TableHead className={colClass("bairro")}>Bairro</TableHead>
                <TableHead className={colClass("cidade", "hidden md:table-cell")}>Cidade</TableHead>
                <TableHead className={colClass("cep")}>CEP</TableHead>
                <TableHead className={colClass("enderecoAlternativo")}>Plus Code</TableHead>
                <TableHead className={colClass("observacoes")}>Observações</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((cliente) => (
                <TableRow key={cliente.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onDoubleClick={() => handleEdit(cliente)}>
                  <TableCell className="font-medium" onClick={(e) => e.stopPropagation()}>
                    {editingCell?.id === cliente.id && editingCell?.field === "nome" ? (
                      <input
                        autoFocus
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={() => saveInlineEdit(cliente.id, "nome", editingValue)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveInlineEdit(cliente.id, "nome", editingValue);
                          if (e.key === "Escape") setEditingCell(null);
                        }}
                        className="h-7 w-full bg-transparent border-b border-primary text-sm font-medium outline-none"
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:text-primary transition-colors"
                        onClick={() => { setEditingCell({id: cliente.id, field: "nome"}); setEditingValue(cliente.nome); }}
                      >
                        {cliente.nome}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className={colClass("telefone", "hidden sm:table-cell")} onClick={(e) => e.stopPropagation()}>
                    {editingCell?.id === cliente.id && editingCell?.field === "telefone" ? (
                      <input
                        autoFocus
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={() => saveInlineEdit(cliente.id, "telefone", editingValue)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveInlineEdit(cliente.id, "telefone", editingValue);
                          if (e.key === "Escape") setEditingCell(null);
                        }}
                        className="h-7 w-full bg-transparent border-b border-primary text-sm outline-none"
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:text-primary transition-colors"
                        onClick={() => { setEditingCell({id: cliente.id, field: "telefone"}); setEditingValue(cliente.telefone); }}
                      >
                        {formatPhone(cliente.telefone)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className={colClass("endereco")}>
                    {[cliente.rua, cliente.numero].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell className={colClass("bairro")} onClick={(e) => e.stopPropagation()}>
                    {editingCell?.id === cliente.id && editingCell?.field === "bairro" ? (
                      <input
                        autoFocus
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={() => saveInlineEdit(cliente.id, "bairro", editingValue)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveInlineEdit(cliente.id, "bairro", editingValue);
                          if (e.key === "Escape") setEditingCell(null);
                        }}
                        className="h-7 w-full bg-transparent border-b border-primary text-sm outline-none"
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:text-primary transition-colors"
                        onClick={() => { setEditingCell({id: cliente.id, field: "bairro"}); setEditingValue(cliente.bairro); }}
                      >
                        {cliente.bairro}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className={colClass("cidade", "hidden md:table-cell")} onClick={(e) => e.stopPropagation()}>
                    {editingCell?.id === cliente.id && editingCell?.field === "cidade" ? (
                      <input
                        autoFocus
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={() => saveInlineEdit(cliente.id, "cidade", editingValue)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveInlineEdit(cliente.id, "cidade", editingValue);
                          if (e.key === "Escape") setEditingCell(null);
                        }}
                        className="h-7 w-full bg-transparent border-b border-primary text-sm outline-none"
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:text-primary transition-colors"
                        onClick={() => { setEditingCell({id: cliente.id, field: "cidade"}); setEditingValue(cliente.cidade); }}
                      >
                        {cliente.cidade}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className={colClass("cep")}>{cliente.cep || "—"}</TableCell>
                  <TableCell className={colClass("enderecoAlternativo")}>{cliente.enderecoAlternativo || "—"}</TableCell>
                  <TableCell className={colClass("observacoes")}>{cliente.observacoes || "—"}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleEdit(cliente)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        onClick={() => handleDelete(cliente.id)}
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
