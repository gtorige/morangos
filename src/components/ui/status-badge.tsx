"use client"

import { Badge } from "@/components/ui/badge"

type StatusContext = "pagamento" | "entrega" | "conta" | "financeiro" | "ativo";

const STATUS_COLORS: Record<string, string> = {
  // Payment
  "Pago": "bg-green-500/15 text-green-400 border-green-500/20",
  "Pendente:pagamento": "bg-red-500/15 text-red-400 border-red-500/20",
  "Pendente:conta": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  // Delivery
  "Pendente:entrega": "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  "Em rota": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "Entregue": "bg-green-500/15 text-green-400 border-green-500/20",
  "Cancelado": "bg-red-500/15 text-red-400 border-red-500/20 line-through",
  // Accounts
  "Vencida": "bg-red-500/15 text-red-400 border-red-500/20",
  // Active/Inactive
  "Ativo": "bg-green-500/15 text-green-400 border-green-500/20",
  "Inativo": "bg-red-500/15 text-red-400 border-red-500/20",
  // Financial type
  "CAPEX": "bg-blue-500/15 text-blue-400 border-blue-500/20 text-xs",
  "OPEX": "bg-orange-500/15 text-orange-400 border-orange-500/20 text-xs",
};

// Default fallback for statuses without context
const STATUS_DEFAULTS: Record<string, string> = {
  "Pago": "bg-green-500/15 text-green-400 border-green-500/20",
  "Pendente": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "Em rota": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "Entregue": "bg-green-500/15 text-green-400 border-green-500/20",
  "Cancelado": "bg-red-500/15 text-red-400 border-red-500/20 line-through",
  "Vencida": "bg-red-500/15 text-red-400 border-red-500/20",
  "Ativo": "bg-green-500/15 text-green-400 border-green-500/20",
  "Inativo": "bg-red-500/15 text-red-400 border-red-500/20",
  "CAPEX": "bg-blue-500/15 text-blue-400 border-blue-500/20 text-xs",
  "OPEX": "bg-orange-500/15 text-orange-400 border-orange-500/20 text-xs",
};

// Dot color for the status indicator
const DOT_COLORS: Record<string, string> = {
  "Pago": "bg-green-400",
  "Pendente": "bg-amber-400",
  "Pendente:pagamento": "bg-red-400",
  "Pendente:conta": "bg-amber-400",
  "Pendente:entrega": "bg-zinc-400",
  "Em rota": "bg-blue-400",
  "Entregue": "bg-green-400",
  "Cancelado": "bg-red-400",
  "Vencida": "bg-red-400",
  "Ativo": "bg-green-400",
  "Inativo": "bg-red-400",
  "CAPEX": "bg-blue-400",
  "OPEX": "bg-orange-400",
};

interface StatusBadgeProps {
  status: string;
  context?: StatusContext;
  className?: string;
}

export function StatusBadge({ status, context, className }: StatusBadgeProps) {
  const key = context ? `${status}:${context}` : status;
  const colors = STATUS_COLORS[key] || STATUS_DEFAULTS[status] || "bg-zinc-500/15 text-zinc-400 border-zinc-500/20";
  const dotColor = DOT_COLORS[key] || DOT_COLORS[status] || "bg-zinc-400";

  return (
    <Badge className={`${colors} border gap-1.5 ${className || ""}`}>
      <span className={`size-1.5 rounded-full ${dotColor} shrink-0`} />
      {status}
    </Badge>
  );
}
