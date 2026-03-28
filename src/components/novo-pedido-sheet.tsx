"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Plus, Trash2, Save, Check, RotateCcw } from "lucide-react";
import { calcSubtotal as calcSubtotalBase } from "@/lib/pedido-utils";

interface Cliente {
  id: number;
  nome: string;
  telefone: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
}

interface Produto {
  id: number;
  nome: string;
  preco: number;
}

interface FormaPagamento {
  id: number;
  nome: string;
}

interface Promocao {
  id: number;
  nome: string;
  produtoId: number;
  tipo: string;
  precoPromocional: number;
  leveQuantidade: number | null;
  pagueQuantidade: number | null;
  quantidadeMinima: number | null;
  produtoId2: number | null;
  dataInicio: string;
  dataFim: string;
  ativo: boolean;
}

interface ItemPedido {
  produtoId: string;
  quantidade: string;
  precoUnitario: number;
  subtotal: number;
  precoManual: boolean;
}

export interface NovoPedidoInitialData {
  clienteId: number;
  clienteNome: string;
  formaPagamentoId?: number;
  taxaEntrega?: number;
  observacoes?: string;
  itens: { produtoId: number; quantidade: number; precoUnitario: number }[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialData?: NovoPedidoInitialData;
}

function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

export function NovoPedidoSheet({ open, onOpenChange, onSuccess, initialData }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [saving, setSaving] = useState(false);

  const [clienteId, setClienteId] = useState("");
  const [clienteBusca, setClienteBusca] = useState("");
  const [clienteDropdownOpen, setClienteDropdownOpen] = useState(false);
  const [dataEntrega, setDataEntrega] = useState("");
  const [formaPagamentoId, setFormaPagamentoId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [taxaEntregaAtiva, setTaxaEntregaAtiva] = useState(false);
  const [taxaEntregaValor, setTaxaEntregaValor] = useState(5.0);

  interface UltimoPedido {
    id: number;
    dataEntrega: string;
    total: number;
    itens: { produtoId: number; quantidade: number; produto: { id: number; nome: string; preco: number } }[];
  }
  const [ultimoPedido, setUltimoPedido] = useState<UltimoPedido | null>(null);
  const [repetido, setRepetido] = useState(false);

  const [isRecorrente, setIsRecorrente] = useState(false);
  const [diasSemana, setDiasSemana] = useState<number[]>([]);
  const [recDataFim, setRecDataFim] = useState("");
  const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const [produtoSearches, setProdutoSearches] = useState<Record<number, string>>({});
  const [produtoDropdowns, setProdutoDropdowns] = useState<Record<number, boolean>>({});
  const [produtoHighlights, setProdutoHighlights] = useState<Record<number, number>>({});
  const produtoRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Load reference data on mount
  useEffect(() => {
    fetchClientes();
    fetchProdutos();
    fetchFormasPagamento();
    fetchPromocoes();
  }, []);

  async function fetchClientes() {
    const res = await fetch("/api/clientes").catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    if (Array.isArray(data)) setClientes(data);
  }

  async function fetchProdutos() {
    const res = await fetch("/api/produtos").catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    if (Array.isArray(data)) setProdutos(data);
  }

  async function fetchFormasPagamento() {
    const res = await fetch("/api/formas-pagamento").catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    if (Array.isArray(data)) setFormasPagamento(data);
  }

  async function fetchPromocoes() {
    const res = await fetch("/api/promocoes").catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    if (!Array.isArray(data)) return;
    const today = new Date().toISOString().split("T")[0];
    setPromocoes(data.filter((p: Promocao) => p.ativo && p.dataInicio <= today && p.dataFim >= today));
  }

  // Reset form when sheet opens/closes or initialData changes
  useEffect(() => {
    if (!open) return;
    // Reset all fields
    setClienteId("");
    setClienteBusca("");
    setClienteDropdownOpen(false);
    setDataEntrega("");
    setFormaPagamentoId("");
    setObservacoes("");
    setItens([]);
    setTaxaEntregaAtiva(false);
    setTaxaEntregaValor(5.0);
    setUltimoPedido(null);
    setRepetido(false);
    setIsRecorrente(false);
    setDiasSemana([]);
    setRecDataFim("");
    setProdutoSearches({});
    setProdutoDropdowns({});
    setProdutoHighlights({});

    if (initialData) {
      setClienteId(String(initialData.clienteId));
      setClienteBusca(initialData.clienteNome);
      if (initialData.formaPagamentoId) setFormaPagamentoId(String(initialData.formaPagamentoId));
      setObservacoes(initialData.observacoes || "");
      const taxa = initialData.taxaEntrega ?? 0;
      if (taxa > 0) {
        setTaxaEntregaAtiva(true);
        setTaxaEntregaValor(taxa);
      }
      const novosItens: ItemPedido[] = initialData.itens.map((i) => ({
        produtoId: String(i.produtoId),
        quantidade: String(i.quantidade),
        precoUnitario: i.precoUnitario,
        subtotal: i.precoUnitario * i.quantidade,
        precoManual: true,
      }));
      setItens(novosItens);
      // Set product search names
      const searches: Record<number, string> = {};
      novosItens.forEach((item, idx) => {
        const produto = produtos.find((p) => String(p.id) === item.produtoId);
        if (produto) searches[idx] = produto.nome;
      });
      setProdutoSearches(searches);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Update product search names for initialData after produtos are loaded
  useEffect(() => {
    if (!initialData || !open || produtos.length === 0) return;
    setProdutoSearches((prev) => {
      const searches = { ...prev };
      initialData.itens.forEach((item, idx) => {
        if (!searches[idx]) {
          const produto = produtos.find((p) => p.id === item.produtoId);
          if (produto) searches[idx] = produto.nome;
        }
      });
      return searches;
    });
  }, [produtos, initialData, open]);

  // Fetch last order when client changes
  useEffect(() => {
    setUltimoPedido(null);
    setRepetido(false);
    if (!clienteId) return;
    fetch(`/api/pedidos?cliente=${clienteId}&limit=1&orderBy=desc`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setUltimoPedido(data[0]);
      })
      .catch(() => {});
  }, [clienteId]);

  // Close product dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const anyOpen = Object.values(produtoDropdowns).some(Boolean);
      if (!anyOpen) return;
      const newDropdowns = { ...produtoDropdowns };
      let changed = false;
      for (const key of Object.keys(produtoDropdowns)) {
        const idx = Number(key);
        if (produtoDropdowns[idx] && produtoRefs.current[idx] && !produtoRefs.current[idx]!.contains(target)) {
          newDropdowns[idx] = false;
          changed = true;
        }
      }
      if (changed) setProdutoDropdowns(newDropdowns);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [produtoDropdowns]);

  const selectedCliente = clientes.find((c) => String(c.id) === clienteId);
  const filteredClientes = clienteBusca
    ? clientes.filter((c) => c.nome.toLowerCase().includes(clienteBusca.toLowerCase()))
    : clientes;

  function getPromocaoForProduto(produtoId: string): Promocao | undefined {
    return promocoes.find((p) => String(p.produtoId) === produtoId);
  }

  function getFilteredProdutos(index: number) {
    const search = (produtoSearches[index] || "").toLowerCase();
    if (!search) return produtos;
    return produtos.filter((p) => p.nome.toLowerCase().includes(search));
  }

  function handleProdutoSelect(index: number, produtoId: string) {
    const produto = produtos.find((p) => String(p.id) === produtoId);
    if (produto) setProdutoSearches((prev) => ({ ...prev, [index]: produto.nome }));
    setProdutoDropdowns((prev) => ({ ...prev, [index]: false }));
    setProdutoHighlights((prev) => ({ ...prev, [index]: 0 }));
    handleItemChange(index, "produtoId", produtoId);
  }

  function handleProdutoKeyDown(index: number, e: React.KeyboardEvent) {
    const filtered = getFilteredProdutos(index);
    const highlight = produtoHighlights[index] || 0;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setProdutoHighlights((prev) => ({ ...prev, [index]: Math.min(highlight + 1, filtered.length - 1) }));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setProdutoHighlights((prev) => ({ ...prev, [index]: Math.max(highlight - 1, 0) }));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length > 0) handleProdutoSelect(index, String(filtered[highlight]?.id));
    } else if (e.key === "Escape") {
      setProdutoDropdowns((prev) => ({ ...prev, [index]: false }));
    } else if (e.key === "Tab") {
      if (filtered.length === 1) handleProdutoSelect(index, String(filtered[0].id));
      setProdutoDropdowns((prev) => ({ ...prev, [index]: false }));
    }
  }

  function calcSubtotal(item: ItemPedido): { subtotal: number; qtdCobrada: number | null } {
    const qty = parseFloat(item.quantidade || "0");
    const promo = !item.precoManual ? getPromocaoForProduto(item.produtoId) : undefined;
    const tipo = promo ? (promo.tipo || "desconto") : undefined;
    const subtotal = calcSubtotalBase(qty, item.precoUnitario, tipo, promo?.leveQuantidade, promo?.pagueQuantidade, promo?.quantidadeMinima, promo?.precoPromocional);
    const plainSubtotal = item.precoUnitario * qty;
    const qtdCobrada = subtotal !== plainSubtotal ? Math.round((subtotal / item.precoUnitario) * 100) / 100 : null;
    return { subtotal, qtdCobrada };
  }

  function applyCompradaCasadaDiscounts(items: ItemPedido[]): ItemPedido[] {
    const produtoIdSet = new Set(items.map((i) => i.produtoId));
    return items.map((item) => {
      if (item.precoManual) return item;
      const casadaPromo = promocoes.find(
        (p) => p.tipo === "compra_casada" && p.produtoId2 !== null && String(p.produtoId2) === item.produtoId
      );
      if (!casadaPromo) return item;
      const primaryInOrder = produtoIdSet.has(String(casadaPromo.produtoId));
      const qty = parseFloat(item.quantidade) || 0;
      if (primaryInOrder) {
        const newPrice = casadaPromo.precoPromocional;
        return { ...item, precoUnitario: newPrice, subtotal: qty * newPrice };
      } else {
        const produto = produtos.find((p) => String(p.id) === item.produtoId);
        if (!produto) return item;
        const regularPromo = promocoes.find(
          (p) => String(p.produtoId) === item.produtoId && (p.tipo || "desconto") === "desconto" && p.precoPromocional
        );
        const basePrice = regularPromo ? regularPromo.precoPromocional : produto.preco;
        return { ...item, precoUnitario: basePrice, subtotal: qty * basePrice };
      }
    });
  }

  function handleAddItem() {
    setItens([...itens, { produtoId: "", quantidade: "1", precoUnitario: 0, subtotal: 0, precoManual: false }]);
  }

  function handleRemoveItem(index: number) {
    setItens(applyCompradaCasadaDiscounts(itens.filter((_, i) => i !== index)));
  }

  function handleItemChange(index: number, field: keyof ItemPedido, value: string) {
    const updated = [...itens];
    const item = { ...updated[index] };

    if (field === "produtoId") {
      item.produtoId = value;
      const produto = produtos.find((p) => String(p.id) === value);
      if (produto) {
        const promo = getPromocaoForProduto(value);
        item.precoUnitario = promo && (promo.tipo || "desconto") === "desconto" && promo.precoPromocional
          ? promo.precoPromocional
          : produto.preco;
        item.precoManual = false;
        item.subtotal = calcSubtotal({ ...item }).subtotal;
      }
    } else if (field === "quantidade") {
      item.quantidade = value;
      if (!item.precoManual) {
        const promo = getPromocaoForProduto(item.produtoId);
        if (promo && promo.tipo === "quantidade_minima" && promo.quantidadeMinima && promo.precoPromocional) {
          const qty = parseFloat(value) || 0;
          const produto = produtos.find((p) => String(p.id) === item.produtoId);
          item.precoUnitario = qty >= promo.quantidadeMinima ? promo.precoPromocional : (produto?.preco ?? item.precoUnitario);
        }
      }
      item.subtotal = calcSubtotal(item).subtotal;
    } else if (field === "precoUnitario") {
      item.precoUnitario = parseFloat(value) || 0;
      item.precoManual = true;
      item.subtotal = calcSubtotal(item).subtotal;
    }

    updated[index] = item;
    setItens(applyCompradaCasadaDiscounts(updated));
  }

  function handleRepetirUltimoPedido() {
    if (!ultimoPedido) return;
    const novosItens: ItemPedido[] = ultimoPedido.itens.map((item) => {
      const produto = produtos.find((p) => p.id === item.produtoId);
      const promo = getPromocaoForProduto(String(item.produtoId));
      let preco = produto?.preco ?? 0;
      if (promo && (promo.tipo || "desconto") === "desconto" && promo.precoPromocional) preco = promo.precoPromocional;
      return { produtoId: String(item.produtoId), quantidade: String(item.quantidade), precoUnitario: preco, subtotal: preco * item.quantidade, precoManual: false };
    });
    setItens(novosItens);
    const searches: Record<number, string> = {};
    novosItens.forEach((item, i) => {
      const produto = produtos.find((p) => String(p.id) === item.produtoId);
      if (produto) searches[i] = produto.nome;
    });
    setProdutoSearches(searches);
    setRepetido(true);
  }

  const subtotalItens = itens.reduce((acc, item) => acc + calcSubtotal(item).subtotal, 0);
  const taxaEntrega = taxaEntregaAtiva ? taxaEntregaValor : 0;
  const total = subtotalItens + taxaEntrega;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId) { alert("Selecione um cliente."); return; }
    if (itens.length === 0) { alert("Adicione pelo menos um item ao pedido."); return; }
    if (itens.find((item) => !item.produtoId || !item.quantidade)) { alert("Preencha todos os campos dos itens."); return; }

