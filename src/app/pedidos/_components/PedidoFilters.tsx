"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { Pedido, PedidoFilters as Filters } from "@/hooks/use-pedidos";

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-border/50 last:border-0">
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      {children}
    </div>
  );
}

interface PedidoFiltersProps {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  allPedidos: Pedido[];
  emptyFilters: Filters;
  onClose: () => void;
}

export function PedidoFilters({ filters, setFilters, allPedidos, emptyFilters, onClose }: PedidoFiltersProps) {
  const uniqueClientesDrawer = [...new Set(allPedidos.map(p => p.cliente?.nome).filter(Boolean) as string[])].sort();
  const uniqueBairrosDrawer = [...new Set(allPedidos.map(p => p.cliente?.bairro).filter(Boolean) as string[])].sort();
  const uniqueCidadesDrawer = [...new Set(allPedidos.map(p => p.cliente?.cidade).filter(Boolean) as string[])].sort();

  const [drawerClienteSearch, setDrawerClienteSearch] = useState('');
  const [drawerBairroSearch, setDrawerBairroSearch] = useState('');
  const [drawerCidadeSearch, setDrawerCidadeSearch] = useState('');

  function toggleArrayItem<T>(field: keyof Filters, item: T) {
    setFilters(f => {
      const arr = (f[field] as unknown as T[]) || [];
      return { ...f, [field]: arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item] };
    });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden border border-border rounded-lg bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h2 className="text-sm font-semibold">Filtros</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Status do Pedido */}
        <FilterSection label="Status do Pedido">
          <div className="flex flex-wrap gap-1.5">
            {['Pendente', 'Em rota', 'Entregue', 'Cancelado'].map(s => (
              <button key={s} onClick={() => toggleArrayItem('statusPedido', s)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${(filters.statusPedido || []).includes(s) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                {s}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* Cliente */}
        <FilterSection label="Cliente">
          <input placeholder="Buscar cliente..." value={drawerClienteSearch} onChange={e => setDrawerClienteSearch(e.target.value)} className="w-full text-xs px-2 py-1.5 rounded-md border border-input bg-transparent mb-1.5" />
          <div className="max-h-32 overflow-y-auto space-y-0.5">
            {uniqueClientesDrawer.filter(c => !drawerClienteSearch || c.toLowerCase().includes(drawerClienteSearch.toLowerCase())).map(c => (
              <label key={c} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5">
                <input type="checkbox" checked={filters.clientes.includes(c)} onChange={() => toggleArrayItem('clientes', c)} className="accent-[var(--color-primary)]" />
                {c}
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Bairro */}
        <FilterSection label="Bairro">
          <input placeholder="Buscar bairro..." value={drawerBairroSearch} onChange={e => setDrawerBairroSearch(e.target.value)} className="w-full text-xs px-2 py-1.5 rounded-md border border-input bg-transparent mb-1.5" />
          <div className="max-h-32 overflow-y-auto space-y-0.5">
            {uniqueBairrosDrawer.filter(b => !drawerBairroSearch || b.toLowerCase().includes(drawerBairroSearch.toLowerCase())).map(b => (
              <label key={b} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5">
                <input type="checkbox" checked={filters.bairros.includes(b)} onChange={() => toggleArrayItem('bairros', b)} className="accent-[var(--color-primary)]" />
                {b}
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Cidade */}
        <FilterSection label="Cidade">
          <input placeholder="Buscar cidade..." value={drawerCidadeSearch} onChange={e => setDrawerCidadeSearch(e.target.value)} className="w-full text-xs px-2 py-1.5 rounded-md border border-input bg-transparent mb-1.5" />
          <div className="max-h-32 overflow-y-auto space-y-0.5">
            {uniqueCidadesDrawer.filter(c => !drawerCidadeSearch || c.toLowerCase().includes(drawerCidadeSearch.toLowerCase())).map(c => (
              <label key={c} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5">
                <input type="checkbox" checked={filters.cidades.includes(c)} onChange={() => toggleArrayItem('cidades', c)} className="accent-[var(--color-primary)]" />
                {c}
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Forma de Pagamento */}
        <FilterSection label="Forma de Pagamento">
          <div className="space-y-0.5">
            {[...new Map(allPedidos.filter(p => p.formaPagamento).map(p => [p.formaPagamento!.id, p.formaPagamento!])).values()].map(fp => (
              <label key={fp.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5">
                <input type="checkbox" checked={filters.formasPagamento.includes(fp.id)} onChange={() => toggleArrayItem('formasPagamento', fp.id)} className="accent-[var(--color-primary)]" />
                {fp.nome}
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Situacao Pagamento */}
        <FilterSection label="Situacao Pagamento">
          <div className="flex gap-1.5">
            {['', 'Pendente', 'Pago'].map(s => (
              <button key={s} onClick={() => setFilters(f => ({...f, situacaoPagamento: s}))}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${filters.situacaoPagamento === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                {s || 'Todos'}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* Recorrente */}
        <FilterSection label="Recorrente">
          <div className="flex gap-1.5">
            {[{v: '', l: 'Todos'}, {v: 'sim', l: 'Sim'}, {v: 'nao', l: 'Nao'}].map(opt => (
              <button key={opt.v} onClick={() => setFilters(f => ({...f, recorrente: opt.v}))}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${filters.recorrente === opt.v ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                {opt.l}
              </button>
            ))}
          </div>
        </FilterSection>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => { setFilters(f => ({...emptyFilters, dataInicio: f.dataInicio, dataFim: f.dataFim})); }}>
          Limpar filtros
        </Button>
      </div>
    </div>
  );
}
