import { ResponsiveContainer, Bar, Line, ComposedChart, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell } from "recharts";
import type { SerieMensualPoint } from "@/lib/api";
import { fmtMesCorto, fmtMoney, fmtPeriodo } from "@/lib/format";

interface Props {
  data: SerieMensualPoint[];
  /** Período del mes a resaltar en verde menta (formato "YYYY-MM"). Si no, se resalta el último. */
  highlightPeriodo?: string;
}

interface TooltipPayload {
  payload?: { periodo?: string };
  name?: string;
  value?: number;
  color?: string;
}

function TooltipBox({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const periodo: string = payload[0].payload?.periodo ?? "";
  return (
    <div className="bg-white border border-ink-200 rounded-xl shadow-card p-3 text-[12px]">
      <div className="font-semibold text-deepgreen-900 mb-1.5">{fmtPeriodo(periodo)}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-deepgreen-500">{p.name}:</span>
          <span className="font-semibold tabular-nums ml-auto">{fmtMoney(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

const COLOR_FACTURADO = "#1A3A1D";   // verde casi negro
const COLOR_RECAUDADO = "#0D9488";    // teal base
const COLOR_ATTENTION = "#00A86B";    // verde menta brillante (resalta mes actual)
const COLOR_PENDIENTE = "#DC2626";

export function TrendChart({ data, highlightPeriodo }: Props) {
  // Determinar el mes a resaltar: el explícito o el último de la serie
  const targetPeriodo = highlightPeriodo ?? data[data.length - 1]?.periodo;

  return (
    <div className="w-full h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="#E5E7EB" vertical={false} />
          <XAxis
            dataKey="periodo"
            tickFormatter={fmtMesCorto}
            tick={{ fontSize: 12, fill: "#3F5240" }}
            axisLine={{ stroke: "#E5E7EB" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => fmtMoney(v, { compact: true })}
            tick={{ fontSize: 11, fill: "#3F5240" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<TooltipBox />} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />

          {/* Facturado en verde casi negro */}
          <Bar dataKey="facturado" name="Facturado" radius={[6, 6, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.periodo === targetPeriodo ? COLOR_ATTENTION : COLOR_FACTURADO} />
            ))}
          </Bar>

          {/* Recaudado en teal, con resaltado verde menta para el mes actual */}
          <Bar dataKey="recaudado" name="Recaudado" radius={[6, 6, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.periodo === targetPeriodo ? COLOR_ATTENTION : COLOR_RECAUDADO} />
            ))}
          </Bar>

          <Line
            type="monotone"
            dataKey="pendiente"
            name="Cartera Pendiente"
            stroke={COLOR_PENDIENTE}
            strokeWidth={2.5}
            dot={{ r: 4, fill: COLOR_PENDIENTE }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
