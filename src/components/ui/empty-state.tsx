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
      <Icon className="size-12 text-muted-foreground/30" />
      <div className="text-center space-y-1">
        <p className="text-lg font-medium text-muted-foreground">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground/60">{description}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="bg-green-600 hover:bg-green-700 text-white">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
