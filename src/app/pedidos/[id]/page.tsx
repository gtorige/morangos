"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
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
import { Plus, Trash2, Save, ArrowLeft } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { calcSubtotal as calcSubtotalBase } from "@/lib/pedido-utils";
import { formatPrice } from "@/lib/formatting";
import type { Produto, FormaPagamento, Promocao, Pedido, ItemPedidoForm } from "@/lib/types";

type ItemPedido = ItemPedidoForm;
type PedidoData = Pedido;

interface Cliente {
  id: number;
  nome: string;
  telefone: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
}

export default function EditarPedidoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [clienteId, setClienteId] = useState("");
  const [clienteBusca, setClienteBusca] = useState("");
  const [clienteDropdownOpen, setClienteDropdownOpen] = useState(false);
  const [dataEntrega, setDataEntrega] = useState("");
  const [formaPagamentoId, setFormaPagamentoId] = useState("");
  const [observacoes, setObservações] = useState("");
  const [situacaoPagamento, setSituacaoPagamento] = useState("Pendente");
  const [statusEntrega, setStatusEntrega] = useState("Pendente");
  const [ordemRota, setOrdemRota] = useState("");
  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [taxaEntregaAtiva, setTaxaEntregaAtiva] = useState(false);
  const [taxaEntregaValor, setTaxaEntregaValor] = useState(5.0);

  // Product autocomplete state per item
  const [produtoSearches, setProdutoSearches] = useState<Record<number, string>>({});
  const [produtoDropdowns, setProdutoDropdowns] = useState<Record<number, boolean>>({});
  const [produtoHighlights, setProdutoHighlights] = useState<Record<number, number>>({});
  const produtoRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    Promise.all([
      fetchClientes(),
      fetchProdutos(),
      fetchFormasPagamento(),
      fetchPromocoes(),
    ]).then(() => {
      fetchPedido();
    });
  }, []);

  async function fetchClientes() {
    try {
      const res = await fetch("/api/clientes");
      const data = await res.json();
      setClientes(data);
      return data;
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
      return [];
    }
  }

  async function fetchProdutos() {
    try {
      const res = await fetch("/api/produtos");
      const data = await res.json();
      setProdutos(data);
      return data;
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      return [];
    }
  }

  async function fetchFormasPagamento() {
    try {
      const res = await fetch("/api/formas-pagamento");
      const data = await res.json();
      setFormasPagamento(data);
      return data;
    } catch (error) {
      console.error("Erro ao buscar formas de pagamento:", error);
      return [];
    }
  }

  async function fetchPromocoes() {
    try {
      const res = await fetch("/api/promocoes");
      const data = await res.json();
      const today = new Date().toISOString().split("T")[0];
      const ativas = data.filter(
        (p: Promocao) => p.ativo && p.dataInicio <= today && p.dataFim >= today
      );
      setPromocoes(ativas);
      return ativas;
    } catch (error) {
      console.error("Erro ao buscar promoções:", error);
      return [];
    }
  }

  async function fetchPedido() {
    try {
      setLoading(true);
      const res = await fetch(`/api/pedidos/${id}`);
      if (!res.ok) {
        alert("Pedido não encontrado.");
        router.push("/pedidos");
        return;
      }

      const pedido: PedidoData = await res.json();

      setClienteId(String(pedido.clienteId));
      setClienteBusca(pedido.cliente?.nome || "");
      setDataEntrega(pedido.dataEntrega || "");
      setFormaPagamentoId(
        pedido.formaPagamentoId ? String(pedido.formaPagamentoId) : ""
      );
      setObservações(pedido.observacoes || "");
      setSituacaoPagamento(pedido.situacaoPagamento || "Pendente");
      setStatusEntrega(pedido.statusEntrega || "Pendente");
      setOrdemRota(pedido.ordemRota != null ? String(pedido.ordemRota) : "");
      const taxa = pedido.taxaEntrega ?? 0;
      setTaxaEntregaAtiva(taxa > 0);
      setTaxaEntregaValor(taxa > 0 ? taxa : 5.0);
      const mappedItens = pedido.itens.map((item) => ({
        produtoId: String(item.produtoId),
        quantidade: String(item.quantidade),
        precoUnitario: item.precoUnitario,
        subtotal: item.subtotal,
        precoManual: false,
      }));
      setItens(mappedItens);
      // Populate autocomplete search terms
      const searches: Record<number, string> = {};
      pedido.itens.forEach((item, i) => {
        if (item.produto?.nome) searches[i] = item.produto.nome;
      });
      setProdutoSearches(searches);
    } catch (error) {
      console.error("Erro ao buscar pedido:", error);
    } finally {
      setLoading(false);
    }
  }

  const selectedCliente = clientes.find((c) => String(c.id) === clienteId);

  const filteredClientes = clienteBusca
    ? clientes.filter((c) =>
        c.nome.toLowerCase().includes(clienteBusca.toLowerCase())
      )
    : clientes;

  function getPromocaoForProduto(produtoId: string, quantidade?: number): Promocao | undefined {
    const promos = promocoes.filter((p) => String(p.produtoId) === produtoId);
    if (promos.length === 0) return undefined;

    // For quantidade_minima: find the best matching tier
    if (quantidade != null) {
      const bestQtdMin = promos
        .filter((p) => p.tipo === "quantidade_minima" && p.quantidadeMinima != null && quantidade >= p.quantidadeMinima)
        .sort((a, b) => (b.quantidadeMinima ?? 0) - (a.quantidadeMinima ?? 0))[0];
      if (bestQtdMin) return bestQtdMin;
    }

    const priorityOrder = ["desconto", "leve_x_pague_y"];
    for (const tipo of priorityOrder) {
      const found = promos.find((p) => p.tipo === tipo);
      if (found) return found;
    }
    return undefined;
  }

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

  function getFilteredProdutos(index: number) {
    const search = (produtoSearches[index] || "").toLowerCase();
    if (!search) return produtos;
    return produtos.filter((p) => p.nome.toLowerCase().includes(search));
  }

  function handleProdutoSelect(index: number, produtoId: string) {
    const produto = produtos.find((p) => String(p.id) === produtoId);
    if (produto) {
      setProdutoSearches((prev) => ({ ...prev, [index]: produto.nome }));
    }
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
      if (filtered.length > 0) {
        handleProdutoSelect(index, String(filtered[highlight]?.id));
      }
    } else if (e.key === "Escape") {
      setProdutoDropdowns((prev) => ({ ...prev, [index]: false }));
    } else if (e.key === "Tab") {
      if (filtered.length === 1) {
        handleProdutoSelect(index, String(filtered[0].id));
      }
      setProdutoDropdowns((prev) => ({ ...prev, [index]: false }));
    }
  }

  function calcSubtotal(item: ItemPedido): { subtotal: number; qtdCobrada: number | null } {
    const qty = parseFloat(item.quantidade || "0");
    const promo = !item.precoManual ? getPromocaoForProduto(item.produtoId, qty) : undefined;
    const tipo = promo ? (promo.tipo || "desconto") : undefined;
    const subtotal = calcSubtotalBase(qty, item.precoUnitario, tipo, promo?.leveQuantidade, promo?.pagueQuantidade, promo?.quantidadeMinima, promo?.precoPromocional);
    const plainSubtotal = item.precoUnitario * qty;
    const qtdCobrada = subtotal !== plainSubtotal ? Math.round((subtotal / item.precoUnitario) * 100) / 100 : null;
    return { subtotal, qtdCobrada };
  }

  function calcSubtotalFor(item: ItemPedido): { subtotal: number; qtdCobrada: number | null } {
    return calcSubtotal(item);
  }

  function handleAddItem() {
    setItens([
      ...itens,
      { produtoId: "", quantidade: "1", precoUnitario: 0, subtotal: 0, precoManual: false },
    ]);
  }

  function handleRemoveItem(index: number) {
    setItens(itens.filter((_, i) => i !== index));
  }

  function handleItemChange(
    index: number,
    field: keyof ItemPedido,
    value: string
  ) {
    const updated = [...itens];
    const item = { ...updated[index] };

    if (field === "produtoId") {
      item.produtoId = value;
      const produto = produtos.find((p) => String(p.id) === value);
      if (produto) {
        const promo = getPromocaoForProduto(value);
        if (promo && (promo.tipo || "desconto") === "desconto" && promo.precoPromocional) {
          item.precoUnitario = promo.precoPromocional;
        } else {
          item.precoUnitario = produto.preco;
        }
        item.precoManual = false;
        const { subtotal } = calcSubtotalFor(item);
        item.subtotal = subtotal;
      }
    } else if (field === "quantidade") {
      item.quantidade = value;
      if (!item.precoManual) {
        const qty = parseFloat(value) || 0;
        const produto = produtos.find((p) => String(p.id) === item.produtoId);
        const promo = getPromocaoForProduto(item.produtoId, qty);
        if (promo && promo.tipo === "quantidade_minima" && promo.quantidadeMinima && promo.precoPromocional && qty >= promo.quantidadeMinima) {
          item.precoUnitario = promo.precoPromocional;
        } else if (promo && promo.tipo === "desconto" && promo.precoPromocional) {
          item.precoUnitario = promo.precoPromocional;
        } else {
          item.precoUnitario = produto?.preco ?? item.precoUnitario;
        }
      }
      const { subtotal } = calcSubtotalFor(item);
      item.subtotal = subtotal;
    } else if (field === "precoUnitario") {
      item.precoUnitario = parseFloat(value) || 0;
      item.precoManual = true;
      const { subtotal } = calcSubtotalFor(item);
      item.subtotal = subtotal;
    }

    updated[index] = item;
    setItens(updated);
  }

  const subtotalItens = itens.reduce((acc, item) => {
    const { subtotal } = calcSubtotal(item);
    return acc + subtotal;
  }, 0);
  const taxaEntrega = taxaEntregaAtiva ? taxaEntregaValor : 0;
  const total = subtotalItens + taxaEntrega;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!clienteId) {
      alert("Selecione um cliente.");
      return;
    }

    if (itens.length === 0) {
      alert("Adicione pelo menos um item ao pedido.");
      return;
    }

    const invalidItem = itens.find(
      (item) => !item.produtoId || !item.quantidade
    );
    if (invalidItem) {
      alert("Preencha todos os campos dos itens.");
      return;
    }

    setSaving(true);

    try {
      const body = {
        clienteId: Number(clienteId),
        dataEntrega: dataEntrega || undefined,
        formaPagamentoId: formaPagamentoId
          ? Number(formaPagamentoId)
          : undefined,
        observacoes,
        situacaoPagamento,
        valorPago: situacaoPagamento === "Pago" ? total : 0,
        statusEntrega,
        ordemRota: ordemRota ? Number(ordemRota) : null,
        taxaEntrega,
        itens: itens.map((item) => ({
          produtoId: Number(item.produtoId),
          quantidade: Number(item.quantidade),
          precoUnitario: item.precoUnitario,
          subtotal: item.subtotal,
        })),
      };

      const res = await fetch(`/api/pedidos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        router.push("/pedidos");
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao atualizar pedido.");
      }
    } catch (error) {
      console.error("Erro ao atualizar pedido:", error);
      alert("Erro ao atualizar pedido.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Pedidos", href: "/pedidos" }, { label: `Pedido #${id}` }]} />
      <div className="flex items-center gap-4">
        <Link href="/pedidos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold">Editar Pedido #{id}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Label htmlFor="cliente-busca">Buscar cliente</Label>
              <Input
                id="cliente-busca"
                placeholder="Digite o nome do cliente..."
                value={clienteBusca}
                onChange={(e) => {
                  setClienteBusca(e.target.value);
                  if (!e.target.value) setClienteId("");
                  setClienteDropdownOpen(true);
                }}
                onFocus={() => setClienteDropdownOpen(true)}
              />
              {clienteDropdownOpen && filteredClientes.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-popover shadow-md">
                  {filteredClientes.map((cliente) => (
                    <button
                      key={cliente.id}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                      onClick={() => {
                        setClienteId(String(cliente.id));
                        setClienteBusca(cliente.nome);
                        setClienteDropdownOpen(false);
                      }}
                    >
                      <span className="font-medium">{cliente.nome}</span>
                      {cliente.bairro && (
                        <span className="ml-2 text-muted-foreground">
                          - {cliente.bairro}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedCliente && (
              <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                <p>
                  <strong>Endereço:</strong> {selectedCliente.rua}
                  {selectedCliente.numero && `, ${selectedCliente.numero}`}
                </p>
                <p>
                  <strong>Bairro:</strong> {selectedCliente.bairro}
                </p>
                <p>
                  <strong>Cidade:</strong> {selectedCliente.cidade}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalhes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="data-entrega">Data Entrega</Label>
                <Input
                  id="data-entrega"
                  type="date"
                  value={dataEntrega}
                  onChange={(e) => setDataEntrega(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <select
                  value={formaPagamentoId}
                  onChange={(e) => setFormaPagamentoId(e.target.value)}
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                >
                  <option value="">Selecione...</option>
                  {formasPagamento.map((fp) => (
                    <option key={fp.id} value={String(fp.id)}>
                      {fp.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Situação Pagamento</Label>
                <select
                  value={situacaoPagamento}
                  onChange={(e) => setSituacaoPagamento(e.target.value)}
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                >
                  <option value="Pendente">Pendente</option>
                  <option value="Pago">Pago</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Status Entrega</Label>
                <select
                  value={statusEntrega}
                  onChange={(e) => setStatusEntrega(e.target.value)}
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                >
                  <option value="Pendente">Pendente</option>
                  <option value="Em rota">Em rota</option>
                  <option value="Entregue">Entregue</option>
                  <option value="Cancelado">Cancelado</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ordem-rota">Ordem da Rota</Label>
                <Input
                  id="ordem-rota"
                  type="number"
                  min="0"
                  step="1"
                  value={ordemRota}
                  onChange={(e) => setOrdemRota(e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  placeholder="Observações do pedido..."
                  value={observacoes}
                  onChange={(e) => setObservações(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Itens do Pedido</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
              >
                <Plus className="size-4" />
                Adicionar Produto
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

                  return (
                    <div key={index} className="space-y-1">
                      <div className="space-y-2 sm:space-y-0">
                        {/* Mobile: stacked / Desktop: grid */}
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
                              onFocus={() => {
                                setProdutoDropdowns((prev) => ({ ...prev, [index]: true }));
                              }}
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
                                        className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between ${
                                          pi === hl ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"
                                        }`}
                                        onMouseEnter={() => setProdutoHighlights((prev) => ({ ...prev, [index]: pi }))}
                                        onClick={() => handleProdutoSelect(index, String(p.id))}
                                      >
                                        <span className="font-medium">{p.nome}</span>
                                        <span className="ml-2 text-xs">
                                          {hasDiscountPromo ? (
                                            <>
                                              <span className="line-through text-muted-foreground">{formatPrice(p.preco)}</span>
                                              {" "}
                                              <span className="text-green-400">{formatPrice(pPromo.precoPromocional)}</span>
                                            </>
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
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantidade}
                              onChange={(e) =>
                                handleItemChange(index, "quantidade", e.target.value)
                              }
                            />
                          </div>

                          <div className="hidden sm:block space-y-1">
                            <Label className="text-xs">Preço Unit.</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.precoUnitario}
                              onChange={(e) =>
                                handleItemChange(index, "precoUnitario", e.target.value)
                              }
                            />
                          </div>

                          <div className="hidden sm:block space-y-1">
                            <Label className="text-xs">Subtotal</Label>
                            <div className="flex h-8 items-center text-sm">
                              <span>{formatPrice(subtotal)}</span>
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="destructive"
                            size="icon-sm"
                            onClick={() => handleRemoveItem(index)}
                            className="mb-0.5"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>

                        {/* Mobile-only: Qtd, Price, Subtotal in a row */}
                        <div className="grid grid-cols-3 gap-2 sm:hidden">
                          <div className="space-y-1">
                            <Label className="text-xs">Qtd</Label>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantidade}
                              onChange={(e) => handleItemChange(index, "quantidade", e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Preço</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.precoUnitario}
                              onChange={(e) => handleItemChange(index, "precoUnitario", e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Subtotal</Label>
                            <div className="flex h-8 items-center text-sm font-medium">{formatPrice(subtotal)}</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pl-0.5">
                        {isDescontoPromo && produto && (
                          <>
                            <Badge className="bg-green-600 text-white text-xs">
                              Promo: {formatPrice(promo.precoPromocional)}
                            </Badge>
                            <span className="text-xs text-muted-foreground line-through">
                              {formatPrice(produto.preco)}
                            </span>
                          </>
                        )}
                        {isLevePromo && (
                          <Badge className="bg-blue-600 text-white text-xs">
                            Leve {promo.leveQuantidade} Pague {promo.pagueQuantidade}
                          </Badge>
                        )}
                        {qtdCobrada !== null && (
                          <span className="text-xs text-muted-foreground">
                            ({qtdCobrada} un. cobradas)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={taxaEntregaAtiva}
                        onChange={(e) => setTaxaEntregaAtiva(e.target.checked)}
                        className="size-4 accent-primary cursor-pointer"
                      />
                      <span className="text-sm">Taxa de Entrega</span>
                    </label>
                    {taxaEntregaAtiva && (
                      <div className="flex items-center gap-2">
                        <Input
                          id="taxaEntrega"
                          type="number"
                          step="0.01"
                          min="0"
                          value={taxaEntregaValor}
                          onChange={(e) => setTaxaEntregaValor(parseFloat(e.target.value) || 0)}
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">
                          {formatPrice(taxaEntregaValor)}
                        </span>
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

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Save className="size-4" />
            {saving ? "Salvando..." : "Salvar Pedido"}
          </Button>
        </div>
      </form>
    </div>
  );
}
