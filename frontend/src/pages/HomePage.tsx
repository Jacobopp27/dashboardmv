import { useEffect, useState } from "react";
import {
  AlertCircle, CalendarClock, CircleDollarSign, Wallet, TrendingUp,
  CheckCircle2, Banknote, CreditCard, Smartphone, Building2,
} from "lucide-react";
import { api, type KPIs, type Meta, type SerieMensualPoint } from "@/lib/api";
import { fmtInt, fmtMoney, fmtPct, fmtPeriodo } from "@/lib/format";
import { KPICard } from "@/components/KPICard";
import { StatRow } from "@/components/StatRow";
import { TrendChart } from "@/components/TrendChart";

interface Props {
  meta: Meta;
  yearFilter: number | null;
  monthFromFilter?: number | null;
  monthToFilter?: number | null;
}

function formaPagoIcon(forma: string) {
  const f = forma.toLowerCase();
  if (f.includes("efect"))   return <Banknote size={18} />;
  if (f.includes("debit"))   return <CreditCard size={18} />;
  if (f.includes("qr") || f.includes("app")) return <Smartphone size={18} />;
  return <Building2 size={18} />;
}

function formaPagoTone(forma: string): "green" | "blue" | "orange" | "gray" {
  const f = forma.toLowerCase();
  if (f.includes("efect"))   return "orange";
  if (f.includes("debit"))   return "blue";
  if (f.includes("qr") || f.includes("app")) return "green";
  return "gray";
}

