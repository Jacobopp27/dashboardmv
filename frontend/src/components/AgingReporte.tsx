import { AlertTriangle, Clock, AlertCircle, AlertOctagon, Flame, User } from "lucide-react";
import type { AgingBucket, AgingReporte as AgingReporteType } from "@/lib/api";
import { fmtInt, fmtMoney, fmtPeriodo } from "@/lib/format";
import { IconBadge } from "./IconBadge";

interface Props {
  data: AgingReporteType;
  total_unidades: number;  // total de unidades del conjunto para calcular % al día
}

const BUCKET_META: Record<string, { tone: "yellow" | "orange" | "red" | "red"; icon: typeof AlertCircle; color: string }> = {
  "1-30 días":   { tone: "yellow", icon: Clock,        color: "#CA8A04" },
  "31-90 días":  { tone: "orange", icon: AlertCircle,  color: "#EA580C" },
  "91-180 días": { tone: "red",    icon: AlertTriangle, color: "#DC2626" },
  "181-365 días":{ tone: "red",    icon: AlertOctagon, color: "#B91C1C" },
  "+365 días":   { tone: "red",    icon: Flame,        color: "#991B1B" },
};

function BucketCard({ b }: { b: AgingBucket }) {
  const meta = BUCKET_META[b.bucket] ?? BUCKET_META["1-30 días"];
  const Icon = meta.icon;
  const empty = b.unidades === 0;
  return (
    <div className={`napsa-kpi ${empty ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-3">
        <IconBadge tone={meta.tone}><Icon size={18} /></IconBadge>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] uppercase tracking-wide text-ink-500 font-medium">{b.bucket}</div>
          <div className="text-[20px] font-bold text-ink-900 leading-tight tabular-nums mt-0.5">
            {fmtInt(b.unidades)} <span className="text-[12px] text-ink-500 font-medium">unidades</span>
          </div>
          <div className="text-[13px] font-semibold tabular-nums mt-1" style={{ color: meta.color }}>
            {fmtMoney(b.valor)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AgingReporte({ data, total_unidades }: Props) {
  const total_mora_valor = data.buckets.reduce((s, b) => s + b.valor, 0);
  const total_mora_unidades = data.buckets.reduce((s, b) => s + b.unidades, 0);
  const al_dia = Math.max(0, total_unidades - total_mora_unidades);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-[16px] font-bold text-ink-900">Edades de cartera</h3>
          <p className="text-[12px] text-ink-500">
            Corte: <span className="font-semibold">{fmtPeriodo(data.corte)}</span> ·
            <span className="text-icon-green ml-1">{al_dia} al día</span> ·
            <span className="text-icon-red ml-1">{total_mora_unidades} en mora ({fmtMoney(total_mora_valor)})</span>
          </p>
        </div>
      </div>

      {/* 5 buckets */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {data.buckets.map((b) => <BucketCard key={b.bucket} b={b} />)}
      </div>

      {/* Lista detallada por unidad */}
      {data.unidades.length === 0 ? (
        <div className="text-center py-6 text-icon-green font-semibold">¡Ninguna unidad en mora!</div>
      ) : (
        <div className="bg-white rounded-2xl border border-ink-200/60 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-ink-500 border-b border-ink-200 bg-ink-50">
                <th className="px-4 py-2.5 font-semibold">Casa</th>
                <th className="px-3 py-2.5 font-semibold">Propietario</th>
                <th className="px-3 py-2.5 font-semibold text-right">Saldo</th>
                <th className="px-3 py-2.5 font-semibold text-right">Meses mora</th>
                <th className="px-4 py-2.5 font-semibold">Bucket</th>
              </tr>
            </thead>
            <tbody>
              {data.unidades.map((u) => {
                const meta = BUCKET_META[u.bucket] ?? BUCKET_META["1-30 días"];
                return (
                  <tr key={u.unidad} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50">
                    <td className="px-4 py-2.5 font-semibold text-ink-900">{u.unidad}</td>
                    <td className="px-3 py-2.5 text-ink-700 truncate max-w-[220px]">
                      <span className="inline-flex items-center gap-1.5">
                        <User size={12} className="text-ink-500" /> {u.propietario}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: meta.color }}>
                      {fmtMoney(u.saldo)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{u.meses_mora}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ background: `${meta.color}22`, color: meta.color }}
                      >
                        {u.bucket}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
