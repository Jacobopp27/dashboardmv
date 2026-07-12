import type { ReactNode } from "react";
import { IconBadge } from "./IconBadge";

type Tone = "red" | "orange" | "yellow" | "green" | "blue" | "gray";

interface Props {
  icon: ReactNode;
  tone: Tone;
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "good" | "warn" | "bad" | "neutral";
}

const DELTA_COLOR: Record<NonNullable<Props["deltaTone"]>, string> = {
  good: "text-icon-green",
  warn: "text-icon-orange",
  bad:  "text-icon-red",
  neutral: "text-ink-500",
};

export function KPICard({ icon, tone, label, value, delta, deltaTone = "neutral" }: Props) {
  return (
    <div className="napsa-kpi flex items-start gap-2.5 min-w-0 overflow-hidden">
      <IconBadge tone={tone}>{icon}</IconBadge>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="text-[11px] uppercase tracking-wide text-ink-500 font-medium truncate">{label}</div>
        <div
          className="font-bold text-ink-900 leading-tight tabular-nums mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis"
          style={{ fontSize: "clamp(0.9rem, 1.4vw, 1.15rem)" }}
          title={value}
        >
          {value}
        </div>
        {delta && <div className={`text-[11px] mt-0.5 truncate ${DELTA_COLOR[deltaTone]}`}>{delta}</div>}
      </div>
    </div>
  );
}
