"use client";

import * as React from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * DateInput — sempre mostra DD/MM/YYYY independente do locale do SO.
 *
 * - Armazena/emite valores em YYYY-MM-DD (compatível com o resto do app)
 * - Aceita digitação com mascara automatica (DD/MM/YYYY)
 * - Botao de calendario abre o picker nativo do navegador (melhor UX em mobile)
 *
 * Uso:
 *   <DateInput value={data} onChange={(v) => setData(v)} />  // v = "YYYY-MM-DD"
 */

function isoToBr(iso: string): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function brToIso(br: string): string {
  const clean = br.replace(/\D/g, "");
  if (clean.length !== 8) return "";
  const dd = clean.slice(0, 2);
  const mm = clean.slice(2, 4);
  const yyyy = clean.slice(4, 8);
  const d = Number(dd), mo = Number(mm), y = Number(yyyy);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return "";
  // Valida data real do calendario (rejeita 31/02, 31/04, etc)
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return "";
  return `${yyyy}-${mm}-${dd}`;
}

function maskBr(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void; // recebe YYYY-MM-DD (ou "" se invalido/vazio)
}

export function DateInput({ value, onChange, className, placeholder = "DD/MM/AAAA", ...props }: DateInputProps) {
  const [text, setText] = React.useState(() => isoToBr(value));
  const hiddenRef = React.useRef<HTMLInputElement>(null);

  // Sincroniza quando o valor externo muda (ex: preset "Hoje")
  React.useEffect(() => {
    setText(isoToBr(value));
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = maskBr(e.target.value);
    setText(masked);
    const iso = brToIso(masked);
    if (iso || masked === "") onChange(iso);
  }

  function handleBlur() {
    // Se invalido no blur, restaura ao ultimo ISO valido
    if (!brToIso(text) && text !== "") {
      setText(isoToBr(value));
    }
  }

  function openPicker() {
    try {
      hiddenRef.current?.showPicker?.();
    } catch {
      hiddenRef.current?.focus();
      hiddenRef.current?.click();
    }
  }

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        maxLength={10}
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 pr-8 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30",
        )}
        {...props}
      />
      <button
        type="button"
        onClick={openPicker}
        tabIndex={-1}
        aria-label="Abrir calendario"
        className="absolute right-1.5 inline-flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground transition-colors"
      >
        <Calendar className="size-3.5" />
      </button>
      <input
        ref={hiddenRef}
        type="date"
        value={value}
        onChange={(e) => {
          const iso = e.target.value;
          setText(isoToBr(iso));
          onChange(iso);
        }}
        className="absolute inset-0 opacity-0 pointer-events-none"
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}
