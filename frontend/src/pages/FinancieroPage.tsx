import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Banknote, TrendingUp, TrendingDown, AlertTriangle, Droplets, Landmark,
  Wrench, ShieldCheck, Users, Users2, Scale, Leaf, Briefcase, Target, FileBarChart,
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine,
} from "recharts";
import {
  api, type AgingAnual, type EjecucionPpto, type IndicadoresFin, type LiquidezMes, type Meta,
  type ResultadoMes, type SaldoMes,
} from "@/lib/api";
import { fmtMesCorto, fmtMoney, fmtPct, fmtPeriodo } from "@/lib/format";
import { IconBadge } from "@/components/IconBadge";
import { SectionNav, type FinSection } from "@/components/SectionNav";
import { SubTabs, type SubTabKey } from "@/components/SubTabs";
import { TreemapGastos } from "@/components/TreemapGastos";
import { SolvenciaDonut } from "@/components/SolvenciaDonut";
import { KPIRowItem, HighlightedLiquidityCard } from "@/components/KPIRowItem";
import { DualKPICard } from "@/components/DualKPICard";
import { Semaphore } from "@/components/Semaphore";
import { EstadosMensualesView } from "@/components/EstadosMensualesView";
import { KPIsConsolidadoView } from "@/components/KPIsConsolidadoView";
import { SituacionFinancieraView } from "@/components/SituacionFinancieraView";
import { EstadoResultadosView } from "@/components/EstadoResultadosView";
import { ExecutiveHeader } from "@/components/ExecutiveHeader";
import { FlujoDeCajaView } from "@/components/FlujoDeCajaView";
import { ConciliacionBancariaView } from "@/components/ConciliacionBancariaView";
import { CarteraPage } from "@/pages/CarteraPage";

interface Props { meta: Meta; yearFilter: number | null; monthFromFilter?: number | null; monthToFilter?: number | null }

const CAT_META: Record<string, { tone: "blue" | "orange" | "yellow" | "green" | "red" | "gray"; icon: typeof Wrench; color: string }> = {
  Mantenimiento:    { tone: "orange", icon: Wrench,      color: "#EA580C" },
  Seguridad:        { tone: "red",    icon: ShieldCheck, color: "#DC2626" },
  Convivencia:      { tone: "yellow", icon: Users,       color: "#CA8A04" },
  Ambiental:        { tone: "green",  icon: Leaf,        color: "#0D9488" },
  Administrativos:  { tone: "blue",   icon: Briefcase,   color: "#0891B2" },
};

