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
import { Plus, Pencil, Trash2, Search, Users } from "lucide-react";

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

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

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

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar clientes..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
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
                <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                <TableHead>Bairro</TableHead>
                <TableHead className="hidden md:table-cell">Cidade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((cliente) => (
                <TableRow key={cliente.id}>
                  <TableCell className="font-medium">{cliente.nome}</TableCell>
                  <TableCell className="hidden sm:table-cell">{formatPhone(cliente.telefone)}</TableCell>
                  <TableCell>{cliente.bairro}</TableCell>
                  <TableCell className="hidden md:table-cell">{cliente.cidade}</TableCell>
                  <TableCell className="text-right">
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
