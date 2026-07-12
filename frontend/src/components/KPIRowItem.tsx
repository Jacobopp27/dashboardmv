import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  hintTone?: "good" | "warn" | "bad" | "neutral";
  /** Semáforo de gestión a la esquina */
  semaphore?: "green" | "yellow" | "red" | "none";
  chip?: { label: string; tone: "good" | "warn" | "bad" };
  /** Tono visual del bloque (navy / emerald / sand) */
  accent?: "navy" | "emerald" | "sand";
}

const HINT_COLOR: Record<NonNullable<Props["hintTone"]>, string> = {
  good: "text-traffic-green",
  warn: "text-traffic-yellow",
  bad:  "text-traffic-red",
  neutral: "text-ink-500",
};
const SEM_COLOR = {
  green:  "bg-traffic-green",
  yellow: "bg-traffic-yellow",
  red:    "bg-traffic-red",
  none:   "hidden",
};
const CHIP_BG: Record<"good" | "warn" | "bad", string> = {
  good: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  warn: "bg-sand-100 text-sand-600 border border-sand-200",
  bad:  "bg-red-100 text-red-700 border border-red-200",
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

/** KPI tarjeta blanca con icono cuadrado a la izquierda y semáforo en la esquina */
export function KPIRowItem({
  icon, label, value, hint, hintTone = "neutral",
  semaphore = "none", chip, accent = "navy",
}: Props) {
  return (
    <div className={`bg-white rounded-xl px-3.5 py-3 relative ${ACCENT_GLOW[accent]} transition-shadow hover:shadow-soft-glow`}>
      {semaphore !== "none" && (
        <span className="absolute top-2.5 right-2.5 flex items-center gap-0.5">
          <span className={`w-2 h-2 rounded-full ${SEM_COLOR[semaphore]} shadow-sm`} />
        </span>
      )}
      <div className="flex items-start gap-2.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${ACCENT_BG[accent]}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] uppercase tracking-wider text-ink-500 font-semibold leading-tight">{label}</div>
          <div className="text-[18px] font-bold text-navy-900 tabular-nums leading-tight mt-1">{value}</div>
          {hint && <div className={`text-[10px] mt-0.5 ${HINT_COLOR[hintTone]}`}>{hint}</div>}
          {chip && (
            <span className={`inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${CHIP_BG[chip.tone]}`}>
              {chip.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Versión destacada superior derecha (Estado de Liquidez) */
export function HighlightedLiquidityCard({ value, indicator = "green" }: { value: string; indicator?: "green" | "yellow" | "red" }) {
  return (
    <div className="bg-gradient-to-br from-navy-700 to-navy-900 text-white rounded-xl px-5 py-3.5 shadow-md relative min-w-[200px]">
      <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${SEM_COLOR[indicator]} ring-2 ring-white/30`} />
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-lg bg-sand-200/20 border border-sand-200/40 flex items-center justify-center text-sand-200 text-[20px] font-bold">
          $
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-sand-200/80 font-semibold leading-tight">Estado de</div>
          <div className="text-[10.5px] uppercase tracking-wider text-sand-200/80 font-semibold leading-tight">Liquidez</div>
          <div className="text-[20px] font-bold tabular-nums leading-tight mt-0.5">{value}</div>
        </div>
      </div>
    </div>
  );
}
