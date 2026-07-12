import { useEffect, useState } from "react";
import { api, type Meta } from "@/lib/api";
import { TopBar } from "@/components/TopBar";
import { BottomNav, SideNav, type NavKey } from "@/components/BottomNav";
import { DashboardEjecutivo } from "@/pages/DashboardEjecutivo";
import { HomePage } from "@/pages/HomePage";
import { FinancieroPage } from "@/pages/FinancieroPage";
import { AmbientalPage } from "@/pages/AmbientalPage";
import { ModulePlaceholderPage } from "@/pages/ModulePlaceholderPage";

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState<NavKey>("home");
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [monthFromFilter, setMonthFromFilter] = useState<number | null>(null);
  const [monthToFilter, setMonthToFilter] = useState<number | null>(null);
  const [tick, setTick] = useState(0); // forzar re-render tras refresh

  const handleRangeChange = (from: number | null, to: number | null) => {
    setMonthFromFilter(from);
    setMonthToFilter(to);
  };

  useEffect(() => {
    api.meta()
      .then(setMeta)
      .catch((e) => setError(String(e)));
  }, [tick]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await api.refresh();
      setTick((t) => t + 1);
    } catch (e) {
      setError(String(e));
    } finally {
      setRefreshing(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="napsa-card max-w-md">
          <h2 className="text-lg font-bold text-icon-red mb-2">No se pudo conectar al backend</h2>
          <p className="text-[13px] text-ink-500">
            Verifica que el backend FastAPI esté corriendo en <code className="px-1 py-0.5 bg-ink-100 rounded">localhost:8000</code>.
          </p>
          <p className="text-[12px] text-ink-500 mt-2 font-mono">{error}</p>
        </div>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-ink-500 text-[14px]">Cargando datos…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <TopBar
        onRefresh={handleRefresh}
        refreshing={refreshing}
        yearFilter={yearFilter}
        monthFromFilter={monthFromFilter}
        monthToFilter={monthToFilter}
        years={meta.years_available}
        onYearChange={setYearFilter}
        onRangeChange={handleRangeChange}
      />

      <div className="flex-1 flex">
        <SideNav active={page} onChange={setPage} />

        <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-5 pb-24 lg:pb-8">
          {page === "home" && (
            <div className="space-y-8">
              <DashboardEjecutivo yearFilter={yearFilter} />
              {/* Reportes detallados (Cartera, Recaudo, Tendencia) — se conservan bajo el tablero ejecutivo */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-6 rounded-sm" style={{ background: "#C9A55C" }} />
                  <h2 className="text-[18px] font-bold" style={{ color: "#0F2438" }}>Reportes operativos detallados</h2>
                </div>
                <HomePage meta={meta} yearFilter={yearFilter} monthFromFilter={monthFromFilter} monthToFilter={monthToFilter} />
              </div>
            </div>
          )}
          {page === "financiero" && <FinancieroPage meta={meta} yearFilter={yearFilter} monthFromFilter={monthFromFilter} monthToFilter={monthToFilter} />}
          {page === "administrativos" && <ModulePlaceholderPage moduleKey="administrativos" />}
          {page === "ambientales" && <AmbientalPage />}
          {page === "convivencia" && <ModulePlaceholderPage moduleKey="convivencia" />}
          {page === "seguridad" && <ModulePlaceholderPage moduleKey="seguridad" />}
        </main>
      </div>

      <BottomNav active={page} onChange={setPage} />
    </div>
  );
}
