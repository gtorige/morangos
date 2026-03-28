"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const MENU_ORDER_KEY = "menu-order";
const DEFAULT_REDIRECT = "/resumo";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    let target = DEFAULT_REDIRECT;
    try {
      const saved = localStorage.getItem(MENU_ORDER_KEY);
      if (saved) {
        const order: string[] = JSON.parse(saved);
        // Find the first non-root path
        const first = order.find((p) => p !== "/");
        if (first) target = first;
      }
    } catch {
      // ignore
    }
    router.replace(target);
  }, [router]);

  return null;
}
