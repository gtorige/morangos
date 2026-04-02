import { useState, useCallback, useRef, useEffect } from "react";

interface UseFetchOptions<T> {
  /** Initial value before first fetch */
  initialData?: T;
  /** Fetch on mount */
  immediate?: boolean;
}

interface UseFetchReturn<T> {
  data: T;
  setData: React.Dispatch<React.SetStateAction<T>>;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<T | undefined>;
}

/**
 * Generic hook for fetching data from an API endpoint.
 * Handles loading state, errors, cancellation, and refetching.
 */
export function useFetch<T>(
  urlOrFn: string | (() => string),
  options: UseFetchOptions<T> = {}
): UseFetchReturn<T> {
  const { initialData, immediate = true } = options;
  const [data, setData] = useState<T>(initialData as T);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    // Cancelar request anterior se ainda em andamento
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const url = typeof urlOrFn === "function" ? urlOrFn() : urlOrFn;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        const msg = `Erro ${res.status}`;
        setError(msg);
        return undefined;
      }
      const json = await res.json();
      setData(json as T);
      return json as T;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return undefined;
      const msg = err instanceof Error ? err.message : "Erro ao buscar dados";
      setError(msg);
      console.error("useFetch error:", err);
      return undefined;
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  }, [urlOrFn]);

  useEffect(() => {
    if (immediate) { fetchData(); }
    return () => { abortRef.current?.abort(); };
  }, [immediate, fetchData]);

  return { data, setData, loading, error, fetch: fetchData };
}
