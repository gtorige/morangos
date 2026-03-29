"use client"

import type { LucideIcon } from "lucide-react"

export interface TabItem {
  key: string;
  label: string;
  count?: number;
  icon?: LucideIcon;
}

interface TabsNavProps {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
}

export function TabsNav({ items, value, onChange }: TabsNavProps) {
  return (
    <div className="flex gap-1 border-b border-border pb-0 overflow-x-auto">
      {items.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            value === t.key
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.icon && <t.icon className="size-3.5" />}
          {t.label}
          {t.count !== undefined && (
            <span
              className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                value === t.key
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
