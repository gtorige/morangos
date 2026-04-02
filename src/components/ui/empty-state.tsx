"use client"

import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="flex items-center justify-center size-16 rounded-2xl bg-muted/50 ring-1 ring-foreground/5">
        <Icon className="size-7 text-muted-foreground/50" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-base font-heading font-medium text-muted-foreground">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground/50 max-w-sm">{description}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <Button onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
