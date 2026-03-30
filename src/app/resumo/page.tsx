"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3, DollarSign, TrendingUp, Clock, Package, Users, MapPin,
  Truck, ArrowUp, ArrowDown, Minus, Receipt, CreditCard, Calendar,
  Download, ChevronRight, AlertTriangle,
} from "lucide-react";
import { formatCurrency as fmt, todayStr } from "@/lib/formatting";

// ── Types ──

interface VendaProduto { produto: string; quantidade: number; total: number }
interface TopCliente { cliente: string; bairro: string; pedidos: number; total: number; ticketMedio: number }
interface VendaBairro { bairro: string; pedidos: number; total: number }
interface VendaPagamento { forma: string; pedidos: number; total: number }
interface VendaDia { data: string; total: number; pedidos: number }
interface VendaMes { mes: number; mesNome: string; total: number; pedidos: number }

interface Comparativo {
  dataInicioAnterior: string; dataFimAnterior: string;
  totalVendidoAnterior: number; totalPedidosAnterior: number;
  totalRecebidoAnterior: number; ticketMedioAnterior: number;
  variacaoVendas: number; variacaoPedidos: number;
  variacaoRecebido: number; variacaoTicketMedio: number;
}

interface DespesaSubcategoria {
  nome: string; realizado: number; projetado: number; vencido: number;
}

interface DespesaCategoria {
  categoria: string; realizado: number; projetado: number; vencido: number;
  subcategorias?: DespesaSubcategoria[];
}

interface InadimplenciaCliente {
  pedidoId: number; clienteId: number; cliente: string; bairro: string;
  valor: number; dataEntrega: string; diasAtraso: number;
}

interface Inadimplencia {
  total: number;
  quantidade: number;
  clientes: InadimplenciaCliente[];
}

interface Financeiro {
  receita: number; recebido: number; aReceber: number;
  despesas: number; despesasPagas: number; despesasPendentes: number;
  despesasVencidas: number; despesasRealizadas: number; despesasProjetadas: number;
  lucroEstimado: number; fluxoCaixa: number;
  receitaProjetada: number; aEntregarValor: number; aCobrar: number;
  fluxoCaixaProjetado: number; lucroEstimadoProjetado: number;
  contasPendentesQtd: number; contasVencidasQtd: number;
  despesasPorCategoria: DespesaCategoria[];
  despesasPorMes: { mes: number; mesNome: string; pagas: number; pendentes: number }[];
}

interface Resumo {
  periodo: string; dataInicio: string; dataFim: string;
  totalPedidos: number; totalVendido: number; totalRecebido: number;
  totalPendente: number; totalTaxaEntrega: number; ticketMedio: number;
  totalPedidosProjetado: number; totalVendasProjetado: number;
  totalAEntregarValor: number; totalACobrar: number; ticketMedioProjetado: number;
  comparativo: Comparativo;
  vendasPorProduto: VendaProduto[]; vendasPorProdutoProjetado: VendaProduto[];
  topClientes: TopCliente[]; topClientesProjetado: TopCliente[];
  vendasPorBairro: VendaBairro[]; vendasPorBairroProjetado: VendaBairro[];
  vendasPorPagamento: VendaPagamento[];
  vendasPorPagamentoProjetado: VendaPagamento[];
  statusEntregas: Record<string, number>;
  vendasPorDia: VendaDia[]; vendasPorMes: VendaMes[]; vendasPorMesAnterior: VendaMes[]; vendasPorMesTodos: VendaMes[];
  financeiro: Financeiro;
  inadimplencia: Inadimplencia;
}

// ── Helpers ──

function fmtDate(s: string) { if (!s) return ""; const [y,m,d]=s.split("-"); return `${d}/${m}/${y}` }
function fmtShort(s: string) { if (!s) return ""; const [,m,d]=s.split("-"); return `${d}/${m}` }

type Periodo = "dia" | "semana" | "mes" | "ano" | "custom";
type Tab = "geral" | "financeiro";
type ViewMode = "realizado" | "projetado";

