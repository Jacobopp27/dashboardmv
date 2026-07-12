import type { ReactNode } from "react";
import { IconBadge } from "./IconBadge";

type Tone = "red" | "orange" | "yellow" | "green" | "blue" | "gray";

interface Props {
  icon: ReactNode;
  tone: Tone;
  title: string;
  subtitle?: string;
  value: string;
  hint?: string;
}

/**
 * Fila tipo NAPSA: icono circular + título/subtítulo a la izquierda,
 * valor en grande a la derecha + hint pequeño debajo.
 */
export function StatRow({ icon, tone, title, subtitle, value, hint }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 px-1 py-3 first:pt-0 last:pb-0 border-b border-ink-100 last:border-b-0">
      <div className="flex items-center gap-3 min-w-0">
        <IconBadge tone={tone}>{icon}</IconBadge>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-ink-900 leading-tight">{title}</div>
          {subtitle && <div className="text-[13px] text-ink-500 mt-0.5">{subtitle}</div>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[17px] font-bold text-ink-900 leading-tight tabular-nums">{value}</div>
        {hint && <div className="text-[12px] text-ink-500 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}
