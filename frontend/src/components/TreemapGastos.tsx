import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { fmtMoney, fmtPct } from "@/lib/format";

export interface CategoriaGasto {
  name: string;
  value: number;
  color: string;
}

interface Props { data: CategoriaGasto[]; total?: number }

interface CellProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  payload?: { name?: string; value?: number; color?: string };
  name?: string;
  value?: number;
  color?: string;
}

function Cell(props: CellProps) {
  const { x = 0, y = 0, width = 0, height = 0 } = props;
  const name = props.payload?.name ?? props.name ?? "";
  const value = props.payload?.value ?? props.value ?? 0;
  const color = props.payload?.color ?? props.color ?? "#C9A96E";
  const showLabel = width > 60 && height > 30;
  const showSubLabel = width > 90 && height > 50;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} stroke="#FFFFFF" strokeWidth={2} />
      {showLabel && (
        <>
          <text x={x + 8} y={y + 18} fill="#FFF" fontSize={12} fontWeight={700}>{name}</text>
          {showSubLabel && (
            <text x={x + 8} y={y + 34} fill="#FFF" fontSize={10} opacity={0.85}>{fmtMoney(value, { compact: true })}</text>
          )}
        </>
      )}
    </g>
  );
}

export function TreemapGastos({ data, total }: Props) {
  const grandTotal = total ?? data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="w-full h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={data}
          dataKey="value"
          stroke="#FFFFFF"
          fill="#C9A96E"
          content={<Cell />}
        >
          <Tooltip
            formatter={(v: number, _: string, item: { payload?: { name?: string } }) => [
              `${fmtMoney(v)} (${fmtPct(v / grandTotal)})`,
              item?.payload?.name ?? "",
            ]}
            contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 12 }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
