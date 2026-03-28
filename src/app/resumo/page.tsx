"use client";

import { useState, useEffect, useCallback } from "react";
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
  Download, ChevronRight, Home,
} from "lucide-react";

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

interface DespesaCategoria {
  categoria: string; realizado: number; projetado: number;
}

interface Financeiro {
  receita: number; recebido: number; aReceber: number;
  despesas: number; despesasPagas: number; despesasPendentes: number;
  despesasVencidas: number; despesasRealizadas: number; despesasProjetadas: number;
  lucroEstimado: number; fluxoCaixa: number;
  contasPendentesQtd: number; contasVencidasQtd: number;
  despesasPorCategoria: DespesaCategoria[];
}

interface Resumo {
  periodo: string; dataInicio: string; dataFim: string;
  totalPedidos: number; totalVendido: number; totalRecebido: number;
  totalPendente: number; totalTaxaEntrega: number; ticketMedio: number;
  comparativo: Comparativo;
  vendasPorProduto: VendaProduto[]; topClientes: TopCliente[];
  vendasPorBairro: VendaBairro[]; vendasPorPagamento: VendaPagamento[];
  statusEntregas: Record<string, number>;
  vendasPorDia: VendaDia[]; vendasPorMes: VendaMes[]; vendasPorMesAnterior: VendaMes[];
  financeiro: Financeiro;
}

// ── Helpers ──

function fmt(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }
function fmtDate(s: string) { const [y,m,d]=s.split("-"); return `${d}/${m}/${y}` }
function fmtShort(s: string) { const [,m,d]=s.split("-"); return `${d}/${m}` }
function todayStr() { return new Date().toISOString().slice(0, 10) }

type Periodo = "dia" | "semana" | "mes" | "ano" | "custom";
type Tab = "geral" | "financeiro";
type ViewMode = "realizado" | "projetado";

