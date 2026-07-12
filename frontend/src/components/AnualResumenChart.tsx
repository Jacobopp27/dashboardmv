import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import type { ResumenMensual } from "@/lib/api";
import { fmtMesCorto, fmtMoney, fmtPct, fmtPeriodo } from "@/lib/format";

interface Props { data: ResumenMensual[] }

interface TipPayload {
  payload?: ResumenMensual;
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
}

function Tip({ active, payload }: { active?: boolean; payload?: TipPayload[] }) {
  if (!active || !payload?.length) return null;
  const r: ResumenMensual | undefined = payload[0].payload;
  if (!r) return null;
  return (
    <div className="bg-white border border-ink-200 rounded-xl shadow-card p-3 text-[12px] min-w-[200px]">
      <div className="font-semibold text-ink-900 mb-1.5">{fmtPeriodo(r.periodo)}</div>
      <div className="flex justify-between gap-3 py-0.5">
        <span className="text-ink-500">Facturado</span>
        <span className="font-semibold tabular-nums">{fmtMoney(r.facturado)}</span>
      </div>
      <div className="flex justify-between gap-3 py-0.5">
        <span className="text-ink-500">Recaudado</span>
        <span className="font-semibold tabular-nums text-icon-green">{fmtMoney(r.recaudado)}</span>
      </div>
      <div className="flex justify-between gap-3 py-0.5">
        <span className="text-ink-500">Cartera total</span>
        <span className="font-semibold tabular-nums text-icon-red">{fmtMoney(r.cartera_total)}</span>
      </div>
      <div className="border-t border-ink-100 mt-1.5 pt-1.5 flex justify-between gap-3">
        <span className="text-ink-500">% Recaudo</span>
        <span className="font-semibold tabular-nums">{fmtPct(r.pct_recaudo)}</span>
      </div>
      <div className="flex justify-between gap-3 py-0.5">
        <span className="text-ink-500">% Cartera morosa</span>
        <span className="font-semibold tabular-nums text-icon-orange">{fmtPct(r.pct_morosa)}</span>
      </div>
    </div>
  );
}

export function AnualResumenChart({ data }: Props) {
  return (
    <div className="w-full h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="#E5E7EB" vertical={false} />
          <XAxis
            dataKey="periodo"
            tickFormatter={fmtMesCorto}
            tick={{ fontSize: 12, fill: "#6B7280" }}
            axisLine={{ stroke: "#E5E7EB" }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={(v) => fmtMoney(v, { compact: true })}
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tick={{ fontSize: 11, fill: "#EA580C" }}
            axisLine={false}
            tickLine={false}
            domain={[0, 1]}
          />
          <Tooltip content={<Tip />} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar yAxisId="left" dataKey="facturado" name="Facturado" fill="#2563EB" radius={[6, 6, 0, 0]} />
          <Bar yAxisId="left" dataKey="recaudado" name="Recaudado" fill="#0D9488" radius={[6, 6, 0, 0]} />
          <Bar yAxisId="left" dataKey="cartera_total" name="Cartera Total" fill="#DC2626" radius={[6, 6, 0, 0]} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="pct_morosa"
            name="% Cartera Morosa"
            stroke="#EA580C"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#EA580C" }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
