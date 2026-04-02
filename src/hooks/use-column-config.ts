import { useState, useCallback, useEffect, useRef } from "react";

export interface ColumnDef<K extends string = string> {
  key: K;
  label: string;
  visible: boolean;
  required?: boolean;
}

interface UseColumnConfigOptions<K extends string> {
  storageKey: string;
  defaults: ColumnDef<K>[];
}

function loadFromStorage<K extends string>(storageKey: string, defaults: ColumnDef<K>[]): ColumnDef<K>[] {
  if (typeof window === "undefined") return defaults;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed: { key: K; visible: boolean }[] = JSON.parse(stored);
      const storedKeys = new Set(parsed.map((c) => c.key));
      const merged: ColumnDef<K>[] = parsed
        .map((s) => {
          const def = defaults.find((d) => d.key === s.key);
          if (!def) return null;
          return { ...def, visible: def.required ? true : s.visible };
        })
        .filter((c): c is ColumnDef<K> => c !== null);
      for (const def of defaults) {
        if (!storedKeys.has(def.key)) merged.push(def);
      }
      return merged;
    }
  } catch { /* ignore */ }
  return defaults;
}

/**
 * Hook for configurable table columns with localStorage persistence.
 * Handles load/save, toggle visibility, reorder, and click-outside close.
 */
export function useColumnConfig<K extends string>(options: UseColumnConfigOptions<K>) {
  const { storageKey, defaults } = options;

  const [columns, setColumns] = useState<ColumnDef<K>[]>(() => loadFromStorage(storageKey, defaults));
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const save = useCallback((cols: ColumnDef<K>[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(cols.map((c) => ({ key: c.key, visible: c.visible }))));
    } catch { /* ignore */ }
  }, [storageKey]);

  const toggle = useCallback((key: K) => {
    setColumns((prev) => {
      const next = prev.map((c) => (c.key === key && !c.required ? { ...c, visible: !c.visible } : c));
      save(next);
      return next;
    });
  }, [save]);

  const move = useCallback((index: number, dir: -1 | 1) => {
    setColumns((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      save(next);
      return next;
    });
  }, [save]);

  const visible = columns.filter((c) => c.visible);

  return { columns, visible, open, setOpen, ref, toggle, move };
}
