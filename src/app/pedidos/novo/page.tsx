"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
import { Plus, Trash2, Save, ArrowLeft, RotateCcw, Check } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { calcSubtotal as calcSubtotalBase } from "@/lib/pedido-utils";
import { formatPrice } from "@/lib/formatting";
import type { Produto, FormaPagamento, Promocao, ItemPedidoForm } from "@/lib/types";

type ItemPedido = ItemPedidoForm;

interface Cliente {
  id: number;
  nome: string;
  telefone: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  observacoes?: string;
}

export default function NovoPedidoPage() {
  const router = useRouter();
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
  const [observacoes, setObservações] = useState("");
  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [taxaEntregaAtiva, setTaxaEntregaAtiva] = useState(false);
  const [taxaEntregaValor, setTaxaEntregaValor] = useState(5.0);

  // Último pedido (favorites)
  interface UltimoPedido {
    id: number;
    dataEntrega: string;
    total: number;
    itens: { produtoId: number; quantidade: number; produto: { id: number; nome: string; preco: number } }[];
  }
  const [ultimoPedido, setUltimoPedido] = useState<UltimoPedido | null>(null);
  const [repetido, setRepetido] = useState(false);

  // Product autocomplete state per item
  const [produtoSearches, setProdutoSearches] = useState<Record<number, string>>({});
  const [produtoDropdowns, setProdutoDropdowns] = useState<Record<number, boolean>>({});
  const [produtoHighlights, setProdutoHighlights] = useState<Record<number, number>>({});
  const produtoRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Recurrence
  const [isRecorrente, setIsRecorrente] = useState(false);
  const [diasSemana, setDiasSemana] = useState<number[]>([]);
  const [recDataFim, setRecDataFim] = useState("");
  const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  useEffect(() => {
    fetchClientes();
    fetchProdutos();
    fetchFormasPagamento();
    fetchPromocoes();
  }, []);

  async function fetchClientes() {
    try {
      const res = await fetch("/api/clientes");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setClientes(data);
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
    }
  }

  async function fetchProdutos() {
    try {
      const res = await fetch("/api/produtos");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setProdutos(data);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
    }
  }

  async function fetchFormasPagamento() {
    try {
      const res = await fetch("/api/formas-pagamento");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setFormasPagamento(data);
    } catch (error) {
      console.error("Erro ao buscar formas de pagamento:", error);
    }
  }

  async function fetchPromocoes() {
    try {
      const res = await fetch("/api/promocoes");
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;
      const today = new Date().toISOString().split("T")[0];
      const ativas = data.filter(
        (p: Promocao) => p.ativo && p.dataInicio <= today && p.dataFim >= today
      );
      setPromocoes(ativas);
    } catch (error) {
      console.error("Erro ao buscar promoções:", error);
    }
  }

  // Fetch last order when client changes
  useEffect(() => {
    setUltimoPedido(null);
    setRepetido(false);
    if (!clienteId) return;
    fetch(`/api/pedidos?cliente=${clienteId}&limit=1&orderBy=desc`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setUltimoPedido(data[0]);
        }
      })
      .catch(() => {});
  }, [clienteId]);

  function handleRepetirUltimoPedido() {
    if (!ultimoPedido) return;
    const novosItens: ItemPedido[] = ultimoPedido.itens.map((item) => {
      const produto = produtos.find((p) => p.id === item.produtoId);
      const promo = getPromocaoForProduto(String(item.produtoId));
      let preco = produto?.preco ?? 0;
      if (promo && (promo.tipo || "desconto") === "desconto" && promo.precoPromocional) {
        preco = promo.precoPromocional;
      }
      return {
        produtoId: String(item.produtoId),
        quantidade: String(item.quantidade),
        precoUnitario: preco,
        subtotal: preco * item.quantidade,
        precoManual: false,
      };
    });
    setItens(novosItens);
    // Set search terms for autocomplete
    const searches: Record<number, string> = {};
    novosItens.forEach((item, i) => {
      const produto = produtos.find((p) => String(p.id) === item.produtoId);
      if (produto) searches[i] = produto.nome;
    });
    setProdutoSearches(searches);
    setRepetido(true);
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

  function handleAddItem() {
    setItens([
      ...itens,
      { produtoId: "", quantidade: "1", precoUnitario: 0, subtotal: 0, precoManual: false },
    ]);
  }

  function handleRemoveItem(index: number) {
    setItens(applyCompraParceiraDiscounts(itens.filter((_, i) => i !== index)));
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
    setItens(applyCompraParceiraDiscounts(updated));
  }

  function calcSubtotalFor(item: ItemPedido): { subtotal: number; qtdCobrada: number | null } {
    return calcSubtotal(item);
  }

  // Apply compra_parceira discounts to partner products when primary is in order
  function applyCompraParceiraDiscounts(items: ItemPedido[]): ItemPedido[] {
    const produtoIdSet = new Set(items.map((i) => i.produtoId));
    return items.map((item) => {
      if (item.precoManual) return item;
      const parceiraPromo = promocoes.find(
        (p) => p.tipo === "compra_parceira" && p.produtoId2 !== null && String(p.produtoId2) === item.produtoId
      );
      if (!parceiraPromo) return item;
      const primaryInOrder = produtoIdSet.has(String(parceiraPromo.produtoId));
      const qty = parseFloat(item.quantidade) || 0;
      if (primaryInOrder) {
        const activePromo = getPromocaoForProduto(item.produtoId, qty);
        if (activePromo) return item;
        const newPrice = parceiraPromo.precoPromocional;
        return { ...item, precoUnitario: newPrice, subtotal: qty * newPrice };
      }
      return item;
    });
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

    const invalidItem = itens.find((item) => !item.produtoId || !item.quantidade);
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
        // If recurrent, also create the recurrence with auto-generation
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
                itens: itens.filter(i => i.produtoId).map(i => ({
                  produtoId: Number(i.produtoId),
                  quantidade: Number(i.quantidade),
                })),
              }),
            });
            // Link the manual order to the recurrence
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
        router.push("/pedidos");
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
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Pedidos", href: "/pedidos" }, { label: "Novo Pedido" }]} />
      <div className="flex items-center gap-4">
        <Link href="/pedidos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold">Novo Pedido</h1>
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
                {selectedCliente.observacoes && (
                  <p className="text-xs text-muted-foreground italic mt-1">Obs: {selectedCliente.observacoes}</p>
                )}
              </div>
            )}

            {selectedCliente && ultimoPedido && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <p className="font-medium text-blue-400">
                      Último pedido ({ultimoPedido.dataEntrega
                        ? ultimoPedido.dataEntrega.split("-").reverse().join("/")
                        : "—"})
                    </p>
                    <p className="text-muted-foreground">
                      {ultimoPedido.itens
                        .map((i) => `${i.quantidade}x ${i.produto.nome}`)
                        .join(", ")}{" "}
                      — {formatPrice(ultimoPedido.total)}
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
                    {repetido ? (
                      <>
                        <Check className="size-4" />
                        Repetido
                      </>
                    ) : (
                      <>
                        <RotateCcw className="size-4" />
                        Repetir
                      </>
                    )}
                  </Button>
                </div>
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
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  value={formaPagamentoId}
                  onChange={(e) => setFormaPagamentoId(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {formasPagamento.map((fp) => (
                    <option key={fp.id} value={String(fp.id)}>
                      {fp.nome}
                    </option>
                  ))}
                </select>
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
              <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
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
                  const qty = parseFloat(item.quantidade || "0");
                  const promo = getPromocaoForProduto(item.produtoId, qty);
                  const produto = produtos.find((p) => String(p.id) === item.produtoId);
                  const { subtotal, qtdCobrada } = calcSubtotal(item);
                  // Partner detection: this item is produtoId2 of a compra_parceira promo
                  const parceiraPartnerPromo = promocoes.find(
                    (p) => p.tipo === "compra_parceira" && p.produtoId2 !== null && String(p.produtoId2) === item.produtoId
                  );
                  const isParceiraPartnerActive = parceiraPartnerPromo && itens.some((i) => String(parceiraPartnerPromo.produtoId) === i.produtoId);

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

                      {/* Show ALL promotions for this product, highlight the active one */}
                      {(() => {
                        const allPromos = promocoes.filter((p) => String(p.produtoId) === item.produtoId);
                        const parceiraPartnerPromo = promocoes.find(
                          (p) => p.tipo === "compra_parceira" && p.produtoId2 !== null && String(p.produtoId2) === item.produtoId
                        );
                        const isParceiraPartnerActive = parceiraPartnerPromo && itens.some((i) => String(parceiraPartnerPromo.produtoId) === i.produtoId);
                        if (allPromos.length === 0 && !isParceiraPartnerActive) return null;
                        return (
                          <div className="flex items-center gap-1.5 pl-0.5 flex-wrap">
                            {allPromos.map((p) => {
                              const isActive = promo?.id === p.id;
                              const opacity = isActive ? "" : "opacity-40";
                              if (p.tipo === "desconto") return (
                                <Badge key={p.id} className={`bg-green-600 text-white text-xs ${opacity}`}>
                                  {p.nome || `Promo: ${formatPrice(p.precoPromocional)}`}
                                </Badge>
                              );
                              if (p.tipo === "leve_x_pague_y") return (
                                <Badge key={p.id} className={`bg-blue-600 text-white text-xs ${opacity}`}>
                                  Leve {p.leveQuantidade} Pague {p.pagueQuantidade}
                                </Badge>
                              );
                              if (p.tipo === "quantidade_minima") return (
                                <Badge key={p.id} className={`bg-purple-600 text-white text-xs ${opacity}`}>
                                  {p.quantidadeMinima}+ un. → {formatPrice(p.precoPromocional)}
                                </Badge>
                              );
                              if (p.tipo === "compra_parceira") return (
                                <Badge key={p.id} className={`bg-orange-600/60 text-white text-xs ${opacity}`}>
                                  Compra parceira
                                </Badge>
                              );
                              return null;
                            })}
                            {isParceiraPartnerActive && parceiraPartnerPromo && (
                              <Badge className="bg-orange-600 text-white text-xs">
                                Parceira: {formatPrice(parceiraPartnerPromo.precoPromocional)}
                              </Badge>
                            )}
                            {produto && promo && item.precoUnitario !== produto.preco && (
                              <span className="text-xs text-muted-foreground line-through">{formatPrice(produto.preco)}</span>
                            )}
                            {qtdCobrada !== null && <span className="text-xs text-muted-foreground">({qtdCobrada} un. cobradas)</span>}
                          </div>
                        );
                      })()}
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
                          className="w-20"
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

        {/* Recurrence toggle */}
        <Card>
          <CardContent className="py-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecorrente}
                onChange={(e) => setIsRecorrente(e.target.checked)}
                className="size-4 accent-primary cursor-pointer"
              />
              <span className="text-sm font-medium">Tornar pedido recorrente</span>
            </label>
            {isRecorrente && (
              <div className="space-y-3 pl-6">
                <div className="space-y-1">
                  <Label className="text-xs">Dias da semana</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DIAS.map((nome, i) => (
                      <button key={i} type="button"
                        onClick={() => setDiasSemana(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i].sort())}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                          diasSemana.includes(i)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-accent"
                        }`}>
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

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
            <Save className="size-4" />
            {saving ? "Salvando..." : isRecorrente ? "Salvar e Gerar Recorrentes" : "Salvar Pedido"}
          </Button>
        </div>
      </form>
    </div>
  );
}
