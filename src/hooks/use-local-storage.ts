import { useState, useCallback } from "react";

/**
 * Hook for state synced with localStorage.
 * Reads initial value from localStorage, writes on every update.
 */
export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored) as T;
    } catch { /* ignore */ }
    return defaultValue;
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setState((prev) => {
      const next = typeof value === "function" ? (value as (prev: T) => T)(prev) : value;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, [key]);

  return [state, setValue];
}

/**
 * Hook for a simple string value in localStorage.
 */
export function useLocalStorageString(key: string, defaultValue: string): [string, (value: string) => void] {
  const [state, setState] = useState<string>(() => {
    if (typeof window === "undefined") return defaultValue;
    return localStorage.getItem(key) ?? defaultValue;
  });

  const setValue = useCallback((value: string) => {
    setState(value);
    try {
      localStorage.setItem(key, value);
    } catch { /* ignore */ }
  }, [key]);

  return [state, setValue];
}
