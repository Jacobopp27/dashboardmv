import { RefreshCw } from "lucide-react";
import { PeriodSelector } from "./PeriodSelector";
import { LogoMonteverdi } from "./LogoMonteverdi";

interface Props {
  onRefresh: () => void;
  refreshing?: boolean;
  yearFilter: number | null;
  monthFromFilter: number | null;
  monthToFilter: number | null;
  years: number[];
  onYearChange: (y: number | null) => void;
  onRangeChange: (from: number | null, to: number | null) => void;
}

export function TopBar({ onRefresh, refreshing, yearFilter, monthFromFilter, monthToFilter, years, onYearChange, onRangeChange }: Props) {
  return (
    <header className="sticky top-0 z-10 bg-white border-b border-ink-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-3 shrink-0">
          <LogoMonteverdi height={38} />
          <div className="hidden sm:block min-w-0 border-l border-ink-200 pl-3">
            <div className="text-[13px] font-bold text-ink-900 leading-tight">Propiedad Horizontal</div>
            <div className="text-[11px] text-ink-500">Dashboard administrativo</div>
          </div>
        </div>

        <div className="flex-1" />

        <PeriodSelector
          years={years}
          year={yearFilter}
          monthFrom={monthFromFilter}
          monthTo={monthToFilter}
          onYearChange={onYearChange}
          onRangeChange={onRangeChange}
        />

        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="w-10 h-10 rounded-xl bg-ink-50 border border-ink-200 hover:bg-ink-100 flex items-center justify-center text-ink-700 disabled:opacity-50 transition-colors"
          title="Refrescar datos"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>
    </header>
  );
}
