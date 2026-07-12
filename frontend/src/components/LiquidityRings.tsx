import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

interface Indicator {
  label: string;
  value: number | null;       // razón (ej. 2.63)
  target: number;             // meta (ej. 1.0 para razón corriente)
  format?: "ratio" | "pct";
  color: string;
}

interface Props {
  indicators: Indicator[];    // 4 a mostrar
}

/**
 * Donut tipo NAPSA con 4 segmentos coloreados, cada uno con su % vs su meta.
 * No es un donut financiero de proporción de monto, sino un visualizador
 * de qué tan saludable está cada indicador (cap 100%).
 */
export function LiquidityRings({ indicators }: Props) {
  // Calcular health (cap 100%) por cada indicador
  const data = indicators.map((ind) => {
    const v = ind.value ?? 0;
    const ratio = ind.target > 0 ? Math.min(v / ind.target, 1) : 0;
    return { name: ind.label, value: Math.max(ratio, 0.05), real: v, color: ind.color };
  });

  return (
    <div className="grid grid-cols-2 gap-3">
      {indicators.map((ind, i) => {
        const v = ind.value ?? 0;
        const isOk =
          ind.label.toLowerCase().includes("endeud")
            ? v <= ind.target
            : v >= ind.target;
        const display = ind.format === "pct" ? `${(v * 100).toFixed(1)}%` : v.toFixed(2);
        // Mini-ring per indicator
        const ratio = ind.label.toLowerCase().includes("endeud")
          ? Math.min(v, 1)             // endeudamiento: 0..1 directo
          : Math.min(v / Math.max(ind.target * 3, 1), 1);  // ratios: full ring si llega a 3x la meta
        const ringData = [
          { name: "ok", value: ratio },
          { name: "rest", value: Math.max(1 - ratio, 0.01) },
        ];
        return (
          <div key={i} className="relative flex flex-col items-center bg-white border border-ink-200 rounded-xl p-3">
            <div className="relative w-[110px] h-[110px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ringData} dataKey="value" innerRadius={38} outerRadius={52} startAngle={90} endAngle={-270} strokeWidth={0}>
                    <Cell fill={ind.color} />
                    <Cell fill="#E5E7EB" />
                  </Pie>
                  <Tooltip
                    formatter={() => [display, ind.label]}
                    contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[18px] font-bold tabular-nums" style={{ color: ind.color }}>{display}</span>
                <span className={`text-[10px] font-semibold ${isOk ? "text-icon-green" : "text-icon-red"}`}>
                  {isOk ? "OK" : "Atención"}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-ink-700 font-medium text-center mt-2 leading-tight">{ind.label}</div>
            <div className="text-[10px] text-ink-500">Meta: {ind.format === "pct" ? `${(ind.target * 100).toFixed(0)}%` : ind.target.toFixed(1)}</div>
          </div>
        );
      })}
    </div>
  );
}