export function FinancieroPage({ meta, yearFilter, monthFromFilter, monthToFilter }: Props) {
  // Rango efectivo de meses: Desde (default 1) — Hasta (default 12)
  const monthFrom = monthFromFilter ?? 1;
  const monthTo   = monthToFilter ?? 12;
  const hasRange  = monthFromFilter !== null || monthToFilter !== null;
  const [section, setSection] = useState<FinSection>("kpis");
  // Corte local del balance (sobreescribe el monthToFilter solo dentro de Situación Financiera)
  const [corteLocal, setCorteLocal] = useState<number | null>(null);
  const [subtab, setSubtab] = useState<SubTabKey>("principales");

  const [saldos, setSaldos] = useState<SaldoMes[]>([]);
  const [liquidez, setLiquidez] = useState<LiquidezMes[]>([]);
  const [resultados, setResultados] = useState<ResultadoMes[]>([]);
  const [ejecucion, setEjecucion] = useState<EjecucionPpto[]>([]);
  const [indicadores, setIndicadores] = useState<IndicadoresFin | null>(null);
  const [agingAnual, setAgingAnual] = useState<AgingAnual | null>(null);
  const [yearsAvailable, setYearsAvailable] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const yearActive = yearFilter ?? yearsAvailable.slice(-1)[0] ?? 2025;

  useEffect(() => { api.finMeta().then((m) => setYearsAvailable(m.years_available)).catch(() => {}); }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.finSaldos(yearFilter ?? undefined),
      api.finLiquidez(yearFilter ?? undefined),
      api.finResultados(yearFilter ?? undefined),
      api.finEjecucionPpto(yearActive),
      api.finIndicadores(yearFilter ?? undefined).catch(() => null),
      api.carteraAgingAnual(yearActive).catch(() => null),
    ])
      .then(([s, l, r, e, i, a]) => {
        setSaldos(s); setLiquidez(l); setResultados(r);
        setEjecucion(e); setIndicadores(i); setAgingAnual(a);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [yearFilter, yearActive]);

  // Etiqueta de meses cortos
  const MES_CORTO = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  // Tarjetas puntuales (saldo, liquidez): mes de corte = mes "Hasta" del rango (o último disponible)
  const mesCorte = monthToFilter ?? null;
  const ultimoSaldo = mesCorte
    ? saldos.find((s) => s.month === mesCorte) ?? saldos[saldos.length - 1]
    : saldos[saldos.length - 1];
  const ultimaLiquidez = mesCorte
    ? liquidez.find((l) => l.month === mesCorte) ?? liquidez[liquidez.length - 1]
    : liquidez[liquidez.length - 1];

  // Acumulados: filtrar meses dentro del rango [monthFrom..monthTo]
  const resultadosAcum = hasRange
    ? resultados.filter((r) => r.month >= monthFrom && r.month <= monthTo)
    : resultados;
  const totalIngresosOp = resultadosAcum.reduce((s, r) => s + r.ingreso_operacional, 0);
  const totalIngresosMg = resultadosAcum.reduce((s, r) => s + r.ingreso_marginal, 0);
  const totalIngresos = totalIngresosOp + totalIngresosMg;
  const totalEgresos  = resultadosAcum.reduce((s, r) => s + r.egreso_total_egresos, 0);
  const resultadoAcum = totalIngresos - totalEgresos;
  const nMeses = monthTo - monthFrom + 1;
  // Etiqueta del rango: "Ene–Mar 2025" o "2025" si es todo el año
  const rangoLabel = hasRange
    ? (monthFrom === monthTo
        ? `${MES_CORTO[monthFrom - 1]} ${yearActive}`
        : `${MES_CORTO[monthFrom - 1]}–${MES_CORTO[monthTo - 1]} ${yearActive}`)
    : `${yearActive}`;

  // Tasa de morosidad — placeholder simple: si hay un endpoint de cartera, se podría conectar
  // Por ahora la dejamos calculable a partir de la API de cartera, pero como Financiero no la consume,
  // mostramos % de cuentas por cobrar sobre activo corriente como proxy.
  const tasaMorosidad =
    ultimaLiquidez && ultimaLiquidez.activo_corriente > 0
      ? ultimaLiquidez.copropietarios / ultimaLiquidez.activo_corriente
      : 0;

  // Saldo bancario total (banco operación + caja, sin fiducia)
  const saldoBancario = (ultimoSaldo?.banco_operacion ?? 0) + (ultimoSaldo?.efectivo_caja ?? 0);
  const estadoLiquidez = (ultimoSaldo?.disponible_total ?? 0);

  // Ejecución presupuestal:
  // - Si hay mes filtrado: ejecutado = suma de egresos hasta ese mes; meta = ppto_anual * (mes/12)
  // - Si no: ejecutado = del año completo; meta = ppto_anual
  const ejecucionTotal = useMemo(() => {
    const totalPpto = ejecucion.reduce((s, e) => s + e.presupuesto_anual, 0);
    if (hasRange) {
      // Sumar egresos reales del rango de meses
      const ejecEnRango = resultadosAcum.reduce((s, r) => s + r.egreso_total_egresos, 0);
      // Meta proporcional: ppto_anual * (N meses del rango / 12)
      const metaProporcional = totalPpto * (nMeses / 12);
      return {
        totalPpto: metaProporcional,
        totalEjec: ejecEnRango,
        pct: metaProporcional > 0 ? ejecEnRango / metaProporcional : 0,
        pptoAnual: totalPpto,
      };
    }
    const totalEjec = ejecucion.reduce((s, e) => s + e.ejecutado_acumulado, 0);
    return {
      totalPpto,
      totalEjec,
      pct: totalPpto > 0 ? totalEjec / totalPpto : 0,
      pptoAnual: totalPpto,
    };
  }, [ejecucion, hasRange, nMeses, resultadosAcum]);

  // Ejecución por categoría ajustada al rango. Si hay rango, sumamos los egresos por categoría
  // dentro del rango y comparamos contra ppto_anual * (N/12). Si no, usamos los datos anuales del backend.
  const ejecucionAjustada = useMemo(() => {
    if (!hasRange) {
      return ejecucion.map((e) => ({
        categoria: e.categoria,
        presupuestoBase: e.presupuesto_anual,
        ejecutado: e.ejecutado_acumulado,
        pct: e.pct_ejecucion ?? 0,
        pptoAnual: e.presupuesto_anual,
      }));
    }
    // Mapeo categoria → key de egreso en `resultados`
    const keyMap: Record<string, keyof typeof resultadosAcum[0]> = {
      "Mantenimiento":    "egreso_mantenimiento",
      "Seguridad":        "egreso_seguridad",
      "Convivencia":      "egreso_convivencia",
      "Ambiental":        "egreso_ambiental",
      "Administrativos":  "egreso_administrativos",
    };
    return ejecucion.map((e) => {
      const key = keyMap[e.categoria];
      const ejecRango = key
        ? resultadosAcum.reduce((s, r) => s + (Number(r[key]) || 0), 0)
        : 0;
      const metaProp = e.presupuesto_anual * (nMeses / 12);
      return {
        categoria: e.categoria,
        presupuestoBase: metaProp,
        ejecutado: ejecRango,
        pct: metaProp > 0 ? ejecRango / metaProp : 0,
        pptoAnual: e.presupuesto_anual,
      };
    });
  }, [ejecucion, hasRange, nMeses, resultadosAcum]);

  // Datos para treemap — mes filtrado o último disponible
  // Treemap: si hay rango, SUMA todos los egresos por categoría dentro del rango.
  // Si no hay rango, usa solo el último mes (snapshot mensual).
  const treemapData = useMemo(() => {
    if (hasRange) {
      const sum = (key: keyof typeof resultadosAcum[0]) =>
        resultadosAcum.reduce((s, r) => s + (Number(r[key]) || 0), 0);
      const items = [
        { name: "Seguridad",       value: sum("egreso_seguridad"),       color: CAT_META.Seguridad.color },
        { name: "Mantenimiento",   value: sum("egreso_mantenimiento"),   color: CAT_META.Mantenimiento.color },
        { name: "Ambiental",       value: sum("egreso_ambiental"),       color: CAT_META.Ambiental.color },
        { name: "Administrativos", value: sum("egreso_administrativos"), color: CAT_META.Administrativos.color },
        { name: "Convivencia",     value: sum("egreso_convivencia"),     color: CAT_META.Convivencia.color },
      ].filter((x) => x.value > 0);
      return items;
    }
    // Sin rango: snapshot del último mes
    const ult = mesCorte
      ? resultados.find((r) => r.month === mesCorte) ?? resultados[resultados.length - 1]
      : resultados[resultados.length - 1];
    if (!ult) return [];
    return [
      { name: "Seguridad",       value: ult.egreso_seguridad,       color: CAT_META.Seguridad.color },
      { name: "Mantenimiento",   value: ult.egreso_mantenimiento,   color: CAT_META.Mantenimiento.color },
      { name: "Ambiental",       value: ult.egreso_ambiental,       color: CAT_META.Ambiental.color },
      { name: "Administrativos", value: ult.egreso_administrativos, color: CAT_META.Administrativos.color },
      { name: "Convivencia",     value: ult.egreso_convivencia,     color: CAT_META.Convivencia.color },
    ].filter((x) => x.value > 0);
  }, [hasRange, resultadosAcum, mesCorte, resultados]);

  // Resumen consolidado anual: si hay rango, solo meses dentro del rango; si no, todo el año.
  const consolidadoAnual = resultadosAcum.map((r) => ({
    periodo: r.periodo,
    ingresos: r.ingreso_operacional + r.ingreso_marginal,
    egresos: r.egreso_total_egresos,
    resultado: r.diferencia,
  }));

  // Semáforo automático
  const semaforo: { tone: "good" | "warn" | "bad"; title: string; text: string }[] = [];
  if (indicadores) {
    const rc = indicadores.razon_corriente ?? 0;
    if (rc >= 1.5) semaforo.push({ tone: "good", title: "Razón corriente saludable", text: `La razón corriente es ${rc.toFixed(2)}, muy por encima del mínimo recomendado (1.0). La copropiedad tiene capacidad de cubrir sus obligaciones de corto plazo.` });
    else if (rc >= 1.0) semaforo.push({ tone: "warn", title: "Razón corriente en límite", text: `La razón corriente es ${rc.toFixed(2)}. Está sobre el mínimo aceptable pero conviene vigilar el aumento de cuentas por pagar.` });
    else semaforo.push({ tone: "bad", title: "Razón corriente crítica", text: `La razón corriente es ${rc.toFixed(2)}, por debajo del mínimo recomendado. El pasivo corriente supera al activo corriente — riesgo de liquidez.` });
  }
  if (ejecucion.length > 0) {
    const sobre = ejecucion.filter((e) => (e.pct_ejecucion ?? 0) > 1.05);
    if (sobre.length > 0) {
      const top = sobre.map((s) => `${s.categoria} (${fmtPct(s.pct_ejecucion ?? 0)})`).join(", ");
      semaforo.push({ tone: "bad", title: "Categorías sobre-ejecutadas", text: `Las siguientes categorías superan el presupuesto: ${top}.` });
    } else {
      semaforo.push({ tone: "good", title: "Presupuesto bajo control", text: `Todas las categorías están dentro del presupuesto anual aprobado.` });
    }
  }
  if (resultadoAcum < 0) {
    semaforo.push({ tone: "warn", title: "Resultado anual en déficit", text: `Los egresos del año (${fmtMoney(totalEgresos)}) superan los ingresos totales (${fmtMoney(totalIngresos)}). Diferencia: ${fmtMoney(resultadoAcum)}.` });
  } else {
    semaforo.push({ tone: "good", title: "Resultado anual positivo", text: `Los ingresos del año (${fmtMoney(totalIngresos)}) cubren los egresos (${fmtMoney(totalEgresos)}). Superávit: ${fmtMoney(resultadoAcum)}.` });
  }

  if (error) {
    return (
      <div className="napsa-card text-icon-red flex items-center gap-3">
        <AlertTriangle size={20} /><div className="text-[13px]">{error}</div>
      </div>
    );
  }

  // KPIs comparativos: selección de meses + semáforo en 4 grupos
  if (section === "kpis") {
    return (
      <div className="space-y-4">
        <ExecutiveHeader
          eyebrow="Reporte ejecutivo"
          titulo="Indicadores KPI Comparativos"
          subtitulo={<>Liquidez · Cartera · Presupuestal · Solvencia — con semáforo y comparación entre meses</>}
          right={
            <HighlightedLiquidityCard
              value={fmtMoney(estadoLiquidez, { compact: true })}
              indicator={estadoLiquidez > 30_000_000 ? "green" : estadoLiquidez > 10_000_000 ? "yellow" : "red"}
            />
          }
        />
        <div className="bg-exec-bg rounded-3xl p-5 lg:p-7 shadow-md border border-ink-200">
          <div className="flex flex-col lg:flex-row gap-4">
            <SectionNav active={section} onChange={setSection} />
            <div className="flex-1 min-w-0">
              <KPIsConsolidadoView
                saldos={saldos}
                liquidez={liquidez}
                resultados={resultados}
                ejecucion={ejecucion}
                agingAnual={agingAnual}
                indicadoresActual={indicadores}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Situación Financiera: ESFA con vista individual + comparativo entre meses
  if (section === "situacion") {
    return (
      <div className="space-y-4">
        <ExecutiveHeader
          eyebrow="Reporte ejecutivo"
          titulo="Situación Financiera"
          subtitulo={<>Estado de la Situación Financiera (ESFA) — Activo, Pasivo y Patrimonio</>}
          right={
            ultimaLiquidez ? (
              <HighlightedLiquidityCard
                value={fmtMoney(((ultimaLiquidez.efectivo_caja ?? 0) + (ultimaLiquidez.banco_operacion ?? 0) + (ultimaLiquidez.fiducia ?? 0)), { compact: true })}
                indicator={((ultimaLiquidez.efectivo_caja ?? 0) + (ultimaLiquidez.banco_operacion ?? 0) + (ultimaLiquidez.fiducia ?? 0)) > 30_000_000 ? "green" : "yellow"}
              />
            ) : undefined
          }
        />
        <div className="bg-exec-bg rounded-3xl p-5 lg:p-7 shadow-md border border-ink-200">
          <div className="flex flex-col lg:flex-row gap-4">
            <SectionNav active={section} onChange={setSection} />
            <div className="flex-1 min-w-0">
              <SituacionFinancieraView liquidez={liquidez} monthToFilter={monthToFilter} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Conciliación Bancaria: comparativa libro vs banco con selector de mes
  if (section === "conciliacion") {
    return (
      <div className="space-y-4">
        <div className="bg-exec-bg rounded-3xl p-5 lg:p-7 shadow-md border border-ink-200">
          <div className="flex flex-col lg:flex-row gap-4">
            <SectionNav active={section} onChange={setSection} />
            <div className="flex-1 min-w-0">
              <ConciliacionBancariaView
                saldos={saldos}
                liquidez={liquidez}
                añosDisponibles={yearsAvailable}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Flujo de Caja: reporte ejecutivo con selector de año fiscal
  if (section === "flujo") {
    return (
      <div className="space-y-4">
        <div className="bg-exec-bg rounded-3xl p-5 lg:p-7 shadow-md border border-ink-200">
          <div className="flex flex-col lg:flex-row gap-4">
            <SectionNav active={section} onChange={setSection} />
            <div className="flex-1 min-w-0">
              <FlujoDeCajaView
                saldos={saldos}
                resultados={resultados}
                añosDisponibles={yearsAvailable}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Cartera: render la página completa dentro del panel claro
  if (section === "cartera") {
    return (
      <div className="space-y-4">
        <ExecutiveHeader
          eyebrow="Reporte ejecutivo"
          titulo="Gestión de Cartera"
          subtitulo={<>Estado de morosidad, aging y recaudo · <span className="font-semibold text-white">Año {yearActive}</span></>}
        />
        <div className="bg-exec-bg rounded-3xl p-5 lg:p-7 shadow-md border border-ink-200">
          <div className="flex flex-col lg:flex-row gap-4">
            <SectionNav active={section} onChange={setSection} />
            <div className="flex-1 min-w-0 bg-white rounded-xl p-5 shadow-sm border border-ink-200">
              <CarteraPage meta={meta} yearFilter={yearFilter} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ExecutiveHeader
        eyebrow={section === "resultados" ? "Reporte ejecutivo" : "Tablero financiero"}
        titulo={section === "resultados" ? "Análisis de Estado de Resultados" : "Tablero Financiero Integral"}
        subtitulo={
          <>
            {ultimoSaldo && <>Corte: <span className="font-semibold text-white">{fmtPeriodo(ultimoSaldo.periodo)}</span> · </>}
            Año fiscal <span className="font-semibold text-white">{yearActive}</span>
          </>
        }
        right={
          <HighlightedLiquidityCard
            value={fmtMoney(estadoLiquidez, { compact: true })}
            indicator={estadoLiquidez > 30_000_000 ? "green" : estadoLiquidez > 10_000_000 ? "yellow" : "red"}
          />
        }
      />
      <div className="bg-exec-bg rounded-3xl p-5 lg:p-7 shadow-md border border-ink-200">
      <div className="space-y-4">

      {/* Layout: sidebar de informes + main */}
      <div className="flex flex-col lg:flex-row gap-4">
        <SectionNav active={section} onChange={setSection} />

        <div className="flex-1 min-w-0 space-y-4">
          {/* Reporte Ejecutivo de Resultados (solo en Est. Resultados, arriba de los reportes operativos) */}
          {section === "resultados" && (
            <>
              <EstadoResultadosView
                resultados={resultados}
                ejecucion={ejecucion}
                añosDisponibles={yearsAvailable}
              />
              <div className="flex items-center gap-2 pt-2">
                <div className="w-1 h-6 rounded-sm" style={{ background: "#C9A55C" }} />
                <h2 className="text-[16px] font-bold" style={{ color: "#0F2438" }}>Reportes operativos detallados</h2>
              </div>
            </>
          )}

          {/* Sub-tabs */}
          <div className="!p-0">
            <SubTabs active={subtab} onChange={setSubtab} />
            <div className="pt-4 space-y-4">

              {loading && saldos.length === 0 ? (
                <div className="h-[400px] animate-pulse bg-ink-100 rounded-xl" />
              ) : subtab === "mensuales" ? (
                <EstadosMensualesView
                  liquidez={liquidez}
                  saldos={saldos}
                  resultados={resultados}
                  ejecucion={ejecucion}
                  mesInicial={mesCorte ?? (liquidez[liquidez.length - 1]?.month ?? null)}
                />
              ) : (
                <>
                  {/* === Fila superior: 4 tarjetas principales === */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <KPIRowItem
                      accent="navy"
                      icon={<Banknote size={20} />}
                      label="Saldo en Banco"
                      value={fmtMoney(saldoBancario, { compact: true })}
                      hint="Cuenta de operación + caja"
                      hintTone="neutral"
                      semaphore={saldoBancario > 20_000_000 ? "green" : saldoBancario > 10_000_000 ? "yellow" : "red"}
                    />
                    <KPIRowItem
                      accent={resultadoAcum >= 0 ? "emerald" : "sand"}
                      icon={<FileBarChart size={20} />}
                      label="Estado de Resultados"
                      value={fmtMoney(resultadoAcum, { compact: true })}
                      hint={`${hasRange ? "Acumulado " : ""}${rangoLabel} · ${resultadoAcum >= 0 ? "Superávit" : "Déficit"}`}
                      hintTone={resultadoAcum >= 0 ? "good" : "bad"}
                      semaphore={resultadoAcum >= 0 ? "green" : "red"}
                    />
                    <DualKPICard
                      accent="emerald"
                      icon={<TrendingUp size={20} />}
                      label={`Ingresos y Egresos · ${rangoLabel}`}
                      left={{ label: "Ingresos", value: fmtMoney(totalIngresos, { compact: true }), tone: "good" }}
                      right={{ label: "Egresos", value: fmtMoney(totalEgresos, { compact: true }), tone: "bad" }}
                      semaphore={totalIngresos > totalEgresos ? "green" : "red"}
                    />
                    <KPIRowItem
                      accent="sand"
                      icon={<AlertTriangle size={20} />}
                      label="Morosidad"
                      value={fmtPct(tasaMorosidad)}
                      hint={tasaMorosidad > 0.10 ? "Atención requerida" : "Saludable"}
                      hintTone={tasaMorosidad > 0.15 ? "bad" : tasaMorosidad > 0.08 ? "warn" : "good"}
                      semaphore={tasaMorosidad > 0.15 ? "red" : tasaMorosidad > 0.08 ? "yellow" : "green"}
                    />
                  </div>

                  {/* === Fila media: 2 tarjetas (Ejecución Presupuestal + Fondo de Reserva) === */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <KPIRowItem
                      accent="navy"
                      icon={<Target size={20} />}
                      label={`Ejecución Presupuestal · ${rangoLabel}`}
                      value={fmtMoney(ejecucionTotal.totalEjec, { compact: true })}
                      hint={hasRange
                        ? `${fmtPct(ejecucionTotal.pct)} de la meta proporcional (${nMeses} mes${nMeses > 1 ? "es" : ""}) · Ppto anual ${fmtMoney(ejecucionTotal.pptoAnual, { compact: true })}`
                        : `${fmtPct(ejecucionTotal.pct)} del presupuesto · ${fmtMoney(ejecucionTotal.totalPpto, { compact: true })} aprobado`}
                      hintTone="neutral"
                      chip={{
                        label: Math.abs(ejecucionTotal.pct - 1) < 0.05 ? "En Meta" : ejecucionTotal.pct > 1.05 ? "Sobre Meta" : "Bajo Meta",
                        tone: Math.abs(ejecucionTotal.pct - 1) < 0.05 ? "good" : ejecucionTotal.pct > 1.05 ? "bad" : "warn",
                      }}
                      semaphore={Math.abs(ejecucionTotal.pct - 1) < 0.05 ? "green" : ejecucionTotal.pct > 1.05 ? "red" : "yellow"}
                    />
                    <KPIRowItem
                      accent="emerald"
                      icon={<Landmark size={20} />}
                      label="Fondo de Reserva"
                      value={fmtMoney(ultimoSaldo?.fiducia ?? 0, { compact: true })}
                      hint="Fiducuenta Bancolombia · Fondo de imprevistos"
                      hintTone="neutral"
                      semaphore={(ultimoSaldo?.fiducia ?? 0) > 10_000_000 ? "green" : "yellow"}
                    />
                  </div>

                  {/* === Grid 4 columnas (estilo imagen) === */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">

                    {/* 1) Resumen Consolidado Anual */}
                    <section className="bg-white border border-ink-200 rounded-xl p-4 shadow-sm">
                      <h2 className="text-[13px] font-bold text-navy-900 leading-tight">Resumen Consolidado · {rangoLabel}</h2>
                      <p className="text-[10px] text-ink-500 mt-0.5 mb-3">Ingresos vs Gastos por mes</p>
                      <div className="w-full h-[210px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={consolidadoAnual} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" vertical={false} />
                            <XAxis dataKey="periodo" tickFormatter={fmtMesCorto} tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={{ stroke: "#E4E4E7" }} tickLine={false} />
                            <YAxis tickFormatter={(v) => fmtMoney(v, { compact: true })} tick={{ fontSize: 9, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                            <Tooltip
                              formatter={(v: number, name: string) => [fmtMoney(v), name]}
                              labelFormatter={(l: string) => fmtPeriodo(l)}
                              contentStyle={{ borderRadius: 8, border: "1px solid #E4E4E7", background: "#FFFFFF", fontSize: 11, color: "#0F1E3D" }}
                            />
                            <Legend iconType="square" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                            <Bar dataKey="ingresos" name="Ingresos Anuales" fill="#1E3A8A" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="egresos" name={`Gastos Anuales (${yearActive})`} fill="#C9A55C" radius={[3, 3, 0, 0]} />
                            <Line type="monotone" dataKey="resultado" name="Tendencia" stroke="#10B981" strokeWidth={2.5} dot={{ r: 2.5, fill: "#10B981" }} />
                            <ReferenceLine y={0} stroke="#9CA3AF" strokeDasharray="3 3" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </section>

                    {/* 2) Análisis Detallado de Liquidez y Solvencia (donut único) */}
                    <section className="bg-white border border-ink-200 rounded-xl p-4 shadow-sm">
                      <h2 className="text-[13px] font-bold text-navy-900 leading-tight">Análisis Detallado de Liquidez y Solvencia</h2>
                      <p className="text-[10px] text-ink-500 mt-0.5 mb-2">Índices Clave</p>
                      {indicadores ? (
                        <SolvenciaDonut indicators={[
                          { label: "Razón Corriente",       value: indicadores.razon_corriente,     color: "#10B981", weight: 35 },
                          { label: "Razón Ácida",           value: indicadores.razon_acida,         color: "#1E3A8A", weight: 20 },
                          { label: "Razón de Endeudamiento",value: indicadores.endeudamiento,       color: "#D4B886", weight: 25, format: "pct" },
                          { label: "Cobertura de Intereses",value: indicadores.cobertura_intereses, color: "#0F1E3D", weight: 20 },
                        ]} />
                      ) : (
                        <div className="h-[210px] flex items-center justify-center text-ink-500 text-[12px]">Sin datos</div>
                      )}
                    </section>

                    {/* 3) Desglose Avanzado de Gastos (Treemap cálido) */}
                    <section className="bg-white border border-ink-200 rounded-xl p-4 shadow-sm">
                      <h2 className="text-[13px] font-bold text-navy-900 leading-tight">Desglose Avanzado de Gastos</h2>
                      <p className="text-[10px] text-ink-500 mt-0.5 mb-3">{hasRange ? `Acumulado ${rangoLabel}` : "Composición del último mes"}</p>
                      {treemapData.length > 0 ? (
                        <TreemapGastos data={treemapData.map((t, i) => ({
                          ...t,
                          color: [ "#1E3A8A", "#10B981", "#C9A55C", "#0F1E3D", "#34D399", "#D4B886" ][i] ?? t.color,
                        }))} />
                      ) : (
                        <div className="h-[240px] flex items-center justify-center text-ink-500 text-[12px]">Sin datos</div>
                      )}
                    </section>

                    {/* 4) Liquidez Mensual y Estado de Resultados (barras+línea) */}
                    <section className="bg-white border border-ink-200 rounded-xl p-4 shadow-sm">
                      <h2 className="text-[13px] font-bold text-navy-900 leading-tight">Liquidez Mensual y Resultados · {rangoLabel}</h2>
                      <p className="text-[10px] text-ink-500 mt-0.5 mb-3">Tendencia</p>
                      <div className="w-full h-[210px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart
                            data={(hasRange
                              ? saldos.filter((s) => s.month >= monthFrom && s.month <= monthTo)
                              : saldos
                            ).map((s) => {
                              const r = resultados.find((x) => x.periodo === s.periodo);
                              return { periodo: s.periodo, disponible: s.disponible_total, utilidad: r?.diferencia ?? 0 };
                            })}
                            margin={{ top: 5, right: 0, left: -25, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#D8C8A0" vertical={false} />
                            <XAxis dataKey="periodo" tickFormatter={fmtMesCorto} tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={{ stroke: "#E4E4E7" }} tickLine={false} />
                            <YAxis yAxisId="left" tickFormatter={(v) => fmtMoney(v, { compact: true })} tick={{ fontSize: 9, fill: "#1E3A8A" }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => fmtMoney(v, { compact: true })} tick={{ fontSize: 9, fill: "#C9A55C" }} axisLine={false} tickLine={false} />
                            <Tooltip
                              formatter={(v: number, name: string) => [fmtMoney(v), name]}
                              labelFormatter={(l: string) => fmtPeriodo(l)}
                              contentStyle={{ borderRadius: 8, border: "1px solid #E4E4E7", background: "#FFFFFF", fontSize: 11, color: "#0F1E3D" }}
                            />
                            <Legend iconType="square" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                            <Bar yAxisId="left" dataKey="disponible" name="Caja (Liquidez)" fill="#1E3A8A" radius={[3, 3, 0, 0]} />
                            <Line yAxisId="right" type="monotone" dataKey="utilidad" name="Utilidad Neta" stroke="#C9A55C" strokeWidth={2.5} dot={{ r: 3, fill: "#C9A55C" }} />
                            <ReferenceLine yAxisId="right" y={0} stroke="#9CA3AF" strokeDasharray="3 3" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </section>
                  </div>

                  {/* === Semáforo Financiero === */}
                  <Semaphore banners={semaforo} />

                  {/* === Ejecución presupuestal detallada (categorías con barras de progreso) === */}
                  <section className="napsa-card">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                      <h2 className="text-[15px] font-bold text-ink-900">Ejecución Presupuestal por Categoría · {rangoLabel}</h2>
                      {hasRange && (
                        <span className="text-[11px] text-ink-500">
                          Comparado contra meta proporcional ({nMeses} {nMeses > 1 ? "meses" : "mes"})
                        </span>
                      )}
                    </div>
                    <div className="space-y-2.5">
                      {ejecucionAjustada.map((e) => {
                        const meta = CAT_META[e.categoria] ?? CAT_META.Mantenimiento;
                        const Icon = meta.icon;
                        const pct = e.pct;
                        const sobreejecucion = pct > 1;
                        const widthEjecutado = Math.min(pct, 1) * 100;
                        const widthExtra = Math.max(pct - 1, 0) * 100;

                        return (
                          <div key={e.categoria} className="border border-ink-200 rounded-xl p-3 hover:bg-ink-50/40 transition-colors">
                            <div className="flex items-center gap-3 mb-2">
                              <IconBadge tone={meta.tone} size="sm"><Icon size={14} /></IconBadge>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-ink-900 text-[13px]">{e.categoria}</div>
                                <div className="text-[11px] text-ink-500">
                                  {hasRange
                                    ? <>Meta proporcional <span className="font-semibold">{fmtMoney(e.presupuestoBase)}</span> · Ejec. <span className="font-semibold">{fmtMoney(e.ejecutado)}</span> · Ppto anual {fmtMoney(e.pptoAnual)}</>
                                    : <>Ppto {fmtMoney(e.pptoAnual)} · Ejec. {fmtMoney(e.ejecutado)}</>}
                                </div>
                              </div>
                              <div className={`text-[15px] font-bold tabular-nums ${sobreejecucion ? "text-icon-red" : "text-ink-900"}`}>
                                {fmtPct(pct)}
                              </div>
                            </div>
                            <div className="relative h-2.5 bg-ink-100 rounded-full overflow-hidden">
                              <div className="absolute inset-y-0 left-0" style={{ width: `${widthEjecutado}%`, background: meta.color }} />
                              {sobreejecucion && (
                                <div className="absolute inset-y-0 right-0 bg-icon-red" style={{ width: `${Math.min(widthExtra, 30)}%` }} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
    </div>
  );
}

