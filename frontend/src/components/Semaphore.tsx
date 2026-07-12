import type { ReactNode } from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export type Tone = "good" | "warn" | "bad";

interface Banner {
  tone: Tone;
  title: string;
  text: string;
}

interface Props {
  banners: Banner[];
}

const ICON: Record<Tone, ReactNode> = {
  good: <CheckCircle2 size={20} className="text-icon-green" />,
  warn: <AlertTriangle size={20} className="text-icon-yellow" />,
  bad:  <XCircle size={20} className="text-icon-red" />,
};
const DOT_BG: Record<Tone, string> = {
  good: "bg-icon-green",
  warn: "bg-icon-yellow",
  bad:  "bg-icon-red",
};
const ROW_BG: Record<Tone, string> = {
  good: "bg-soft-green/40 border-brand-100",
  warn: "bg-soft-yellow/40 border-soft-yellow",
  bad:  "bg-soft-red/40 border-soft-red",
};

export function Semaphore({ banners }: Props) {
  if (banners.length === 0) return null;
  return (
    <section className="napsa-card">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[13px] font-bold text-ink-900">Semáforo financiero</span>
        <span className="flex items-center gap-1.5 text-[11px] text-ink-500">
          <span className={`w-2 h-2 rounded-full bg-icon-green`} /> OK
          <span className={`w-2 h-2 rounded-full bg-icon-yellow ml-2`} /> Atención
          <span className={`w-2 h-2 rounded-full bg-icon-red ml-2`} /> Crítico
        </span>
      </div>
      <div className="space-y-2">
        {banners.map((b, i) => (
          <div key={i} className={`flex items-start gap-3 rounded-xl p-3 border ${ROW_BG[b.tone]}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${DOT_BG[b.tone]} mt-1.5 shrink-0`} />
            {ICON[b.tone]}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-ink-900 text-[14px]">{b.title}</div>
              <div className="text-[12px] text-ink-700 mt-0.5 leading-snug">{b.text}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
