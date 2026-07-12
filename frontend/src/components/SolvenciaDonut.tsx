import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

interface Indicator {
  label: string;
  value: number | null;
  format?: "ratio" | "pct";
  color: string;
  weight: number;   // peso visual en el donut (suman 100)
}

interface Props {
  indicators: Indicator[];
}

/**
 * Donut único de 4 segmentos para "Análisis Detallado de Liquidez y Solvencia · Índices Clave"
 * Replica el estilo de la imagen NAPSA con segmentos de tamaños distintos según peso.
 */
export function SolvenciaDonut({ indicators }: Props) {
  // Datos del donut: cada segmento ocupa su % de peso
  const data = indicators.map((ind) => ({
    name: ind.label,
    value: ind.weight,
    color: ind.color,
    real: ind.value ?? 0,
    realFormatted: ind.format === "pct" ? `${((ind.value ?? 0) * 100).toFixed(1)}%` : (ind.value ?? 0).toFixed(2),
  }));

  return (
    <div className="space-y-3">
      <div className="relative w-full h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={55}
              outerRadius={95}
              startAngle={90}
              endAngle={-270}
              strokeWidth={2}
              stroke="#FFFFFF"
              label={({ value }) => `${value}%`}
              labelLine={false}
            >
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip
              formatter={(_v: number, _name: string, item: { payload?: { name?: string; realFormatted?: string } }) =>
                [item?.payload?.realFormatted ?? "—", item?.payload?.name ?? ""]
              }
              contentStyle={{ borderRadius: 12, border: "1px solid #E4E4E7", background: "#FFFFFF", fontSize: 12, color: "#1F2937" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda con valores reales */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        {indicators.map((ind, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ind.color }} />
            <span className="text-exec-cardSubtext truncate">{ind.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
