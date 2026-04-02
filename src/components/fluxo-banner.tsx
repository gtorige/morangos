"use client";

import { useRouter } from "next/navigation";
import { Check, Circle } from "lucide-react";

type Step = "colheita" | "separacao" | "rota" | "entrega";

const STEPS: { key: Step; label: string; href: string }[] = [
  { key: "colheita", label: "Colheita", href: "/producao" },
  { key: "separacao", label: "Separação", href: "/separacao" },
  { key: "rota", label: "Rota", href: "/rota" },
  { key: "entrega", label: "Entrega", href: "/entrega" },
];

const stepIndex = (s: Step) => STEPS.findIndex((x) => x.key === s);

export function FluxoBanner({ stepAtual }: { stepAtual: Step }) {
  const router = useRouter();
  const currentIdx = stepIndex(stepAtual);

  return (
    <div className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-xl mb-4">
      {STEPS.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            {/* Step */}
            <button
              onClick={() => !isCurrent && router.push(step.href)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isCurrent
                  ? "bg-primary/15 text-primary ring-1 ring-primary/20"
                  : isDone
                  ? "text-green-400 hover:bg-green-500/10 cursor-pointer"
                  : "text-muted-foreground hover:text-foreground cursor-pointer"
              }`}
            >
              <span className={`flex items-center justify-center size-5 rounded-full text-[10px] font-bold ${
                isDone
                  ? "bg-green-500/20 text-green-400"
                  : isCurrent
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}>
                {isDone ? <Check className="size-3" /> : idx + 1}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </button>

            {/* Connector line */}
            {idx < STEPS.length - 1 && (
              <div className="flex-1 mx-1.5 h-px relative">
                <div className="absolute inset-0 bg-border" />
                {idx < currentIdx && (
                  <div className="absolute inset-0 bg-green-500/40" />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