function Var({ v }: { v: number }) {
  if (Math.abs(v) < 0.5) return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Minus className="size-3" /> 0%</span>;
  if (v > 0) return <span className="flex items-center gap-1 text-xs text-green-500"><ArrowUp className="size-3" /> +{v.toFixed(1)}%</span>;
  return <span className="flex items-center gap-1 text-xs text-red-500"><ArrowDown className="size-3" /> {v.toFixed(1)}%</span>;
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return <div className="w-full bg-muted rounded-full h-2"><div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.max(pct, 2)}%` }} /></div>;
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

// ── Main Component ──

export default function ResumoPage() {
  const [data, setData] = useState(todayStr());
  const [periodo, setPeriodo] = useState<Periodo>("dia");
  const [customInicio, setCustomInicio] = useState(todayStr());
  const [customFim, setCustomFim] = useState(todayStr());
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("geral");
  const [viewMode, setViewMode] = useState<ViewMode>("projetado");

  const fetchResumo = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/api/resumo?data=${data}&periodo=${periodo}`;
      if (periodo === "custom") url = `/api/resumo?periodo=custom&dataInicio=${customInicio}&dataFim=${customFim}`;
      const res = await fetch(url);
      setResumo(await res.json());
    } catch (e) { console.error("Erro:", e) }
    finally { setLoading(false) }
  }, [data, periodo, customInicio, customFim]);

  useEffect(() => { fetchResumo() }, [fetchResumo]);

  const periodoLabels: Record<Periodo, string> = { dia: "ontem", semana: "semana anterior", mes: "mês anterior", ano: "ano anterior", custom: "período anterior" };
  const isAno = periodo === "ano";

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
        <Empty t="Erro ao carregar resumo." />
      ) : tab === "geral" ? (
        <GeralTab resumo={resumo} periodo={periodo} periodoLabels={periodoLabels} isAno={isAno} viewMode={viewMode} />
      ) : (
        <FinanceiroTab resumo={resumo} periodo={periodo} periodoLabels={periodoLabels} viewMode={viewMode} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// GERAL TAB
// ══════════════════════════════════════════

function GeralTab({ resumo, periodo, periodoLabels, isAno, viewMode }: { resumo: Resumo; periodo: Periodo; periodoLabels: Record<Periodo, string>; isAno: boolean; viewMode: ViewMode }) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Pedidos", value: String(resumo.totalPedidos), icon: Package, variacao: resumo.comparativo.variacaoPedidos, href: "/pedidos" },
          { label: "Vendido", value: fmt(resumo.totalVendido), icon: DollarSign, variacao: resumo.comparativo.variacaoVendas, hidden: viewMode === "realizado" },
          { label: "Recebido", value: fmt(resumo.totalRecebido), icon: TrendingUp, variacao: resumo.comparativo.variacaoRecebido },
          { label: "Pendente", value: fmt(resumo.totalPendente), icon: Clock, hidden: viewMode === "realizado" },
          { label: "Ticket Médio", value: fmt(resumo.ticketMedio), icon: Receipt, variacao: resumo.comparativo.variacaoTicketMedio },
          { label: "Tx. Entrega", value: fmt(resumo.totalTaxaEntrega), icon: Truck },
        ].filter((kpi) => !(kpi as { hidden?: boolean }).hidden).map((kpi) => {
          const K = kpi.icon;
          return (
            <Card key={kpi.label} className={kpi.href ? "cursor-pointer hover:border-primary/30" : ""} onClick={kpi.href ? () => router.push(kpi.href!) : undefined}>
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
                { label: "Vendas", atual: fmt(resumo.totalVendido), anterior: fmt(resumo.comparativo.totalVendidoAnterior), v: resumo.comparativo.variacaoVendas },
                { label: "Pedidos", atual: String(resumo.totalPedidos), anterior: String(resumo.comparativo.totalPedidosAnterior), v: resumo.comparativo.variacaoPedidos },
                { label: "Recebido", atual: fmt(resumo.totalRecebido), anterior: fmt(resumo.comparativo.totalRecebidoAnterior), v: resumo.comparativo.variacaoRecebido },
                { label: "Ticket Médio", atual: fmt(resumo.ticketMedio), anterior: fmt(resumo.comparativo.ticketMedioAnterior), v: resumo.comparativo.variacaoTicketMedio },
              ].map((c) => (
                <div key={c.label} className="space-y-1">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <div className="flex items-baseline gap-2"><span className="text-sm font-semibold">{c.atual}</span><Var v={c.v} /></div>
                  <p className="text-xs text-muted-foreground">antes: {c.anterior}</p>
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
              Comparativo Mensal — {resumo.dataInicio.slice(0, 4)} vs {resumo.comparativo.dataInicioAnterior.slice(0, 4)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {resumo.vendasPorMes.map((mes, idx) => {
                const ant = resumo.vendasPorMesAnterior[idx];
                const mx = Math.max(...resumo.vendasPorMes.map(m => m.total), ...resumo.vendasPorMesAnterior.map(m => m.total), 1);
                return (
                  <div key={mes.mes} className="space-y-0.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-8 shrink-0">{mes.mesNome}</span>
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center gap-2"><div className="flex-1"><Bar value={mes.total} max={mx} color="bg-primary" /></div><span className="text-xs font-medium w-20 text-right">{fmt(mes.total)}</span></div>
                        {ant && ant.total > 0 && <div className="flex items-center gap-2"><div className="flex-1"><Bar value={ant.total} max={mx} color="bg-muted-foreground/30" /></div><span className="text-xs text-muted-foreground w-20 text-right">{fmt(ant.total)}</span></div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-full bg-primary" />{resumo.dataInicio.slice(0, 4)}</div>
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
            {resumo.totalPedidos > 0 && <p className="text-xs text-muted-foreground mt-2">Conclusão: <strong>{(((resumo.statusEntregas["Entregue"] || 0) / resumo.totalPedidos) * 100).toFixed(0)}%</strong></p>}
          </SectionCard>

          <SectionCard title="Formas de Pagamento" icon={CreditCard}>
            {resumo.vendasPorPagamento.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p> : (
              <div className="space-y-3">
                {resumo.vendasPorPagamento.map((vp) => {
                  const pct = resumo.totalVendido > 0 ? (vp.total / resumo.totalVendido) * 100 : 0;
                  return (
                    <div key={vp.forma} className="space-y-1">
                      <div className="flex justify-between text-sm"><span>{vp.forma}</span><span className="font-medium">{fmt(vp.total)} <span className="text-muted-foreground text-xs">({pct.toFixed(0)}%)</span></span></div>
                      <Bar value={vp.total} max={resumo.totalVendido} color="bg-primary" />
                      <p className="text-xs text-muted-foreground">{vp.pedidos} pedido{vp.pedidos !== 1 ? "s" : ""}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
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
        <SectionCard title="Ranking de Produtos" icon={Package} href="/produtos">
          {resumo.vendasPorProduto.length === 0 ? <Empty t="Nenhuma venda no período." /> : (
            <div className="space-y-2">
              {resumo.vendasPorProduto.map((vp, i) => {
                const mx = resumo.vendasPorProduto[0]?.total || 1;
                const pct = resumo.totalVendido > 0 ? (vp.total / resumo.totalVendido) * 100 : 0;
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

        <SectionCard title="Top Clientes" icon={Users} href="/clientes">
          {resumo.topClientes.length === 0 ? <Empty t="Nenhum cliente no período." /> : (
            <div className="space-y-2">
              {resumo.topClientes.map((tc, i) => {
                const mx = resumo.topClientes[0]?.total || 1;
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
      </div>

      {/* Vendas por Bairro */}
      <SectionCard title="Vendas por Bairro" icon={MapPin}>
        {resumo.vendasPorBairro.length === 0 ? <Empty t="Sem dados de bairro." /> : (
          <div className="grid gap-2 md:grid-cols-2">
            {resumo.vendasPorBairro.map((vb) => {
              const mx = resumo.vendasPorBairro[0]?.total || 1;
              const pct = resumo.totalVendido > 0 ? (vb.total / resumo.totalVendido) * 100 : 0;
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
    </div>
  );
}

// ══════════════════════════════════════════
// FINANCEIRO TAB
// ══════════════════════════════════════════

function FinanceiroTab({ resumo, periodo, periodoLabels, viewMode }: { resumo: Resumo; periodo: Periodo; periodoLabels: Record<Periodo, string>; viewMode: ViewMode }) {
  const f = resumo.financeiro;
  const soRealizado = viewMode === "realizado";
  const maxBar = Math.max(f.receita, f.despesas, 1);
  const receitaProjetada = f.aReceber;
  const resultadoRealizado = f.recebido - f.despesasRealizadas;
  const resultadoProjetado = resumo.totalVendido - f.despesasRealizadas - f.despesasProjetadas;

  return (
    <div className="space-y-6">
      {/* Financial KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Card className={f.fluxoCaixa >= 0 ? "border-green-500/30" : "border-red-500/30"}>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">Fluxo de Caixa</p>
            <p className={`text-xl font-bold ${f.fluxoCaixa >= 0 ? "text-green-500" : "text-red-500"}`}>{fmt(f.fluxoCaixa)}</p>
            <p className="text-xs text-muted-foreground">recebido - despesas pagas</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">Despesas Realizadas</p>
            <p className="text-xl font-bold">{fmt(f.despesasRealizadas)}</p>
            <p className="text-xs text-muted-foreground">{f.contasPendentesQtd + f.contasVencidasQtd > 0 ? "contas pagas no periodo" : "nenhuma despesa paga"}</p>
          </CardContent>
        </Card>

        {!soRealizado && (
          <Card className="border-yellow-500/30">
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground">Despesas Projetadas</p>
              <p className="text-xl font-bold text-yellow-500">{fmt(f.despesasProjetadas)}</p>
              <p className="text-xs text-muted-foreground">{f.contasPendentesQtd} conta{f.contasPendentesQtd !== 1 ? "s" : ""} pendente{f.contasPendentesQtd !== 1 ? "s" : ""}</p>
            </CardContent>
          </Card>
        )}

        {f.despesasVencidas > 0 && (
          <Card className="border-red-500/30">
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground">Despesas Vencidas</p>
              <p className="text-xl font-bold text-red-500">{fmt(f.despesasVencidas)}</p>
              <p className="text-xs text-muted-foreground">{f.contasVencidasQtd} conta{f.contasVencidasQtd !== 1 ? "s" : ""} vencida{f.contasVencidasQtd !== 1 ? "s" : ""}</p>
            </CardContent>
          </Card>
        )}

        {!soRealizado && (
          <Card>
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground">Lucro Estimado</p>
              <p className={`text-xl font-bold ${f.lucroEstimado >= 0 ? "text-green-500" : "text-red-500"}`}>{fmt(f.lucroEstimado)}</p>
              <p className="text-xs text-muted-foreground">receita - despesas totais</p>
            </CardContent>
          </Card>
        )}

        {!soRealizado && (
          <Card>
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground">A Receber</p>
              <p className="text-xl font-bold text-yellow-500">{fmt(f.aReceber)}</p>
              <p className="text-xs text-muted-foreground">vendido - recebido</p>
            </CardContent>
          </Card>
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
          {[
            { label: "Receita (vendas)", value: f.receita, color: "bg-green-500", textColor: "text-green-500", hidden: soRealizado },
            { label: "Recebido", value: f.recebido, color: "bg-teal-500", textColor: "text-teal-500" },
            { label: "Despesas realizadas", value: f.despesasRealizadas, color: "bg-red-400", textColor: "text-red-400" },
            { label: "Despesas projetadas", value: f.despesasProjetadas, color: "bg-yellow-500", textColor: "text-yellow-500", hidden: soRealizado },
          ].filter((r) => !r.hidden).map((row) => (
            <div key={row.label} className="space-y-1">
              <div className="flex justify-between text-sm"><span>{row.label}</span><span className={`font-medium ${row.textColor}`}>{fmt(row.value)}</span></div>
              <Bar value={row.value} max={maxBar} color={row.color} />
            </div>
          ))}
          {!soRealizado && f.despesasVencidas > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm"><span className="text-red-500">Despesas vencidas</span><span className="font-medium text-red-500">{fmt(f.despesasVencidas)}</span></div>
              <Bar value={f.despesasVencidas} max={maxBar} color="bg-red-500" />
            </div>
          )}
        </CardContent>
      </Card>

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
              <div className={`grid gap-2 text-xs text-muted-foreground font-medium pb-1 border-b border-border ${soRealizado ? "grid-cols-2" : "grid-cols-4"}`}>
                <span>Categoria</span>
                <span className="text-right">Realizado</span>
                {!soRealizado && <span className="text-right">Projetado</span>}
                {!soRealizado && <span className="text-right">Total</span>}
              </div>
              {/* Rows */}
              {f.despesasPorCategoria.map((cat) => {
                const total = cat.realizado + cat.projetado;
                return (
                  <div key={cat.categoria} className={`grid gap-2 text-sm py-1.5 border-b border-border/50 last:border-0 ${soRealizado ? "grid-cols-2" : "grid-cols-4"}`}>
                    <span className="truncate">{cat.categoria}</span>
                    <span className="text-right text-red-400">{fmt(cat.realizado)}</span>
                    {!soRealizado && <span className="text-right text-yellow-500">{fmt(cat.projetado)}</span>}
                    {!soRealizado && <span className="text-right font-medium">{fmt(total)}</span>}
                  </div>
                );
              })}
              {/* Total row */}
              <div className={`grid gap-2 text-sm py-1.5 border-t border-border font-medium ${soRealizado ? "grid-cols-2" : "grid-cols-4"}`}>
                <span>Total</span>
                <span className="text-right text-red-400">{fmt(f.despesasRealizadas)}</span>
                {!soRealizado && <span className="text-right text-yellow-500">{fmt(f.despesasProjetadas)}</span>}
                {!soRealizado && <span className="text-right">{fmt(f.despesas)}</span>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment breakdown */}
      <SectionCard title="Formas de Pagamento" icon={CreditCard}>
        {resumo.vendasPorPagamento.length === 0 ? <Empty t="Sem dados" /> : (
          <div className="space-y-3">
            {resumo.vendasPorPagamento.map((vp) => {
              const pct = resumo.totalVendido > 0 ? (vp.total / resumo.totalVendido) * 100 : 0;
              return (
                <div key={vp.forma} className="space-y-1">
                  <div className="flex justify-between text-sm"><span>{vp.forma}</span><span className="font-medium">{fmt(vp.total)} <span className="text-muted-foreground text-xs">({pct.toFixed(0)}%)</span></span></div>
                  <Bar value={vp.total} max={resumo.totalVendido} color="bg-primary" />
                  <p className="text-xs text-muted-foreground">{vp.pedidos} pedido{vp.pedidos !== 1 ? "s" : ""}</p>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Summary table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Resumo Financeiro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {[
              { label: "Receita (Realizado)", value: fmt(f.recebido), style: "text-teal-500 font-medium" },
              ...(!soRealizado ? [{ label: "Receita (Projetado)", value: fmt(receitaProjetada), style: "text-yellow-500" }] : []),
              { label: "", value: "", style: "border-t border-border pt-2" },
              { label: "Despesas (Realizado)", value: fmt(f.despesasRealizadas), style: "text-red-400" },
              ...(!soRealizado ? [{ label: "Despesas (Projetado)", value: fmt(f.despesasProjetadas), style: "text-yellow-500" }] : []),
              { label: "", value: "", style: "border-t border-border pt-2" },
              { label: "Resultado (Realizado)", value: fmt(resultadoRealizado), style: resultadoRealizado >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold" },
              ...(!soRealizado ? [{ label: "Resultado (Projetado)", value: fmt(resultadoProjetado), style: resultadoProjetado >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold" }] : []),
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
