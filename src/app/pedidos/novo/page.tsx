"use client";

import { useState, useEffect } from "react";
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
import { Plus, Trash2, Save, ArrowLeft } from "lucide-react";
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

function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
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
  const [taxaEntrega, setTaxaEntrega] = useState(5.0);

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
      const data = await res.json();
      setClientes(data);
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
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

  async function fetchFormasPagamento() {
    try {
      const res = await fetch("/api/formas-pagamento");
      const data = await res.json();
      setFormasPagamento(data);
    } catch (error) {
      console.error("Erro ao buscar formas de pagamento:", error);
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
    } catch (error) {
      console.error("Erro ao buscar promoções:", error);
    }
  }

  const selectedCliente = clientes.find((c) => String(c.id) === clienteId);

  const filteredClientes = clienteBusca
    ? clientes.filter((c) =>
        c.nome.toLowerCase().includes(clienteBusca.toLowerCase())
      )
    : clientes;

  function getPromocaoForProduto(produtoId: string): Promocao | undefined {
    return promocoes.find((p) => String(p.produtoId) === produtoId);
  }

  function calcSubtotal(item: ItemPedido): { subtotal: number; qtdCobrada: number | null } {
    const qty = parseFloat(item.quantidade || "0");
    const promo = !item.precoManual ? getPromocaoForProduto(item.produtoId) : undefined;
    const tipo = promo ? (promo.tipo || "desconto") : undefined;
    const subtotal = calcSubtotalBase(qty, item.precoUnitario, tipo, promo?.leveQuantidade, promo?.pagueQuantidade);
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

  function calcSubtotalFor(item: ItemPedido): { subtotal: number; qtdCobrada: number | null } {
    return calcSubtotal(item);
  }

  const subtotalItens = itens.reduce((acc, item) => {
    const { subtotal } = calcSubtotal(item);
    return acc + subtotal;
  }, 0);
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
        // If recurrent, also create the recurrence with auto-generation
        if (isRecorrente && diasSemana.length > 0) {
          try {
            const today = new Date().toISOString().slice(0, 10);
            await fetch("/api/recorrentes", {
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
                itens: itens.filter(i => i.produtoId).map(i => ({
                  produtoId: Number(i.produtoId),
                  quantidade: Number(i.quantidade),
                })),
              }),
            });
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
                          <div className="space-y-1">
                            <Label className="text-xs">Produto</Label>
                            <select
                              className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                              value={item.produtoId}
                              onChange={(e) =>
                                handleItemChange(index, "produtoId", e.target.value)
                              }
                            >
                              <option value="">Selecione...</option>
                              {produtos.map((p) => (
                                <option key={p.id} value={String(p.id)}>
                                  {p.nome}
                                </option>
                              ))}
                            </select>
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
                    <div className="flex items-center gap-2">
                      <Label htmlFor="taxaEntrega" className="text-sm">Taxa de Entrega</Label>
                      <Input
                        id="taxaEntrega"
                        type="number"
                        step="0.01"
                        min="0"
                        value={taxaEntrega}
                        onChange={(e) => setTaxaEntrega(parseFloat(e.target.value) || 0)}
                        className="w-20"
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatPrice(taxaEntrega)}
                    </span>
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
