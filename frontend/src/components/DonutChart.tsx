import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { fmtMoney } from "@/lib/format";

interface Slice { name: string; value: number; color: string }
interface Props {
  data: Slice[];
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChart({ data, centerLabel, centerValue }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative w-full h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={60} outerRadius={92} paddingAngle={2} strokeWidth={0}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip
            formatter={(v: number, name: string) => [fmtMoney(v), name]}
            contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[11px] uppercase tracking-wider text-ink-500 font-medium">{centerLabel}</div>
          <div className="text-[20px] font-bold text-ink-900 tabular-nums">{centerValue ?? fmtMoney(total)}</div>
        </div>
      )}
    </div>
  );
}
