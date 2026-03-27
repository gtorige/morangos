"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Repeat, Play, Calendar } from "lucide-react";

interface Produto { id: number; nome: string; preco: number }
interface Cliente { id: number; nome: string; bairro: string }
interface FormaPag { id: number; nome: string }
interface RecItem { id: number; produtoId: number; quantidade: number; precoManual: number | null; produto: Produto }
interface Recorrente {
  id: number; clienteId: number; diasSemana: string;
  dataInicio: string; dataFim: string | null; taxaEntrega: number;
  observacoes: string; ativo: boolean;
  cliente: Cliente; formaPagamento: FormaPag | null; formaPagamentoId: number | null;
  itens: RecItem[]; _count: { pedidosGerados: number };
}

interface ItemForm { produtoId: string; quantidade: string; precoManual: string }

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function todayStr() { return new Date().toISOString().slice(0, 10) }
function fmtDate(s: string) { if (!s) return ""; const [y,m,d]=s.split("-"); return `${d}/${m}/${y}` }

export default function RecorrentesPage() {
  const [recorrentes, setRecorrentes] = useState<Recorrente[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [formasPag, setFormasPag] = useState<FormaPag[]>([]);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [clienteId, setClienteId] = useState("");
  const [clienteBusca, setClienteBusca] = useState("");
  const [clienteDropdownOpen, setClienteDropdownOpen] = useState(false);
  const [diasSemana, setDiasSemana] = useState<number[]>([]);
  const [dataInicio, setDataInicio] = useState(todayStr());
  const [dataFim, setDataFim] = useState("");
  const [formaPagId, setFormaPagId] = useState("");
  const [taxaEntrega, setTaxaEntrega] = useState("0");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([]);

  const [gerarResult, setGerarResult] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      setLoading(true);
      const [recRes, cliRes, prodRes, fpRes] = await Promise.all([
        fetch("/api/recorrentes"), fetch("/api/clientes"),
        fetch("/api/produtos"), fetch("/api/formas-pagamento"),
      ]);
      setRecorrentes(await recRes.json());
      setClientes(await cliRes.json());
      setProdutos(await prodRes.json());
      setFormasPag(await fpRes.json());
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function openNew() {
    setEditingId(null); setClienteId(""); setClienteBusca(""); setDiasSemana([]);
    setDataInicio(todayStr()); setDataFim(""); setFormaPagId(""); setTaxaEntrega("0");
    setObservacoes(""); setItens([{ produtoId: "", quantidade: "1", precoManual: "" }]);
    setDialogOpen(true);
  }

  function openEdit(rec: Recorrente) {
    setEditingId(rec.id);
    setClienteId(String(rec.clienteId));
    setClienteBusca(rec.cliente.nome);
    setDiasSemana(rec.diasSemana.split(",").map(Number));
    setDataInicio(rec.dataInicio);
    setDataFim(rec.dataFim || "");
    setFormaPagId(rec.formaPagamentoId ? String(rec.formaPagamentoId) : "");
    setTaxaEntrega(String(rec.taxaEntrega));
    setObservacoes(rec.observacoes);
    setItens(rec.itens.map(i => ({ produtoId: String(i.produtoId), quantidade: String(i.quantidade), precoManual: i.precoManual ? String(i.precoManual) : "" })));
    setDialogOpen(true);
  }

  function toggleDia(dia: number) {
    setDiasSemana(prev => prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia].sort());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId || diasSemana.length === 0 || itens.length === 0) {
      alert("Preencha cliente, dias da semana e pelo menos 1 item.");
      return;
    }

    const body = {
      clienteId: parseInt(clienteId),
      formaPagamentoId: formaPagId ? parseInt(formaPagId) : null,
      diasSemana: diasSemana.join(","),
      dataInicio, dataFim: dataFim || null,
      taxaEntrega: parseFloat(taxaEntrega) || 0,
      observacoes,
      itens: itens.filter(i => i.produtoId).map(i => ({
        produtoId: parseInt(i.produtoId),
        quantidade: parseFloat(i.quantidade) || 1,
        precoManual: i.precoManual ? parseFloat(i.precoManual) : null,
      })),
    };

    try {
      const url = editingId ? `/api/recorrentes/${editingId}` : "/api/recorrentes";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await res.json();
      setDialogOpen(false);
      if (!editingId && result.pedidosCriados) {
        setGerarResult(`Recorrente criado! ${result.pedidosCriados} pedido(s) gerado(s) até ${fmtDate(result.dataFimGerada)}`);
      }
      fetchAll();
    } catch (e) { console.error(e) }
  }

  async function handleToggleAtivo(rec: Recorrente) {
    await fetch(`/api/recorrentes/${rec.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rec, ativo: !rec.ativo, itens: undefined, cliente: undefined, formaPagamento: undefined, _count: undefined }),
    });
    fetchAll();
  }

  async function handleDelete(id: number) {
    if (!confirm("Excluir este pedido recorrente e cancelar todos os pedidos pendentes de entrega?")) return;
    const res = await fetch(`/api/recorrentes/${id}`, { method: "DELETE" });
    if (res.ok) {
      const data = await res.json();
      if (data.pedidosCancelados > 0) {
        setGerarResult(`Recorrente excluído. ${data.pedidosCancelados} pedido(s) pendente(s) cancelado(s).`);
      }
    }
    fetchAll();
  }

  const filteredClientes = clienteBusca.length >= 1
    ? clientes.filter(c => c.nome.toLowerCase().includes(clienteBusca.toLowerCase())).slice(0, 8)
    : [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="size-5" />
          <h1 className="text-2xl font-semibold tracking-tight">Ped. Recorrentes</h1>
        </div>
        <Button onClick={openNew}><Plus className="size-4" /> Novo Recorrente</Button>
      </div>

      {gerarResult && (
        <div className="text-sm text-green-500 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
          {gerarResult}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : recorrentes.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhum pedido recorrente cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {recorrentes.map((rec) => (
            <Card key={rec.id} className={!rec.ativo ? "opacity-50" : ""}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{rec.cliente.nome}</span>
                      {rec.cliente.bairro && <span className="text-xs text-muted-foreground">{rec.cliente.bairro}</span>}
                      <Badge variant={rec.ativo ? "default" : "outline"}>{rec.ativo ? "Ativo" : "Inativo"}</Badge>
                      <span className="text-xs text-muted-foreground">{rec._count.pedidosGerados} gerado(s)</span>
                    </div>

                    <div className="flex gap-1 flex-wrap">
                      {DIAS.map((nome, i) => (
                        <Badge key={i} variant={rec.diasSemana.split(",").map(Number).includes(i) ? "default" : "outline"} className="text-xs px-1.5">
                          {nome}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>De: {fmtDate(rec.dataInicio)}</span>
                      {rec.dataFim && <span>Até: {fmtDate(rec.dataFim)}</span>}
                      {!rec.dataFim && <span>Sem data fim</span>}
                      {rec.formaPagamento && <span>{rec.formaPagamento.nome}</span>}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {rec.itens.map((item) => (
                        <Badge key={item.id} variant="outline" className="text-xs">
                          {item.produto.nome} x{item.quantidade}
                          {item.precoManual ? ` R$${item.precoManual.toFixed(2)}` : ""}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon-sm" onClick={() => handleToggleAtivo(rec)} title={rec.ativo ? "Desativar" : "Ativar"}>
                      <Repeat className={`size-4 ${rec.ativo ? "text-green-500" : "text-muted-foreground"}`} />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(rec)}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(rec.id)}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Recorrente" : "Novo Recorrente"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Cliente */}
            <div className="relative space-y-1">
              <Label>Cliente</Label>
              <Input
                placeholder="Buscar cliente..."
                value={clienteBusca}
                onChange={(e) => { setClienteBusca(e.target.value); setClienteDropdownOpen(true) }}
                onFocus={() => setClienteDropdownOpen(true)}
              />
              {clienteDropdownOpen && filteredClientes.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-40 w-full overflow-auto rounded-lg border bg-popover shadow-md">
                  {filteredClientes.map((c) => (
                    <button key={c.id} type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => { setClienteId(String(c.id)); setClienteBusca(c.nome); setClienteDropdownOpen(false) }}>
                      {c.nome} {c.bairro && <span className="text-muted-foreground">- {c.bairro}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dias da semana */}
            <div className="space-y-1">
              <Label>Dias da Semana</Label>
              <div className="flex gap-1.5 flex-wrap">
                {DIAS.map((nome, i) => (
                  <button key={i} type="button"
                    onClick={() => toggleDia(i)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      diasSemana.includes(i)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}>
                    {nome}
                  </button>
                ))}
              </div>
            </div>

            {/* Vigência */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data Início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Data Fim (opcional)</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>

            {/* Pagamento + Taxa */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Forma de Pagamento</Label>
                <select value={formaPagId} onChange={(e) => setFormaPagId(e.target.value)}
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50">
                  <option value="">Selecione...</option>
                  {formasPag.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Taxa de Entrega</Label>
                <Input type="number" step="0.01" min="0" value={taxaEntrega} onChange={(e) => setTaxaEntrega(e.target.value)} />
              </div>
            </div>

            {/* Itens */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Itens</Label>
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setItens([...itens, { produtoId: "", quantidade: "1", precoManual: "" }])}>
                  <Plus className="size-3" /> Produto
                </Button>
              </div>
              {itens.map((item, idx) => {
                const prod = produtos.find(p => String(p.id) === item.produtoId);
                return (
                <div key={idx} className="flex gap-2 items-end flex-wrap sm:flex-nowrap">
                  <div className="flex-1 min-w-[120px]">
                    <select value={item.produtoId}
                      onChange={(e) => { const n = [...itens]; n[idx].produtoId = e.target.value; n[idx].precoManual = ""; setItens(n) }}
                      className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50">
                      <option value="">Produto...</option>
                      {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </div>
                  <div className="w-16">
                    <Input type="number" min="1" step="1" value={item.quantidade} placeholder="Qtd"
                      onChange={(e) => { const n = [...itens]; n[idx].quantidade = e.target.value; setItens(n) }} />
                  </div>
                  <div className="w-24">
                    <Input type="number" step="0.01" min="0" value={item.precoManual}
                      placeholder={prod ? `R$ ${prod.preco.toFixed(2)}` : "Preço"}
                      onChange={(e) => { const n = [...itens]; n[idx].precoManual = e.target.value; setItens(n) }} />
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm"
                    onClick={() => setItens(itens.filter((_, i) => i !== idx))}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                );
              })}
            </div>

            <div className="space-y-1">
              <Label>Observações</Label>
              <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações..." />
            </div>

            <DialogFooter>
              <Button type="submit">{editingId ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
