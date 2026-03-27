"use client";

import Link from "next/link";
import {
  Plus,
  ClipboardList,
  Users,
  Package,
  Tag,
  Receipt,
  BarChart3,
  MapPin,
  ClipboardCheck,
  ArrowRight,
  Repeat,
} from "lucide-react";

const sections = [
  {
    href: "/resumo",
    label: "Resumo",
    description: "Visão geral de vendas e entregas",
    icon: BarChart3,
  },
  {
    href: "/pedidos/novo",
    label: "Novo Pedido",
    description: "Registrar um novo pedido",
    icon: Plus,
  },
  {
    href: "/pedidos",
    label: "Pedidos",
    description: "Gerenciar todos os pedidos",
    icon: ClipboardList,
  },
  {
    href: "/clientes",
    label: "Clientes",
    description: "Cadastro de clientes",
    icon: Users,
  },
  {
    href: "/produtos",
    label: "Produtos",
    description: "Catálogo de produtos",
    icon: Package,
  },
  {
    href: "/promocoes",
    label: "Promoções",
    description: "Gerenciar promoções ativas",
    icon: Tag,
  },
  {
    href: "/contas",
    label: "Fornecedores",
    description: "Contas e fornecedores",
    icon: Receipt,
  },
  {
    href: "/rota",
    label: "Rota de Entrega",
    description: "Organizar rota no mapa",
    icon: MapPin,
  },
  {
    href: "/separacao",
    label: "Separação",
    description: "Lista de carga do dia",
    icon: ClipboardCheck,
  },
  {
    href: "/recorrentes",
    label: "Pedidos Recorrentes",
    description: "Pedidos automáticos semanais",
    icon: Repeat,
  },
];

export default function HomePage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Painel</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie pedidos, entregas e finanças.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <div className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:bg-accent hover:border-primary/30 cursor-pointer">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{section.label}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {section.description}
                  </p>
                </div>
                <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
