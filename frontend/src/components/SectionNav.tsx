import type { ReactNode } from "react";
import {
  LayoutGrid, Scale, FileBarChart, Users2, Target, FileText, ArrowLeftRight, ArrowDownUp,
} from "lucide-react";

export type FinSection =
  | "kpis"
  | "situacion"
  | "resultados"
  | "cartera"
  | "presupuesto"
  | "revelaciones"
  | "conciliacion"
  | "flujo";

interface Item { key: FinSection; label: string; icon: ReactNode; disabled?: boolean }

const ITEMS: Item[] = [
  { key: "kpis",         label: "Indicadores KPI",       icon: <LayoutGrid size={16} /> },
  { key: "situacion",    label: "Situación Financiera",  icon: <Scale size={16} /> },
  { key: "resultados",   label: "Est. Resultados",       icon: <FileBarChart size={16} /> },
  { key: "cartera",      label: "Inf. Cartera",          icon: <Users2 size={16} /> },
  { key: "presupuesto",  label: "Ejecución Presupuestal",icon: <Target size={16} /> },
  { key: "revelaciones", label: "Revelaciones",          icon: <FileText size={16} />,       disabled: true },
  { key: "conciliacion", label: "Conciliación Bancaria", icon: <ArrowLeftRight size={16} /> },
  { key: "flujo",        label: "Flujo de Caja",         icon: <ArrowDownUp size={16} /> },
];

interface Props {
  active: FinSection;
  onChange: (k: FinSection) => void;
}

export function SectionNav({ active, onChange }: Props) {
  return (
    <>
      {/* Desktop: sidebar vertical */}
      <aside className="hidden lg:flex flex-col gap-2 w-52 shrink-0">
        <div className="text-[10px] uppercase tracking-[0.18em] text-navy-600 font-semibold px-1 mb-1">
          Reportes Financieros
        </div>
        {ITEMS.map((it) => (
          <button
            key={it.key}
            disabled={it.disabled}
            onClick={() => onChange(it.key)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12.5px] text-left font-semibold transition-all border ${
              active === it.key
                ? "bg-navy-600 text-white border-navy-700 shadow-md"
                : it.disabled
                  ? "bg-white text-ink-300 border-ink-200 cursor-not-allowed"
                  : "bg-white text-navy-700 border-ink-200 hover:bg-navy-50 hover:border-navy-200"
            }`}
          >
            <span className="shrink-0">{it.icon}</span>
            <span className="truncate leading-tight">{it.label}</span>
            {it.disabled && <span className="ml-auto text-[9px] uppercase opacity-60">Próx.</span>}
          </button>
        ))}
      </aside>

      {/* Mobile: chips horizontales */}
      <div className="lg:hidden -mx-4 px-4 overflow-x-auto">
        <div className="flex gap-2 pb-2 min-w-max">
          {ITEMS.map((it) => (
            <button
              key={it.key}
              disabled={it.disabled}
              onClick={() => onChange(it.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] whitespace-nowrap font-semibold border ${
                active === it.key
                  ? "bg-navy-600 text-white border-navy-700"
                  : it.disabled
                    ? "bg-white text-ink-300 border-ink-200 cursor-not-allowed"
                    : "bg-white text-navy-700 border-ink-200 hover:bg-navy-50"
              }`}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
