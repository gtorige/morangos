"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const MENU_SECTIONS_KEY = "menu-sections";
const DEFAULT_REDIRECT = "/resumo";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    let target = DEFAULT_REDIRECT;
    try {
      const saved = localStorage.getItem(MENU_SECTIONS_KEY);
      if (saved) {
        const sections: { items: string[] }[] = JSON.parse(saved);
        const first = sections[0]?.items[0];
        if (first) target = first;
      }
    } catch {
      // ignore
    }
    router.replace(target);
  }, [router]);

  return null;
}
