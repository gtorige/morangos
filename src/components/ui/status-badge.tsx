"use client"

import { Badge } from "@/components/ui/badge"

type StatusContext = "pagamento" | "entrega" | "conta" | "financeiro" | "ativo";

const STATUS_COLORS: Record<string, string> = {
  // Payment
  "Pago": "bg-green-600 text-white",
  "Pendente:pagamento": "bg-red-600 text-white",
  "Pendente:conta": "bg-yellow-500 text-white",
  // Delivery
  "Pendente:entrega": "bg-gray-500 text-white",
  "Em rota": "bg-blue-600 text-white",
  "Entregue": "bg-green-600 text-white",
  "Cancelado": "bg-red-600 text-white",
  // Accounts
  "Vencida": "bg-red-600 text-white",
  // Active/Inactive
  "Ativo": "bg-green-600 text-white",
  "Inativo": "bg-red-600 text-white",
  // Financial type
  "CAPEX": "bg-blue-600 text-white text-xs",
  "OPEX": "bg-orange-600 text-white text-xs",
};

// Default fallback for statuses without context
const STATUS_DEFAULTS: Record<string, string> = {
  "Pago": "bg-green-600 text-white",
  "Pendente": "bg-yellow-500 text-white",
  "Em rota": "bg-blue-600 text-white",
  "Entregue": "bg-green-600 text-white",
  "Cancelado": "bg-red-600 text-white",
  "Vencida": "bg-red-600 text-white",
  "Ativo": "bg-green-600 text-white",
  "Inativo": "bg-red-600 text-white",
  "CAPEX": "bg-blue-600 text-white text-xs",
  "OPEX": "bg-orange-600 text-white text-xs",
};

interface StatusBadgeProps {
  status: string;
  context?: StatusContext;
  className?: string;
}

export function StatusBadge({ status, context, className }: StatusBadgeProps) {
  const key = context ? `${status}:${context}` : status;
  const colors = STATUS_COLORS[key] || STATUS_DEFAULTS[status] || "bg-gray-500 text-white";

  return (
    <Badge className={`${colors} ${className || ""}`}>
      {status}
    </Badge>
  );
}
