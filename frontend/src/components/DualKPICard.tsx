import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  label: string;
  /** Bloque izquierdo (verde / positivo / ingresos) */
  left: { label: string; value: string; tone?: "good" | "warn" | "bad" };
  /** Bloque derecho (rojo / negativo / egresos) */
  right: { label: string; value: string; tone?: "good" | "warn" | "bad" };
  /** Semáforo de gestión en la esquina */
  semaphore?: "green" | "yellow" | "red" | "none";
  accent?: "navy" | "emerald" | "sand";
}

const SEM_COLOR = {
  green:  "bg-traffic-green",
  yellow: "bg-traffic-yellow",
  red:    "bg-traffic-red",
  none:   "hidden",
};
const ACCENT_BG = {
  navy:    "bg-iconBox-navy text-iconBox-navyDark",
  emerald: "bg-iconBox-green text-iconBox-greenDark",
  sand:    "bg-iconBox-sand text-iconBox-sandDark",
};
const ACCENT_GLOW = {
  navy:    "shadow-soft-glow-navy",
  emerald: "shadow-soft-glow-emerald",
  sand:    "shadow-soft-glow-gold",
};
const VALUE_COLOR: Record<NonNullable<Props["left"]["tone"]>, string> = {
  good: "text-traffic-green",
  warn: "text-traffic-yellow",
  bad:  "text-traffic-red",
};

/** Tarjeta KPI con dos valores comparados (Ingresos vs Egresos) */
export function DualKPICard({ icon, label, left, right, semaphore = "none", accent = "navy" }: Props) {
  return (
    <div className={`bg-white rounded-xl px-4 py-4 relative ${ACCENT_GLOW[accent]} transition-shadow hover:shadow-soft-glow`}>

      {semaphore !== "none" && (
        <span className={`absolute top-3 right-3 w-2 h-2 rounded-full ${SEM_COLOR[semaphore]} shadow-sm`} />
      )}
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${ACCENT_BG[accent]}`}>
          {icon}
        </div>
        <div className="text-[11.5px] uppercase tracking-wider text-ink-500 font-semibold leading-tight">{label}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-ink-100">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-500 font-medium">{left.label}</div>
          <div className={`text-[16px] font-bold tabular-nums leading-tight mt-0.5 ${left.tone ? VALUE_COLOR[left.tone] : "text-navy-900"}`}>
            {left.value}
          </div>
        </div>
        <div className="border-l border-ink-100 pl-2">
          <div className="text-[10px] uppercase tracking-wider text-ink-500 font-medium">{right.label}</div>
          <div className={`text-[16px] font-bold tabular-nums leading-tight mt-0.5 ${right.tone ? VALUE_COLOR[right.tone] : "text-navy-900"}`}>
            {right.value}
          </div>
        </div>
      </div>
    </div>
  );
}
