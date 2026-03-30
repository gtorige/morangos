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
    <div className="flex items-center gap-1.5 p-2.5 bg-muted/50 border border-border rounded-lg mb-4 overflow-x-auto">
      {STEPS.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isPending = idx > currentIdx;

        let cls = "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border whitespace-nowrap cursor-pointer transition-colors ";
        if (isDone) cls += "bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20";
        else if (isCurrent) cls += "bg-primary/10 border-primary/20 text-primary";
        else cls += "bg-transparent border-border text-muted-foreground hover:text-foreground";

        return (
          <div key={step.key} className="flex items-center gap-1.5">
            {idx > 0 && <span className="text-muted-foreground text-[10px]">&rarr;</span>}
            <button className={cls} onClick={() => !isCurrent && router.push(step.href)}>
              {isDone && <Check className="size-3" />}
              {isCurrent && <Circle className="size-3 fill-current" />}
              {isPending && <Circle className="size-3" />}
              {step.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