function Var({ v }: { v: number }) {
  if (Math.abs(v) < 0.5) return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Minus className="size-3" /> 0%</span>;
  if (v > 0) return <span className="flex items-center gap-1 text-xs text-green-500"><ArrowUp className="size-3" /> +{v.toFixed(1)}%</span>;
  return <span className="flex items-center gap-1 text-xs text-red-500"><ArrowDown className="size-3" /> {v.toFixed(1)}%</span>;
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return <div className="w-full bg-muted rounded-full h-2 overflow-hidden"><div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.max(pct, 2)}%` }} /></div>;
}

function Rank({ i }: { i: number }) {
  if (i > 2) return <span className="text-muted-foreground text-sm">{i + 1}</span>;
  const c = ["bg-yellow-500", "bg-zinc-400", "bg-amber-700"];
  return <Badge className={`${c[i]} text-white text-xs px-1.5`}>{i + 1}</Badge>;
}

function Empty({ t }: { t: string }) { return <p className="text-center text-muted-foreground py-6 text-sm">{t}</p> }

// Clickable section card
function SectionCard({ title, icon: Icon, href, children }: { title: string; icon: any; href?: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Card className={href ? "cursor-pointer hover:border-primary/30 transition-colors" : ""} onClick={href ? () => router.push(href) : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className="size-4" />
          {title}
          {href && <ChevronRight className="size-3 ml-auto text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// Compact KPI card for Financeiro tab
function KpiCard({ label, value, subtitle, icon: Icon, color, border, href }: {
  label: string; value: string; subtitle?: string; icon?: any; color?: string; border?: string; href?: string;
}) {
  const router = useRouter();
  return (
    <Card
      className={`${border || ""} ${href ? "cursor-pointer hover:border-primary/30" : ""} transition-colors`}
      onClick={href ? () => router.push(href) : undefined}
    >
      <CardContent className="px-3 py-2">
        <p className="text-[11px] text-muted-foreground flex items-center gap-1 leading-tight">
          {Icon && <Icon className="size-3" />}{label}
        </p>
        <p className={`text-[15px] font-bold leading-tight mt-0.5 ${color || ""}`}>{value}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground leading-tight">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

// ── Main Component ──

export default function ResumoPage() {
  const [data, setData] = useState(todayStr());
  const [periodo, setPeriodo] = useState<Periodo>("dia");
  const [customInicio, setCustomInicio] = useState(todayStr());
  const [customFim, setCustomFim] = useState(todayStr());
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("geral");
  const [viewMode, setViewMode] = useState<ViewMode>("projetado");

  const fetchResumo = useCallback(async () => {
    try {
      setLoading(true);
      setErro(null);
      let url = `/api/resumo?data=${data}&periodo=${periodo}`;
      if (periodo === "custom") url = `/api/resumo?periodo=custom&dataInicio=${customInicio}&dataFim=${customFim}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErro(`Erro ${res.status}: ${body?.error ?? res.statusText}`);
        return;
      }
      setResumo(await res.json());
    } catch (e) {
      setErro(`Erro de conexão: ${e instanceof Error ? e.message : String(e)}`);
      console.error("Erro:", e);
    }
    finally { setLoading(false) }
  }, [data, periodo, customInicio, customFim]);

  useEffect(() => { fetchResumo() }, [fetchResumo]);

  const periodoLabels: Record<Periodo, string> = { dia: "ontem", semana: "semana anterior", mes: "mês anterior", ano: "ano anterior", custom: "período anterior" };
  const isAno = periodo === "ano";

  // Build date query params for navigation
  const dateParams = resumo ? `dataInicio=${resumo.dataInicio}&dataFim=${resumo.dataFim}` : "";

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header + Export */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-5" />
          <h1 className="text-2xl font-semibold tracking-tight">Resumo</h1>
        </div>
        <div className="flex gap-1.5">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setViewMode("realizado")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "realizado" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Realizado
            </button>
            <button
              onClick={() => setViewMode("projetado")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-border ${viewMode === "projetado" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              + Projetado
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.open("/api/exportar?tipo=tudo", "_blank")}>
            <Download className="size-3.5" /> Exportar
          </Button>
        </div>
      </div>

      {/* Sub-tabs: Geral / Financeiro */}
      <div className="flex gap-1 border-b border-border">
        {([{ key: "geral" as Tab, label: "Geral", icon: BarChart3 }, { key: "financeiro" as Tab, label: "Financeiro", icon: DollarSign }]).map((t) => {
          const I = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <I className="size-3.5" />{t.label}
            </button>
          );
        })}
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1">
          {(["dia", "semana", "mes", "ano", "custom"] as Periodo[]).map((p) => (
            <Button key={p} variant={periodo === p ? "default" : "outline"} size="sm"
              onClick={() => { setPeriodo(p); if (p !== "custom") setData(todayStr()) }}>
              {{ dia: "Dia", semana: "Semana", mes: "Mês", ano: "Ano", custom: "Custom" }[p]}
            </Button>
          ))}
        </div>
        {periodo !== "custom" ? (
          <div className="space-y-1">
            <Label className="text-xs">Data ref.</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-full sm:w-40 h-8 text-sm" />
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" value={customInicio} onChange={(e) => setCustomInicio(e.target.value)} className="w-full sm:w-40 h-8 text-sm" /></div>
            <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" value={customFim} onChange={(e) => setCustomFim(e.target.value)} className="w-full sm:w-40 h-8 text-sm" /></div>
          </div>
        )}
        {resumo && <span className="text-xs text-muted-foreground">{fmtDate(resumo.dataInicio)}{resumo.dataInicio !== resumo.dataFim ? ` a ${fmtDate(resumo.dataFim)}` : ""}</span>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="animate-pulse text-muted-foreground">Carregando...</div></div>
      ) : !resumo ? (
        <Empty t={erro ?? "Erro ao carregar resumo."} />
      ) : tab === "geral" ? (
        <GeralTab resumo={resumo} periodo={periodo} periodoLabels={periodoLabels} isAno={isAno} viewMode={viewMode} dateParams={dateParams} />
      ) : (
        <FinanceiroTab resumo={resumo} periodo={periodo} periodoLabels={periodoLabels} viewMode={viewMode} dateParams={dateParams} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// GERAL TAB
// ══════════════════════════════════════════

function GeralTab({ resumo, periodo, periodoLabels, isAno, viewMode, dateParams }: { resumo: Resumo; periodo: Periodo; periodoLabels: Record<Periodo, string>; isAno: boolean; viewMode: ViewMode; dateParams: string }) {
  const router = useRouter();
  const proj = viewMode === "projetado";

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {([
          { label: "Pedidos", value: String(proj ? resumo.totalPedidosProjetado : resumo.totalPedidos), icon: Package, variacao: resumo.comparativo.variacaoPedidos,
            href: proj ? `/pedidos?${dateParams}&statusEntrega=Pendente,Em rota,Entregue` : `/pedidos?${dateParams}&statusEntrega=Entregue` },
          { label: "Vendas", value: fmt(proj ? resumo.totalVendasProjetado : resumo.totalVendido), icon: DollarSign, variacao: resumo.comparativo.variacaoVendas,
            href: proj ? `/pedidos?${dateParams}&statusEntrega=Pendente,Em rota,Entregue` : `/pedidos?${dateParams}&statusEntrega=Entregue` },
          { label: "Recebido", value: fmt(resumo.totalRecebido), icon: TrendingUp, variacao: resumo.comparativo.variacaoRecebido,
            href: `/pedidos?${dateParams}&statusEntrega=Entregue&situacaoPagamento=Pago` },
          { label: "A Entregar", value: fmt(resumo.totalAEntregarValor), icon: Truck, show: proj,
            href: `/pedidos?${dateParams}&statusEntrega=Pendente,Em rota` },
          { label: "A Cobrar", value: fmt(resumo.totalACobrar), icon: Clock,
            href: `/pedidos?${dateParams}&statusEntrega=Entregue&situacaoPagamento=Pendente` },
          { label: "Ticket Médio", value: fmt(proj ? resumo.ticketMedioProjetado : resumo.ticketMedio), icon: Receipt, variacao: resumo.comparativo.variacaoTicketMedio,
            href: `/pedidos?${dateParams}&statusEntrega=Entregue` },
          { label: "Tx. Entrega", value: fmt(resumo.totalTaxaEntrega), icon: Truck,
            href: `/pedidos?${dateParams}&statusEntrega=Entregue` },
        ] as { label: string; value: string; icon: any; variacao?: number; show?: boolean; href: string }[]).filter((kpi) => kpi.show === undefined || kpi.show).map((kpi) => {
          const K = kpi.icon;
          return (
            <Card key={kpi.label} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => router.push(kpi.href)}>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground font-normal"><K className="size-3.5" />{kpi.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold tracking-tight">{kpi.value}</p>
                {kpi.variacao !== undefined && <Var v={kpi.variacao} />}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Comparativo */}
      {(resumo.comparativo.totalPedidosAnterior > 0 || resumo.comparativo.totalVendidoAnterior > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="size-4" />
              Comparativo com {periodoLabels[periodo]}
              <span className="text-xs text-muted-foreground font-normal">
                ({fmtShort(resumo.comparativo.dataInicioAnterior)}{resumo.comparativo.dataInicioAnterior !== resumo.comparativo.dataFimAnterior ? ` a ${fmtShort(resumo.comparativo.dataFimAnterior)}` : ""})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Vendas", atual: fmt(proj ? resumo.totalVendasProjetado : resumo.totalVendido), anterior: fmt(resumo.comparativo.totalVendidoAnterior), v: resumo.comparativo.variacaoVendas },
                { label: "Pedidos", atual: String(proj ? resumo.totalPedidosProjetado : resumo.totalPedidos), anterior: String(resumo.comparativo.totalPedidosAnterior), v: resumo.comparativo.variacaoPedidos },
                { label: "Recebido", atual: fmt(resumo.totalRecebido), anterior: fmt(resumo.comparativo.totalRecebidoAnterior), v: resumo.comparativo.variacaoRecebido },
                { label: "Ticket Médio", atual: fmt(proj ? resumo.ticketMedioProjetado : resumo.ticketMedio), anterior: fmt(resumo.comparativo.ticketMedioAnterior), v: resumo.comparativo.variacaoTicketMedio },
              ].map((c) => (
                <div key={c.label} className="space-y-1">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold">{c.atual}</span>
                    {proj && <span className="text-[10px] text-muted-foreground/70">Projetado</span>}
                    <Var v={c.v} />
                  </div>
                  <p className="text-xs text-muted-foreground">anterior: {c.anterior}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Year comparison chart */}
      {isAno && resumo.vendasPorMes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="size-4" />
              Mês a Mês — {resumo.dataInicio.slice(0, 4)}
              <span className="text-xs text-muted-foreground font-normal">vs {resumo.comparativo.dataInicioAnterior.slice(0, 4)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(() => {
                const dadosAno = proj ? resumo.vendasPorMesTodos : resumo.vendasPorMes;
                const mx = Math.max(...dadosAno.map(m => m.total), ...resumo.vendasPorMesAnterior.map(m => m.total), 1);
                return dadosAno.map((mes, idx) => {
                  const ant = resumo.vendasPorMesAnterior[idx];
                  const real = resumo.vendasPorMes[idx];
                  return (
                    <div key={mes.mes} className="space-y-0.5">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-8 shrink-0">{mes.mesNome}</span>
                        <div className="flex-1 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1"><Bar value={mes.total} max={mx} color="bg-primary" /></div>
                            <span className="text-xs font-medium w-20 text-right">{fmt(mes.total)}</span>
                          </div>
                          {proj && real && real.total < mes.total && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1"><Bar value={real.total} max={mx} color="bg-teal-500" /></div>
                              <span className="text-xs text-teal-500 w-20 text-right">{fmt(real.total)}</span>
                            </div>
                          )}
                          {ant && ant.total > 0 && <div className="flex items-center gap-2"><div className="flex-1"><Bar value={ant.total} max={mx} color="bg-muted-foreground/30" /></div><span className="text-xs text-muted-foreground w-20 text-right">{fmt(ant.total)}</span></div>}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-full bg-primary" />{proj ? "Total (c/ pendentes)" : "Realizado"} {resumo.dataInicio.slice(0, 4)}</div>
              {proj && <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-full bg-teal-500" />Entregue</div>}
              <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-full bg-muted-foreground/30" />{resumo.comparativo.dataInicioAnterior.slice(0, 4)}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status + Pagamentos (hide for year) */}
      {!isAno && (
        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard title="Status das Entregas" icon={Truck} href="/rota">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(resumo.statusEntregas).map(([st, ct]) => (
                <div key={st} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span className="text-xs text-muted-foreground">{st}</span>
                  <span className="text-lg font-bold">{ct}</span>
                </div>
              ))}
            </div>
            {resumo.totalPedidosProjetado > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Conclusão: <strong>{(((resumo.statusEntregas["Entregue"] || 0) / resumo.totalPedidosProjetado) * 100).toFixed(0)}%</strong>
              </p>
            )}
          </SectionCard>

          {(() => {
            const pagamentos = proj ? resumo.vendasPorPagamentoProjetado : resumo.vendasPorPagamento;
            return (
              <SectionCard title="Formas de Pagamento" icon={CreditCard}>
                {pagamentos.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p> : (
                  <div className="space-y-3">
                    {pagamentos.map((vp) => {
                      const base = pagamentos.reduce((s, v) => s + v.total, 0);
                      const pct = base > 0 ? (vp.total / base) * 100 : 0;
                      return (
                        <div key={vp.forma} className="space-y-1">
                          <div className="flex justify-between text-sm"><span>{vp.forma}</span><span className="font-medium">{fmt(vp.total)} <span className="text-muted-foreground text-xs">({pct.toFixed(0)}%)</span></span></div>
                          <Bar value={vp.total} max={base || 1} color="bg-primary" />
                          <p className="text-xs text-muted-foreground">{vp.pedidos} pedido{vp.pedidos !== 1 ? "s" : ""}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            );
          })()}
        </div>
      )}

      <Separator />

      {/* Vendas por Dia (hide for year) */}
      {!isAno && resumo.vendasPorDia.length > 1 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Calendar className="size-4" />Vendas por Dia</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {resumo.vendasPorDia.map((dia) => {
                const mx = Math.max(...resumo.vendasPorDia.map(d => d.total));
                return (
                  <div key={dia.data} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-12 shrink-0">{fmtShort(dia.data)}</span>
                    <div className="flex-1"><Bar value={dia.total} max={mx} color="bg-primary" /></div>
                    <span className="text-xs font-medium w-24 text-right">{fmt(dia.total)}</span>
                    <span className="text-xs text-muted-foreground w-16 text-right">{dia.pedidos} ped.</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rankings side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(() => {
          const produtos = proj ? resumo.vendasPorProdutoProjetado : resumo.vendasPorProduto;
          const totalBase = proj ? resumo.totalVendasProjetado : resumo.totalVendido;
          return (
            <SectionCard title="Ranking de Produtos" icon={Package} href="/produtos">
              {produtos.length === 0 ? <Empty t="Nenhuma venda no período." /> : (
                <div className="space-y-2">
                  {produtos.map((vp, i) => {
                    const mx = produtos[0]?.total || 1;
                    const pct = totalBase > 0 ? (vp.total / totalBase) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-6 shrink-0 text-center"><Rank i={i} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline"><span className="text-sm font-medium truncate">{vp.produto}</span><span className="text-sm font-bold ml-2 shrink-0">{fmt(vp.total)}</span></div>
                          <div className="flex items-center gap-2 mt-0.5"><div className="flex-1"><Bar value={vp.total} max={mx} color="bg-green-500" /></div><span className="text-xs text-muted-foreground shrink-0">{vp.quantidade}un · {pct.toFixed(0)}%</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          );
        })()}

        {(() => {
          const clientes = proj ? resumo.topClientesProjetado : resumo.topClientes;
          return (
            <SectionCard title="Top Clientes" icon={Users} href="/clientes">
              {clientes.length === 0 ? <Empty t="Nenhum cliente no período." /> : (
                <div className="space-y-2">
                  {clientes.map((tc, i) => {
                    const mx = clientes[0]?.total || 1;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-6 shrink-0 text-center"><Rank i={i} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline">
                            <div className="min-w-0"><span className="text-sm font-medium truncate block">{tc.cliente}</span>{tc.bairro && <span className="text-xs text-muted-foreground">{tc.bairro}</span>}</div>
                            <div className="text-right ml-2 shrink-0"><span className="text-sm font-bold block">{fmt(tc.total)}</span><span className="text-xs text-muted-foreground">{tc.pedidos} ped. · TM {fmt(tc.ticketMedio)}</span></div>
                          </div>
                          <div className="mt-0.5"><Bar value={tc.total} max={mx} color="bg-purple-500" /></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          );
        })()}
      </div>

      {/* Vendas por Bairro */}
      {(() => {
        const bairros = proj ? resumo.vendasPorBairroProjetado : resumo.vendasPorBairro;
        const totalBase = proj ? resumo.totalVendasProjetado : resumo.totalVendido;
        return (
          <SectionCard title="Vendas por Bairro" icon={MapPin} href={`/pedidos?${dateParams}&statusEntrega=Entregue`}>
            {bairros.length === 0 ? <Empty t="Sem dados de bairro." /> : (
              <div className="grid gap-2 md:grid-cols-2">
                {bairros.map((vb) => {
                  const mx = bairros[0]?.total || 1;
                  const pct = totalBase > 0 ? (vb.total / totalBase) * 100 : 0;
                  return (
                    <div key={vb.bairro} className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2">
                      <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-sm"><span className="truncate">{vb.bairro}</span><span className="font-medium ml-2 shrink-0">{fmt(vb.total)}</span></div>
                        <Bar value={vb.total} max={mx} color="bg-blue-500" />
                        <span className="text-xs text-muted-foreground">{vb.pedidos} pedido{vb.pedidos !== 1 ? "s" : ""} · {pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        );
      })()}
    </div>
  );
}

// ══════════════════════════════════════════
// FINANCEIRO TAB
// ══════════════════════════════════════════

function FinanceiroTab({ resumo, periodo, periodoLabels, viewMode, dateParams }: { resumo: Resumo; periodo: Periodo; periodoLabels: Record<Periodo, string>; viewMode: ViewMode; dateParams: string }) {
  const router = useRouter();
  const f = resumo.financeiro;
  const inad = resumo.inadimplencia;
  const proj = viewMode === "projetado";
  const resultadoRealizado = f.recebido - f.despesasRealizadas;
  const receitaProjetadaTotal = f.receitaProjetada + inad.total;
  const despesasTotais = f.despesasRealizadas + f.despesasProjetadas + f.despesasVencidas;
  const resultadoProjetado = receitaProjetadaTotal - despesasTotais;

  return (
    <div className="space-y-6">
      {/* ── Linha 1: Caixa ── */}
      <div className={`grid gap-3 ${proj ? "grid-cols-2" : "grid-cols-1 max-w-xs"}`}>
        <KpiCard
          label="Fluxo de Caixa" icon={DollarSign}
          value={fmt(f.fluxoCaixa)}
          subtitle="recebido - despesas pagas"
          color={f.fluxoCaixa >= 0 ? "text-green-500" : "text-red-500"}
          border={f.fluxoCaixa >= 0 ? "border-green-500/30" : "border-red-500/30"}
          href={`/pedidos?${dateParams}&statusEntrega=Entregue&situacaoPagamento=Pago`}
        />
        {proj && (
          <KpiCard
            label="Fluxo Projetado" icon={DollarSign}
            value={fmt(resultadoProjetado)}
            subtitle="receita projetada - despesas totais"
            color={resultadoProjetado >= 0 ? "text-green-500" : "text-red-500"}
            border={resultadoProjetado >= 0 ? "border-green-500/20" : "border-red-500/20"}
            href={`/pedidos?${dateParams}&statusEntrega=Pendente,Em rota,Entregue`}
          />
        )}
      </div>

      <Separator />

      {/* ── Linha 2: Receita ── */}
      <div className={`grid gap-3 ${proj ? "grid-cols-3" : "grid-cols-2"}`}>
        <KpiCard
          label="Receita Realizada" icon={TrendingUp}
          value={fmt(f.recebido)}
          subtitle="entregues e pagos"
          color="text-teal-500"
          href={`/pedidos?${dateParams}&statusEntrega=Entregue&situacaoPagamento=Pago`}
        />
        {proj && (
          <KpiCard
            label="Receita Projetada"
            value={fmt(receitaProjetadaTotal)}
            subtitle={`${fmt(f.receitaProjetada)} período + ${fmt(inad.total)} inadimplência`}
            color="text-yellow-500"
            href={`/pedidos?${dateParams}&statusEntrega=Pendente,Em rota,Entregue`}
          />
        )}
        <KpiCard
          label="Inadimplência" icon={AlertTriangle}
          value={inad.quantidade > 0 ? fmt(inad.total) : "R$ 0,00"}
          subtitle={inad.quantidade > 0 ? `${inad.quantidade} pedido${inad.quantidade !== 1 ? "s" : ""} em atraso` : "nenhum atraso"}
          color={inad.quantidade > 0 ? "text-red-500" : "text-muted-foreground"}
          border={inad.quantidade > 0 ? "border-red-500/30" : ""}
          href="/pedidos?statusEntrega=Entregue&situacaoPagamento=Pendente"
        />
      </div>

      <Separator />

      {/* ── Linha 3: Despesas ── */}
      <div className={`grid gap-3 ${proj ? (f.despesasVencidas > 0 ? "grid-cols-3" : "grid-cols-2") : (f.despesasVencidas > 0 ? "grid-cols-2" : "grid-cols-1 max-w-xs")}`}>
        <KpiCard
          label="Despesas Realizadas" icon={Receipt}
          value={fmt(f.despesasRealizadas)}
          subtitle="contas pagas no período"
          href={`/contas?${dateParams}&situacao=Pago`}
        />
        {proj && (
          <KpiCard
            label="Despesas Projetadas"
            value={fmt(f.despesasProjetadas)}
            subtitle={`${f.contasPendentesQtd} conta${f.contasPendentesQtd !== 1 ? "s" : ""} pendente${f.contasPendentesQtd !== 1 ? "s" : ""}`}
            color="text-yellow-500"
            border="border-yellow-500/30"
            href={`/contas?${dateParams}&situacao=Pendente`}
          />
        )}
        {f.despesasVencidas > 0 && (
          <KpiCard
            label="Despesas Vencidas"
            value={fmt(f.despesasVencidas)}
            subtitle={`${f.contasVencidasQtd} conta${f.contasVencidasQtd !== 1 ? "s" : ""} vencida${f.contasVencidasQtd !== 1 ? "s" : ""}`}
            color="text-red-500"
            border="border-red-500/30"
            href={`/contas?${dateParams}&situacao=Vencida`}
          />
        )}
      </div>

      {/* Revenue vs Expenses */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="size-4" />
            Receitas vs Despesas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(() => {
            const maxBar = Math.max(
              proj ? receitaProjetadaTotal : f.recebido,
              despesasTotais,
              1
            );
            return [
              { label: "Receita total projetada", value: receitaProjetadaTotal, color: "bg-green-400", textColor: "text-green-400", hidden: !proj },
              { label: "Recebido", value: f.recebido, color: "bg-teal-500", textColor: "text-teal-500" },
              { label: "Despesas realizadas", value: f.despesasRealizadas, color: "bg-red-400", textColor: "text-red-400" },
              { label: "Despesas projetadas", value: f.despesasProjetadas, color: "bg-yellow-500", textColor: "text-yellow-500", hidden: !proj },
              { label: "Despesas vencidas", value: f.despesasVencidas, color: "bg-red-500", textColor: "text-red-500", hidden: !proj || f.despesasVencidas <= 0 },
            ].filter((r) => !r.hidden).map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="flex justify-between text-sm"><span>{row.label}</span><span className={`font-medium ${row.textColor}`}>{fmt(row.value)}</span></div>
                <Bar value={row.value} max={maxBar} color={row.color} />
              </div>
            ));
          })()}
        </CardContent>
      </Card>

      {/* Inadimplência — lista detalhada (global, sempre visível) */}
      {inad.clientes.length > 0 && (
        <Card className="border-red-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-500">
              <AlertTriangle className="size-4" />
              Inadimplência
              <Badge variant="destructive" className="ml-auto text-xs">{fmt(inad.total)}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 text-xs text-muted-foreground font-medium pb-1 border-b border-border">
                <span>Cliente</span>
                <span className="text-right w-16">Valor</span>
                <span className="text-right w-16">Atraso</span>
                <span className="w-6" />
              </div>
              {inad.clientes.map((item) => (
                <div key={item.pedidoId} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center text-sm py-1.5 border-b border-border/50 last:border-0">
                  <div className="min-w-0">
                    <span className="truncate block font-medium">{item.cliente}</span>
                    {item.bairro && <span className="text-xs text-muted-foreground">{item.bairro}</span>}
                  </div>
                  <span className="text-right text-red-500 font-medium w-16">{fmt(item.valor)}</span>
                  <span className="text-right text-red-400 text-xs w-16">{item.diasAtraso}d</span>
                  <button
                    onClick={() => router.push("/pedidos?statusEntrega=Entregue&situacaoPagamento=Pendente")}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category breakdown */}
      {f.despesasPorCategoria && f.despesasPorCategoria.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Receipt className="size-4" />
              Despesas por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {/* Header */}
              {(() => {
                const hasVencido = f.despesasVencidas > 0;
                const cols = !proj ? "grid-cols-2" : (hasVencido ? "grid-cols-5" : "grid-cols-4");
                return (
                  <>
                    <div className={`grid gap-2 text-xs text-muted-foreground font-medium pb-1 border-b border-border ${cols}`}>
                      <span>Categoria</span>
                      <span className="text-right">Realizado</span>
                      {proj && <span className="text-right">Projetado</span>}
                      {proj && hasVencido && <span className="text-right">Vencido</span>}
                      {proj && <span className="text-right">Total</span>}
                    </div>
                    {/* Rows */}
                    {f.despesasPorCategoria.map((cat) => {
                      const total = cat.realizado + cat.projetado + cat.vencido;
                      return (
                        <React.Fragment key={cat.categoria}>
                          <div className={`grid gap-2 text-sm py-1.5 border-b border-border/50 ${cols}`}>
                            <span className="truncate font-medium">{cat.categoria}</span>
                            <span className="text-right text-red-400">{fmt(cat.realizado)}</span>
                            {proj && <span className="text-right text-yellow-500">{fmt(cat.projetado)}</span>}
                            {proj && hasVencido && <span className="text-right text-red-500">{fmt(cat.vencido)}</span>}
                            {proj && <span className="text-right font-medium">{fmt(total)}</span>}
                          </div>
                          {cat.subcategorias && cat.subcategorias.length > 0 && cat.subcategorias.map((sub) => {
                            const subTotal = sub.realizado + sub.projetado + sub.vencido;
                            return (
                              <div key={sub.nome} className={`grid gap-2 text-xs py-1 border-b border-border/30 last:border-0 ${cols}`}>
                                <span className="truncate pl-4 text-muted-foreground italic">{sub.nome}</span>
                                <span className="text-right text-red-400/70">{fmt(sub.realizado)}</span>
                                {proj && <span className="text-right text-yellow-500/70">{fmt(sub.projetado)}</span>}
                                {proj && hasVencido && <span className="text-right text-red-500/70">{fmt(sub.vencido)}</span>}
                                {proj && <span className="text-right text-muted-foreground">{fmt(subTotal)}</span>}
                              </div>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                    {/* Total row */}
                    <div className={`grid gap-2 text-sm py-1.5 border-t border-border font-medium ${cols}`}>
                      <span>Total</span>
                      <span className="text-right text-red-400">{fmt(f.despesasRealizadas)}</span>
                      {proj && <span className="text-right text-yellow-500">{fmt(f.despesasProjetadas)}</span>}
                      {proj && hasVencido && <span className="text-right text-red-500">{fmt(f.despesasVencidas)}</span>}
                      {proj && <span className="text-right">{fmt(f.despesas)}</span>}
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Despesas por mês (only in "ano" period) */}
      {periodo === "ano" && f.despesasPorMes && f.despesasPorMes.length > 0 && f.despesasPorMes.some(d => d.pagas + d.pendentes > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Receipt className="size-4" />
              Despesas Mês a Mês — {resumo.dataInicio.slice(0, 4)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const maxD = Math.max(...f.despesasPorMes.map(d => d.pagas + d.pendentes), 1);
              return (
                <div className="space-y-2">
                  {f.despesasPorMes.filter(d => d.pagas + d.pendentes > 0).map((d) => (
                    <div key={d.mes} className="space-y-0.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{d.mesNome}</span>
                        <span>{fmt(d.pagas + (proj ? d.pendentes : 0))}</span>
                      </div>
                      <div className="flex h-4 w-full rounded overflow-hidden bg-muted/30">
                        <div className="bg-red-500/70" style={{ width: `${(d.pagas / maxD) * 100}%` }} />
                        {proj && d.pendentes > 0 && (
                          <div className="bg-yellow-500/50" style={{ width: `${(d.pendentes / maxD) * 100}%` }} />
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-4 text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-sm bg-red-500/70" />Pagas</span>
                    {proj && <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-sm bg-yellow-500/50" />Pendentes</span>}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Payment breakdown */}
      {(() => {
        const pagamentos = proj ? resumo.vendasPorPagamentoProjetado : resumo.vendasPorPagamento;
        return (
          <SectionCard title="Formas de Pagamento" icon={CreditCard}>
            {pagamentos.length === 0 ? <Empty t="Sem dados" /> : (
              <div className="space-y-3">
                {pagamentos.map((vp) => {
                  const base = pagamentos.reduce((s, v) => s + v.total, 0);
                  const pct = base > 0 ? (vp.total / base) * 100 : 0;
                  return (
                    <div key={vp.forma} className="space-y-1">
                      <div className="flex justify-between text-sm"><span>{vp.forma}</span><span className="font-medium">{fmt(vp.total)} <span className="text-muted-foreground text-xs">({pct.toFixed(0)}%)</span></span></div>
                      <Bar value={vp.total} max={base || 1} color="bg-primary" />
                      <p className="text-xs text-muted-foreground">{vp.pedidos} pedido{vp.pedidos !== 1 ? "s" : ""}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        );
      })()}

      {/* Summary table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Resumo Financeiro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {[
              { label: "Receita (Realizado)", value: fmt(f.recebido), style: "text-teal-500 font-medium" },
              ...(proj ? [{ label: "Receita (Projetado)", value: fmt(receitaProjetadaTotal), style: "text-yellow-500" }] : []),
              { label: "", value: "", style: "border-t border-border pt-2" },
              { label: "Despesas (Realizado)", value: fmt(f.despesasRealizadas), style: "text-red-400" },
              ...(proj ? [{ label: "Despesas (Projetado)", value: fmt(f.despesasProjetadas), style: "text-yellow-500" }] : []),
              ...(f.despesasVencidas > 0 ? [{ label: "Despesas (Vencidas)", value: fmt(f.despesasVencidas), style: "text-red-500" }] : []),
              { label: "", value: "", style: "border-t border-border pt-2" },
              { label: "Resultado (Realizado)", value: fmt(resultadoRealizado), style: resultadoRealizado >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold" },
              ...(proj ? [{ label: "Resultado (Projetado)", value: fmt(resultadoProjetado), style: resultadoProjetado >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold" }] : []),
            ].map((row, i) => row.label ? (
              <div key={i} className={`flex justify-between ${row.style}`}>
                <span className="text-muted-foreground">{row.label}</span>
                <span className={row.style}>{row.value}</span>
              </div>
            ) : <div key={i} className={row.style} />)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
