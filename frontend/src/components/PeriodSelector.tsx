import { Calendar } from "lucide-react";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MES_CORTO = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

interface Props {
  years: number[];
  year: number | null;
  /** Mes inicial del rango (1-12) */
  monthFrom: number | null;
  /** Mes final del rango (1-12) */
  monthTo: number | null;
  onYearChange: (y: number | null) => void;
  onRangeChange: (from: number | null, to: number | null) => void;
}

/** Selector de período: Año + rango de meses + atajos rápidos. */
export function PeriodSelector({ years, year, monthFrom, monthTo, onYearChange, onRangeChange }: Props) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const setQuick = (preset: "thisMonth" | "thisYear" | "q1" | "q2" | "q3" | "q4" | "s1" | "s2" | "all") => {
    const defaultYear = years.includes(currentYear) ? currentYear : years[years.length - 1] ?? null;
    switch (preset) {
      case "thisMonth": onYearChange(defaultYear); onRangeChange(currentMonth, currentMonth); break;
      case "thisYear":  onYearChange(defaultYear); onRangeChange(null, null); break;
      case "q1": onYearChange(year ?? defaultYear); onRangeChange(1, 3); break;
      case "q2": onYearChange(year ?? defaultYear); onRangeChange(4, 6); break;
      case "q3": onYearChange(year ?? defaultYear); onRangeChange(7, 9); break;
      case "q4": onYearChange(year ?? defaultYear); onRangeChange(10, 12); break;
      case "s1": onYearChange(year ?? defaultYear); onRangeChange(1, 6); break;
      case "s2": onYearChange(year ?? defaultYear); onRangeChange(7, 12); break;
      case "all": onYearChange(null); onRangeChange(null, null); break;
    }
  };

  const handleFromChange = (val: string) => {
    if (val === "all") onRangeChange(null, monthTo);
    else {
      const from = parseInt(val, 10);
      // Si el "hasta" es menor que el "desde" nuevo, ajustar
      const to = monthTo && monthTo < from ? from : monthTo;
      onRangeChange(from, to);
    }
  };
  const handleToChange = (val: string) => {
    if (val === "all") onRangeChange(monthFrom, null);
    else {
      const to = parseInt(val, 10);
      const from = monthFrom && monthFrom > to ? to : monthFrom;
      onRangeChange(from, to);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-ink-500">
        <Calendar size={14} />
        <span className="text-[11px] uppercase tracking-wider font-semibold">Período</span>
      </div>

      {/* Año */}
      <select
        value={year ?? "all"}
        onChange={(e) => {
          if (e.target.value === "all") {
            onYearChange(null);
            onRangeChange(null, null);
          } else {
            onYearChange(parseInt(e.target.value, 10));
          }
        }}
        className="bg-white border border-ink-200 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-navy-700 hover:border-navy-300 focus:outline-none focus:ring-2 focus:ring-navy-500/30 cursor-pointer"
      >
        <option value="all">Todos los años</option>
        {[...years].reverse().map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      {/* Rango: Desde — Hasta */}
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-ink-500 font-medium">Desde</span>
        <select
          value={monthFrom ?? "all"}
          disabled={year === null}
          onChange={(e) => handleFromChange(e.target.value)}
          className="bg-white border border-ink-200 rounded-lg px-2 py-1.5 text-[12px] font-medium text-navy-700 hover:border-navy-300 focus:outline-none focus:ring-2 focus:ring-navy-500/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="all">Enero</option>
          {MESES.map((nombre, i) => (
            <option key={i + 1} value={i + 1}>{MES_CORTO[i]}</option>
          ))}
        </select>
        <span className="text-[11px] text-ink-500 font-medium">a</span>
        <select
          value={monthTo ?? "all"}
          disabled={year === null}
          onChange={(e) => handleToChange(e.target.value)}
          className="bg-white border border-ink-200 rounded-lg px-2 py-1.5 text-[12px] font-medium text-navy-700 hover:border-navy-300 focus:outline-none focus:ring-2 focus:ring-navy-500/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="all">Diciembre</option>
          {MESES.map((nombre, i) => (
            <option key={i + 1} value={i + 1}>{MES_CORTO[i]}</option>
          ))}
        </select>
      </div>

      {/* Atajos rápidos */}
      <div className="hidden md:flex items-center gap-1 ml-1 flex-wrap">
        <button onClick={() => setQuick("thisMonth")} className="text-[10.5px] font-semibold px-2 py-1.5 rounded-md border border-ink-200 hover:bg-navy-50 hover:border-navy-300 text-navy-700">Mes actual</button>
        <button onClick={() => setQuick("q1")} className="text-[10.5px] font-semibold px-2 py-1.5 rounded-md border border-ink-200 hover:bg-navy-50 hover:border-navy-300 text-navy-700">Q1</button>
        <button onClick={() => setQuick("q2")} className="text-[10.5px] font-semibold px-2 py-1.5 rounded-md border border-ink-200 hover:bg-navy-50 hover:border-navy-300 text-navy-700">Q2</button>
        <button onClick={() => setQuick("q3")} className="text-[10.5px] font-semibold px-2 py-1.5 rounded-md border border-ink-200 hover:bg-navy-50 hover:border-navy-300 text-navy-700">Q3</button>
        <button onClick={() => setQuick("q4")} className="text-[10.5px] font-semibold px-2 py-1.5 rounded-md border border-ink-200 hover:bg-navy-50 hover:border-navy-300 text-navy-700">Q4</button>
        <button onClick={() => setQuick("s1")} className="text-[10.5px] font-semibold px-2 py-1.5 rounded-md border border-ink-200 hover:bg-navy-50 hover:border-navy-300 text-navy-700">Sem 1</button>
        <button onClick={() => setQuick("s2")} className="text-[10.5px] font-semibold px-2 py-1.5 rounded-md border border-ink-200 hover:bg-navy-50 hover:border-navy-300 text-navy-700">Sem 2</button>
        <button onClick={() => setQuick("thisYear")} className="text-[10.5px] font-semibold px-2 py-1.5 rounded-md border border-ink-200 hover:bg-navy-50 hover:border-navy-300 text-navy-700">Año actual</button>
        <button onClick={() => setQuick("all")} className="text-[10.5px] font-semibold px-2 py-1.5 rounded-md border border-ink-200 hover:bg-navy-50 hover:border-navy-300 text-navy-700">Todos</button>
      </div>
    </div>
  );
}
