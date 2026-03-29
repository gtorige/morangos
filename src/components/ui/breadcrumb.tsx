"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground/50" />}
            {isLast || !item.href ? (
              <span className={isLast ? "text-foreground font-medium" : "text-muted-foreground"}>
                {item.label}
              </span>
            ) : (
              <Link href={item.href} className="text-muted-foreground hover:text-foreground transition-colors">
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