export function HomePage({ meta, yearFilter, monthFromFilter, monthToFilter }: Props) {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [serie, setSerie] = useState<SerieMensualPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Determinar período de corte
  const latest = meta.latest_periodo.cartera_mensual;
  const [latestY, latestM] = latest ? latest.split("-").map((n) => parseInt(n, 10)) : [2026, 1];

  // El "mes de corte" para las tarjetas KPI es el límite SUPERIOR del rango (Hasta).
  // Si no hay rango, usar el último mes con datos del año filtrado.
  const periodoYear = yearFilter ?? latestY;
  const periodoMonth = monthToFilter ?? (yearFilter ? (yearFilter === latestY ? latestM : 12) : latestM);

  useEffect(() => {
    setError(null);
    Promise.all([
      api.kpis(periodoYear, periodoMonth).catch(() => null),
      api.serieMensual(yearFilter ?? undefined).catch(() => [] as SerieMensualPoint[]),
    ])
      .then(([k, s]) => { setKpis(k); setSerie(s); })
      .catch((e) => setError(String(e)));
  }, [periodoYear, periodoMonth, yearFilter]);

  if (error) {
    return (
      <div className="napsa-card text-icon-red flex items-center gap-3">
        <AlertCircle size={20} />
        <div>
          <div className="font-semibold">Error cargando KPIs</div>
          <div className="text-[13px] text-ink-500 mt-1">{error}</div>
        </div>
      </div>
    );
  }
  if (!kpis) {
    return (
      <div className="napsa-card flex items-center gap-3 bg-soft-yellow/30">
        <AlertCircle size={20} className="text-icon-yellow" />
        <div>
          <div className="font-semibold text-ink-900">Sin datos para el período seleccionado</div>
          <div className="text-[13px] text-ink-500 mt-1">
            No hay archivos de cartera mensual para <span className="font-semibold">{periodoMonth}/{periodoYear}</span>.
            Prueba otro mes/año o limpia con "Todos".
          </div>
        </div>
      </div>
    );
  }

  const pctTone = kpis.pct_recaudo >= 0.85 ? "good" : kpis.pct_recaudo >= 0.70 ? "warn" : "bad";

  return (
    <div className="space-y-6">
      {/* === ESTRUCTURA Z: ZONA SUPERIOR (Izquierda: identidad / Derecha: KPIs gigantes) === */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* IZQUIERDA — Identidad + período (zona donde inicia la lectura Z) */}
        <div className="lg:col-span-4 bg-white rounded-2xl shadow-soft-glow p-5 flex flex-col justify-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-deepgreen-500 font-semibold mb-2">
            Copropiedad
          </div>
          <h1 className="h-display text-[32px] sm:text-[40px] text-deepgreen-900 leading-none tracking-tight">
            Monteverdi P.H.
          </h1>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[12px] text-deepgreen-500">Informe al corte:</span>
            <span className="text-[15px] font-bold text-deepgreen-900">{fmtPeriodo(kpis.periodo)}</span>
          </div>
          <div className="mt-1 text-[11px] text-deepgreen-500">
            {meta.n_unidades} unidades · {meta.files_by_category.cartera_mensual ?? 0} períodos cargados
          </div>
        </div>

        {/* DERECHA — 3 KPIs GIGANTES (regla del 200%) */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Ejecución (recaudo) */}
          <div className="bg-white rounded-2xl shadow-soft-glow-emerald p-5 flex flex-col justify-center relative">
            <div className="text-[11px] uppercase tracking-[0.15em] text-deepgreen-500 font-bold mb-2">
              Recaudo del mes
            </div>
            <div className="text-[44px] sm:text-[52px] font-bold leading-none tabular-nums text-attention">
              {fmtPct(kpis.pct_recaudo)}
            </div>
            <div className="mt-2 text-[12px] text-deepgreen-500">
              {fmtMoney(kpis.total_recaudado, { compact: true })} de {fmtMoney(kpis.total_facturado, { compact: true })}
            </div>
          </div>

          {/* Fondo de reserva */}
          <div className="bg-white rounded-2xl shadow-soft-glow p-5 flex flex-col justify-center">
            <div className="text-[11px] uppercase tracking-[0.15em] text-deepgreen-500 font-bold mb-2">
              Cartera pendiente
            </div>
            <div className="text-[36px] sm:text-[44px] font-bold leading-none tabular-nums text-deepgreen-900">
              {fmtMoney(kpis.cartera_pendiente, { compact: true })}
            </div>
            <div className="mt-2 text-[12px] text-deepgreen-500">
              {kpis.n_morosos} {kpis.n_morosos === 1 ? "unidad" : "unidades"} en mora
            </div>
          </div>

          {/* Morosidad */}
          <div className={`bg-white rounded-2xl p-5 flex flex-col justify-center ${kpis.n_morosos > 5 ? "shadow-soft-glow-red" : "shadow-soft-glow"}`}>
            <div className="text-[11px] uppercase tracking-[0.15em] text-deepgreen-500 font-bold mb-2">
              Morosidad
            </div>
            <div className={`text-[44px] sm:text-[52px] font-bold leading-none tabular-nums ${kpis.n_morosos > 5 ? "text-red-600" : "text-attention"}`}>
              {fmtPct(kpis.n_morosos / Math.max(kpis.n_unidades, 1))}
            </div>
            <div className="mt-2 text-[12px] text-deepgreen-500">
              {kpis.n_unidades - kpis.n_morosos} al día de {kpis.n_unidades}
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico de tendencia */}
      <section className="napsa-card">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-[16px] font-bold text-ink-900">Tendencia mensual</h2>
            <p className="text-[12px] text-ink-500">
              Facturación, recaudo y cartera pendiente · {yearFilter ? `Año ${yearFilter}` : "Últimos 14 meses"}
            </p>
          </div>
        </div>
        {serie.length === 0 ? (
          <div className="text-[13px] text-ink-500 py-8 text-center">Sin datos para el período seleccionado.</div>
        ) : (
          <TrendChart data={serie} highlightPeriodo={kpis.periodo} />
        )}
      </section>

      {/* Recaudo por forma de pago */}
      {kpis.por_forma_pago.length > 0 && (
        <section className="napsa-card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-[16px] font-bold text-ink-900">Recaudo del mes</h2>
              <p className="text-[12px] text-ink-500">
                {fmtInt(kpis.n_transacciones_recaudo)} transacciones · {fmtPeriodo(kpis.periodo)}
              </p>
            </div>
          </div>
          <div className="divide-y divide-ink-100">
            {kpis.por_forma_pago.map((f) => (
              <StatRow
                key={f.forma}
                icon={formaPagoIcon(f.forma)}
                tone={formaPagoTone(f.forma)}
                title={f.forma || "—"}
                value={fmtMoney(f.valor)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Bandeja resumen tipo NAPSA */}
      <section className="napsa-card">
        <h2 className="text-[16px] font-bold text-ink-900 mb-3">Estado de cartera</h2>
        <div className="divide-y divide-ink-100">
          <StatRow
            icon={<AlertCircle size={18} />}
            tone="red"
            title="Unidades en mora"
            subtitle="Tienen saldo pendiente"
            value={fmtInt(kpis.n_morosos)}
            hint={fmtMoney(kpis.cartera_pendiente)}
          />
          <StatRow
            icon={<CalendarClock size={18} />}
            tone="orange"
            title="Cuota mensual promedio"
            subtitle="Por unidad facturada"
            value={fmtMoney(kpis.total_facturado / Math.max(kpis.n_unidades, 1))}
          />
          <StatRow
            icon={<CheckCircle2 size={18} />}
            tone="green"
            title="Recaudado en el período"
            subtitle="Ingreso del mes"
            value={fmtMoney(kpis.total_recaudado)}
            hint={fmtPct(kpis.pct_recaudo)}
          />
        </div>
      </section>
    </div>
  );
}

function SkeletonHome() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-1/3 bg-ink-100 rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="napsa-kpi h-[100px] animate-pulse" />
        ))}
      </div>
      <div className="napsa-card h-[400px] animate-pulse" />
    </div>
  );
}