    setSaving(true);
    try {
      const body = {
        clienteId: Number(clienteId),
        dataEntrega: dataEntrega || undefined,
        formaPagamentoId: formaPagamentoId ? Number(formaPagamentoId) : undefined,
        observacoes,
        taxaEntrega,
        itens: itens.map((item) => ({
          produtoId: Number(item.produtoId),
          quantidade: Number(item.quantidade),
          ...(item.precoManual ? { precoUnitario: item.precoUnitario } : {}),
        })),
      };

      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const pedidoCriado = await res.json();
        if (isRecorrente && diasSemana.length > 0) {
          try {
            const today = new Date().toISOString().slice(0, 10);
            const recRes = await fetch("/api/recorrentes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                clienteId: Number(clienteId),
                formaPagamentoId: formaPagamentoId ? Number(formaPagamentoId) : null,
                diasSemana: diasSemana.join(","),
                dataInicio: dataEntrega || today,
                dataFim: recDataFim || null,
                taxaEntrega,
                observacoes,
                skipDate: dataEntrega || today,
                itens: itens.filter((i) => i.produtoId).map((i) => ({
                  produtoId: Number(i.produtoId),
                  quantidade: Number(i.quantidade),
                })),
              }),
            });
            if (recRes.ok) {
              const recData = await recRes.json();
              await fetch(`/api/pedidos/${pedidoCriado.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recorrenteId: recData.id }),
              });
            }
          } catch (err) {
            console.error("Erro ao criar recorrência:", err);
          }
        }
        onSuccess();
        onOpenChange(false);
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao salvar pedido.");
      }
    } catch (error) {
      console.error("Erro ao salvar pedido:", error);
      alert("Erro ao salvar pedido.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full data-[side=right]:sm:max-w-3xl flex flex-col p-0 gap-0"
      >
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle>{initialData ? "Duplicar Pedido" : "Novo Pedido"}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form id="novo-pedido-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Cliente */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Cliente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Label htmlFor="np-cliente-busca">Buscar cliente</Label>
                  <Input
                    id="np-cliente-busca"
                    placeholder="Digite o nome do cliente..."
                    value={clienteBusca}
                    onChange={(e) => { setClienteBusca(e.target.value); setClienteDropdownOpen(true); }}
                    onFocus={() => setClienteDropdownOpen(true)}
                    autoComplete="off"
                  />
                  {clienteDropdownOpen && filteredClientes.length > 0 && (
                    <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-popover shadow-md">
                      {filteredClientes.map((cliente) => (
                        <button
                          key={cliente.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                          onClick={() => { setClienteId(String(cliente.id)); setClienteBusca(cliente.nome); setClienteDropdownOpen(false); }}
                        >
                          <span className="font-medium">{cliente.nome}</span>
                          {cliente.bairro && <span className="ml-2 text-muted-foreground">- {cliente.bairro}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedCliente && (
                  <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                    <p><strong>Endereço:</strong> {selectedCliente.rua}{selectedCliente.numero && `, ${selectedCliente.numero}`}</p>
                    <p><strong>Bairro:</strong> {selectedCliente.bairro}</p>
                    <p><strong>Cidade:</strong> {selectedCliente.cidade}</p>
                  </div>
                )}

                {selectedCliente && ultimoPedido && (
                  <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-0.5">
                        <p className="font-medium text-blue-400">
                          Último pedido ({ultimoPedido.dataEntrega ? ultimoPedido.dataEntrega.split("-").reverse().join("/") : "—"})
                        </p>
                        <p className="text-muted-foreground">
                          {ultimoPedido.itens.map((i) => `${i.quantidade}x ${i.produto.nome}`).join(", ")} — {formatPrice(ultimoPedido.total)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={repetido}
                        onClick={handleRepetirUltimoPedido}
                        className={repetido ? "border-green-500/50 text-green-400" : "border-blue-500/50 text-blue-400 hover:bg-blue-500/10"}
                      >
                        {repetido ? <><Check className="size-4" />Repetido</> : <><RotateCcw className="size-4" />Repetir</>}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Detalhes */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Detalhes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="np-data-entrega">Data Entrega</Label>
                    <Input id="np-data-entrega" type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Forma de Pagamento</Label>
                    <select
                      className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                      value={formaPagamentoId}
                      onChange={(e) => setFormaPagamentoId(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {formasPagamento.map((fp) => (
                        <option key={fp.id} value={String(fp.id)}>{fp.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="np-observacoes">Observações</Label>
                    <Textarea id="np-observacoes" placeholder="Observações do pedido..." value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Itens */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Itens do Pedido</CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                    <Plus className="size-4" />Adicionar Produto
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {itens.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    Nenhum item adicionado. Clique em &quot;Adicionar Produto&quot;.
                  </p>
                ) : (
                  <>
                    {itens.map((item, index) => {
                      const promo = getPromocaoForProduto(item.produtoId);
                      const produto = produtos.find((p) => String(p.id) === item.produtoId);
                      const { subtotal, qtdCobrada } = calcSubtotal(item);
                      const isDescontoPromo = promo && (promo.tipo || "desconto") === "desconto";
                      const isLevePromo = promo && promo.tipo === "leve_x_pague_y";
                      const isQtdMinPromo = promo && promo.tipo === "quantidade_minima";
                      const isCasadaPromo = promo && promo.tipo === "compra_casada";
                      const casadaPartnerPromo = promocoes.find(
                        (p) => p.tipo === "compra_casada" && p.produtoId2 !== null && String(p.produtoId2) === item.produtoId
                      );
                      const isCasadaPartnerActive = casadaPartnerPromo && itens.some((i) => String(casadaPartnerPromo.produtoId) === i.produtoId);

                      return (
                        <div key={index} className="space-y-1">
                          <div className="space-y-2 sm:space-y-0">
                            <div className="grid grid-cols-[1fr_40px] sm:grid-cols-[1fr_80px_80px_80px_40px] items-end gap-2">
                              <div className="space-y-1 relative" ref={(el) => { produtoRefs.current[index] = el; }}>
                                <Label className="text-xs">Produto</Label>
                                <Input
                                  placeholder="Buscar produto..."
                                  value={produtoSearches[index] ?? (produto?.nome || "")}
                                  onChange={(e) => {
                                    setProdutoSearches((prev) => ({ ...prev, [index]: e.target.value }));
                                    setProdutoDropdowns((prev) => ({ ...prev, [index]: true }));
                                    setProdutoHighlights((prev) => ({ ...prev, [index]: 0 }));
                                    if (!e.target.value) handleItemChange(index, "produtoId", "");
                                  }}
                                  onFocus={() => setProdutoDropdowns((prev) => ({ ...prev, [index]: true }))}
                                  onKeyDown={(e) => handleProdutoKeyDown(index, e)}
                                  autoComplete="off"
                                />
                                {produtoDropdowns[index] && (() => {
                                  const filtered = getFilteredProdutos(index);
                                  if (filtered.length === 0) return null;
                                  const hl = produtoHighlights[index] || 0;
                                  return (
                                    <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-popover shadow-md">
                                      {filtered.map((p, pi) => {
                                        const pPromo = getPromocaoForProduto(String(p.id));
                                        const hasDiscountPromo = pPromo && (pPromo.tipo || "desconto") === "desconto" && pPromo.precoPromocional;
                                        return (
                                          <button
                                            key={p.id}
                                            type="button"
                                            className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between ${pi === hl ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"}`}
                                            onMouseEnter={() => setProdutoHighlights((prev) => ({ ...prev, [index]: pi }))}
                                            onClick={() => handleProdutoSelect(index, String(p.id))}
                                          >
                                            <span className="font-medium">{p.nome}</span>
                                            <span className="ml-2 text-xs">
                                              {hasDiscountPromo ? (
                                                <><span className="line-through text-muted-foreground">{formatPrice(p.preco)}</span>{" "}<span className="text-green-400">{formatPrice(pPromo.precoPromocional)}</span></>
                                              ) : (
                                                <span className="text-muted-foreground">{formatPrice(p.preco)}</span>
                                              )}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>

                              <div className="hidden sm:block space-y-1">
                                <Label className="text-xs">Qtd</Label>
                                <Input type="number" min="1" step="1" value={item.quantidade} onChange={(e) => handleItemChange(index, "quantidade", e.target.value)} />
                              </div>
                              <div className="hidden sm:block space-y-1">
                                <Label className="text-xs">Preço Unit.</Label>
                                <Input type="number" step="0.01" min="0" value={item.precoUnitario} onChange={(e) => handleItemChange(index, "precoUnitario", e.target.value)} />
                              </div>
                              <div className="hidden sm:block space-y-1">
                                <Label className="text-xs">Subtotal</Label>
                                <div className="flex h-8 items-center text-sm"><span>{formatPrice(subtotal)}</span></div>
                              </div>
                              <Button type="button" variant="destructive" size="icon-sm" onClick={() => handleRemoveItem(index)} className="mb-0.5">
                                <Trash2 className="size-4" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-3 gap-2 sm:hidden">
                              <div className="space-y-1">
                                <Label className="text-xs">Qtd</Label>
                                <Input type="number" min="1" step="1" value={item.quantidade} onChange={(e) => handleItemChange(index, "quantidade", e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Preço</Label>
                                <Input type="number" step="0.01" min="0" value={item.precoUnitario} onChange={(e) => handleItemChange(index, "precoUnitario", e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Subtotal</Label>
                                <div className="flex h-8 items-center text-sm font-medium">{formatPrice(subtotal)}</div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pl-0.5 flex-wrap">
                            {isDescontoPromo && produto && (
                              <><Badge className="bg-green-600 text-white text-xs">Promo: {formatPrice(promo.precoPromocional)}</Badge><span className="text-xs text-muted-foreground line-through">{formatPrice(produto.preco)}</span></>
                            )}
                            {isLevePromo && <Badge className="bg-blue-600 text-white text-xs">Leve {promo.leveQuantidade} Pague {promo.pagueQuantidade}</Badge>}
                            {isQtdMinPromo && promo.quantidadeMinima && <Badge className="bg-purple-600 text-white text-xs">A partir de {promo.quantidadeMinima} un.: {formatPrice(promo.precoPromocional)}</Badge>}
                            {isCasadaPromo && <Badge className="bg-orange-600/60 text-white text-xs">Compra casada</Badge>}
                            {isCasadaPartnerActive && casadaPartnerPromo && <Badge className="bg-orange-600 text-white text-xs">Compra casada: {formatPrice(casadaPartnerPromo.precoPromocional)}</Badge>}
                            {qtdCobrada !== null && <span className="text-xs text-muted-foreground">({qtdCobrada} un. cobradas)</span>}
                          </div>
                        </div>
                      );
                    })}

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={taxaEntregaAtiva} onChange={(e) => setTaxaEntregaAtiva(e.target.checked)} className="size-4 accent-primary cursor-pointer" />
                          <span className="text-sm">Taxa de Entrega</span>
                        </label>
                        {taxaEntregaAtiva && (
                          <div className="flex items-center gap-2">
                            <Input type="number" step="0.01" min="0" value={taxaEntregaValor} onChange={(e) => setTaxaEntregaValor(parseFloat(e.target.value) || 0)} className="w-20" />
                            <span className="text-sm text-muted-foreground">{formatPrice(taxaEntregaValor)}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end text-lg font-semibold">
                        Total: {formatPrice(total)}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Recorrência */}
            <Card>
              <CardContent className="py-3 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isRecorrente} onChange={(e) => setIsRecorrente(e.target.checked)} className="size-4 accent-primary cursor-pointer" />
                  <span className="text-sm font-medium">Tornar pedido recorrente</span>
                </label>
                {isRecorrente && (
                  <div className="space-y-3 pl-6">
                    <div className="space-y-1">
                      <Label className="text-xs">Dias da semana</Label>
                      <div className="flex gap-1.5 flex-wrap">
                        {DIAS.map((nome, i) => (
                          <button key={i} type="button"
                            onClick={() => setDiasSemana((prev) => prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort())}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${diasSemana.includes(i) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
                            {nome}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Data fim (opcional, padrão 90 dias)</Label>
                      <Input type="date" value={recDataFim} onChange={(e) => setRecDataFim(e.target.value)} className="w-full sm:w-44 h-8 text-sm" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </form>
        </div>

        <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button form="novo-pedido-form" type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
            <Save className="size-4" />
            {saving ? "Salvando..." : isRecorrente ? "Salvar e Gerar Recorrentes" : "Salvar Pedido"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
