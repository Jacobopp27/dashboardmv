import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Target, Wrench, ShieldCheck, Users, Leaf, Briefcase, Coins, Plus } from "lucide-react";
import { BarChart, Bar, Cell } from "recharts";
import { api, type EjecucionPpto, type ResultadoMes } from "@/lib/api";
import { fmtMesCorto, fmtMoney, fmtPct, fmtPeriodo } from "@/lib/format";

interface Props {
  resultados: ResultadoMes[];
  ejecucion: EjecucionPpto[];
  añosDisponibles: number[];
}

// ====== Paleta ejecutiva ======
const C = {
  navy:       "#0F2438",
  navyDark:   "#091A2C",
  navyLight:  "#1F3A52",
  gold:       "#C9A55C",
  ivory:      "#FAF7F0",
  green:      "#1E7A4F",
  red:        "#B43A3A",
  amber:      "#C97A1E",
  cardBorder: "#E5E1D6",
  textMute:   "#5A6470",
  text:       "#0F2438",
  ingreso:    "#1E5A8C",   // azul corporativo (línea de ingresos)
  gasto:      "#5A6470",   // gris para gastos
};

type SemTone = "green" | "amber" | "red";

/** Clasificación contable de gastos:
 *   Fijos: Seguridad + Administrativos + Ambiental (servicios públicos)
 *   Variables: Mantenimiento + Convivencia (eventos/asambleas/reparaciones puntuales)
 */
const RUBROS_FIJOS = ["egreso_seguridad", "egreso_administrativos", "egreso_ambiental"] as const;
const RUBROS_VARIABLES = ["egreso_mantenimiento", "egreso_convivencia"] as const;

export function EstadoResultadosView({ resultados, ejecucion: ejecucionProp, añosDisponibles }: Props) {
  // Año seleccionado (default: último disponible)
  const [añoElegido, setAñoElegido] = useState<string | null>(null);
  const añosOrdenados = useMemo(
    () => añosDisponibles.length > 0
      ? [...añosDisponibles].sort()
      : [...new Set(resultados.map(r => Number(r.periodo.split("-")[0])))].sort(),
    [añosDisponibles, resultados],
  );
  const añoFiltro = añoElegido ?? String(añosOrdenados[añosOrdenados.length - 1] ?? "");

  // Cargar el presupuesto del AÑO SELECCIONADO en este componente (no del global).
  // Cada año puede tener un presupuesto distinto; usar la prop del padre causa
  // que se mezclen presupuestos 2025/2026.
  const [ejecucionAño, setEjecucionAño] = useState<EjecucionPpto[]>([]);
  useEffect(() => {
    if (!añoFiltro) return;
    api.finEjecucionPpto(Number(añoFiltro))
      .then(setEjecucionAño)
      .catch(() => setEjecucionAño([]));
  }, [añoFiltro]);
  // Fallback: si aún no llegó la carga del año seleccionado, usar la del padre
  const ejecucion = ejecucionAño.length > 0 ? ejecucionAño : ejecucionProp;

  // Resultados del año filtrado, ordenados, solo meses con datos reales
  const resultadosAño = useMemo(
    () => resultados
      .filter(r => r.periodo.startsWith(añoFiltro) && r.egreso_total_egresos > 0)
      .sort((a, b) => a.periodo.localeCompare(b.periodo)),
    [resultados, añoFiltro],
  );
  // Mes de corte (el último mes con datos del año, o uno elegido)
  const [mesElegido, setMesElegido] = useState<string | null>(null);
  const periodoCorte = mesElegido && resultadosAño.some(r => r.periodo === mesElegido)
    ? mesElegido
    : resultadosAño[resultadosAño.length - 1]?.periodo ?? "";

  // Resetear mes elegido al cambiar año
  const handleAñoChange = (a: string) => {
    setAñoElegido(a);
    setMesElegido(null);
  };

  const resultadoCorte = resultadosAño.find(r => r.periodo === periodoCorte);

  // ====== Cálculos ======
  // Presupuesto mensual proporcional (1/12 del anual)
  const pptoAnual = ejecucion.reduce((s, e) => s + e.presupuesto_anual, 0);
  const pptoMensual = pptoAnual / 12;
  // Cuotas presupuestadas: usamos el ingreso operacional del primer mes con datos como proxy del "ingreso proyectado mensual"
  // (en una P.H. las cuotas no varían mes a mes)
  const ingresoProyMensual = resultadosAño[0]?.ingreso_operacional ?? 0;

  // Ingresos vs egresos del MES de corte
  const ingresoMes = resultadoCorte
    ? resultadoCorte.ingreso_operacional + resultadoCorte.ingreso_marginal
    : 0;
  const egresoMes = resultadoCorte?.egreso_total_egresos ?? 0;
  const margenMes = ingresoMes - egresoMes;

  // Gastos fijos vs variables del mes de corte
  const gastosFijosMes = resultadoCorte
    ? RUBROS_FIJOS.reduce((s, k) => s + ((resultadoCorte as Record<string, number | undefined>)[k] ?? 0), 0)
    : 0;
  const gastosVarsMes = resultadoCorte
    ? RUBROS_VARIABLES.reduce((s, k) => s + ((resultadoCorte as Record<string, number | undefined>)[k] ?? 0), 0)
    : 0;

  // Presupuesto del mes para gastos fijos / variables (proporcional al peso anual)
  const pptoFijos = useMemo(() => {
    const cats = ["Seguridad", "Administrativos", "Ambiental"];
    return ejecucion.filter(e => cats.includes(e.categoria)).reduce((s, e) => s + e.presupuesto_anual, 0) / 12;
  }, [ejecucion]);
  const pptoVars = useMemo(() => {
    const cats = ["Mantenimiento", "Convivencia"];
    return ejecucion.filter(e => cats.includes(e.categoria)).reduce((s, e) => s + e.presupuesto_anual, 0) / 12;
  }, [ejecucion]);

  // ====== KPI 1: Ingreso Total vs Proyectado (acumulado del año hasta corte) ======
  const ingresosAcum = useMemo(
    () => resultadosAño
      .filter(r => r.periodo <= periodoCorte)
      .reduce((s, r) => s + r.ingreso_operacional + r.ingreso_marginal, 0),
    [resultadosAño, periodoCorte],
  );
  const nMesesConDatos = resultadosAño.filter(r => r.periodo <= periodoCorte).length;
  const ingresosProyAcum = ingresoProyMensual * nMesesConDatos;
  const variacionIngresos = ingresosProyAcum > 0 ? (ingresosAcum - ingresosProyAcum) / ingresosProyAcum : 0;
  const semIngresos: SemTone = Math.abs(variacionIngresos) < 0.03 ? "green" :
    variacionIngresos >= 0 ? "green" : variacionIngresos > -0.05 ? "amber" : "red";

  // ====== KPI 2: Margen Operativo (acumulado del año hasta corte) ======
  const egresosAcum = useMemo(
    () => resultadosAño
      .filter(r => r.periodo <= periodoCorte)
      .reduce((s, r) => s + r.egreso_total_egresos, 0),
    [resultadosAño, periodoCorte],
  );
  const margenAcum = ingresosAcum - egresosAcum;
  const margenPctAcum = ingresosAcum > 0 ? margenAcum / ingresosAcum : 0;
  const semMargen: SemTone = margenAcum > 0 ? "green" : margenAcum > -1_000_000 ? "amber" : "red";

  // ====== KPI 3: Variación de Gastos (real acumulado vs proyectado acumulado) ======
  const proyectadoEgresoAcum = pptoMensual * nMesesConDatos;
  const variacionGastos = proyectadoEgresoAcum > 0
    ? (egresosAcum - proyectadoEgresoAcum) / proyectadoEgresoAcum
    : 0;
  const semGastos: SemTone = Math.abs(variacionGastos) < 0.05 ? "green" :
    variacionGastos < 0 ? "green" : variacionGastos < 0.10 ? "amber" : "red";

  // ====== Serie para gráfico de líneas con áreas ======
  const serieGrafico = useMemo(() => {
    return resultadosAño.map(r => {
      const ingreso = r.ingreso_operacional + r.ingreso_marginal;
      const gasto = r.egreso_total_egresos;
      return {
        mes: fmtMesCorto(r.periodo),
        periodo: r.periodo,
        Ingresos: ingreso,
        Gastos: gasto,
        // Para área verde (superávit): min(ingreso, gasto) → gasto; max → ingreso. Area = ingreso - gasto si ingreso>gasto.
        Superavit: ingreso > gasto ? ingreso : null,
        SuperavitBase: ingreso > gasto ? gasto : null,
        Deficit: ingreso < gasto ? gasto : null,
        DeficitBase: ingreso < gasto ? ingreso : null,
      };
    });
  }, [resultadosAño]);

  // ====== Proyección a fin de año (si se mantiene la tendencia) ======
  const proyeccionAnual = useMemo(() => {
    if (nMesesConDatos === 0) return null;
    const ingresoMensualPromedio = ingresosAcum / nMesesConDatos;
    const egresoMensualPromedio = egresosAcum / nMesesConDatos;
    const mesesRestantes = 12 - nMesesConDatos;
    const ingresoProyectado = ingresosAcum + ingresoMensualPromedio * mesesRestantes;
    const egresoProyectado = egresosAcum + egresoMensualPromedio * mesesRestantes;
    const resultadoProyectado = ingresoProyectado - egresoProyectado;
    const ingresoMeta = ingresoProyMensual * 12;
    const egresoMeta = pptoAnual;
    return { ingresoProyectado, egresoProyectado, resultadoProyectado, ingresoMeta, egresoMeta };
  }, [ingresosAcum, egresosAcum, nMesesConDatos, ingresoProyMensual, pptoAnual]);

  // ====== Drivers de Variación (texto explicativo automático) ======
  interface Driver { tipo: "alerta" | "info" | "positivo"; titulo: string; detalle: string }
  const drivers: Driver[] = useMemo(() => {
    const out: Driver[] = [];
    if (!resultadoCorte) return out;
    // Comparativo con mes anterior si existe
    const idx = resultadosAño.findIndex(r => r.periodo === periodoCorte);
    const mesPrevio = idx > 0 ? resultadosAño[idx - 1] : null;

    // Driver 1: ¿Gastos fijos sobreejecutados?
    if (pptoFijos > 0) {
      const v = (gastosFijosMes - pptoFijos) / pptoFijos;
      if (v > 0.10) {
        out.push({
          tipo: "alerta",
          titulo: `Gastos fijos por encima del presupuesto (${fmtPct(v, 1)})`,
          detalle: `Ejecutado en gastos fijos del mes (${fmtMoney(gastosFijosMes, { compact: true })}) supera la meta mensual de ${fmtMoney(pptoFijos, { compact: true })}. Revisar contratos de seguridad, administración y servicios públicos.`,
        });
      }
    }
    // Driver 2: ¿Gastos variables sobreejecutados?
    if (pptoVars > 0) {
      const v = (gastosVarsMes - pptoVars) / pptoVars;
      if (v > 0.15) {
        out.push({
          tipo: "alerta",
          titulo: `Gastos variables sobre meta (${fmtPct(v, 1)})`,
          detalle: `Mantenimiento y convivencia consumieron ${fmtMoney(gastosVarsMes, { compact: true })} este mes (meta: ${fmtMoney(pptoVars, { compact: true })}). Suele asociarse a reparaciones puntuales o eventos especiales.`,
        });
      }
    }
    // Driver 3: Tendencia mes a mes
    if (mesPrevio) {
      const cambioEgr = ((resultadoCorte.egreso_total_egresos - mesPrevio.egreso_total_egresos) / mesPrevio.egreso_total_egresos);
      if (Math.abs(cambioEgr) > 0.10) {
        out.push({
          tipo: cambioEgr > 0 ? "alerta" : "positivo",
          titulo: `Egresos ${cambioEgr > 0 ? "aumentaron" : "disminuyeron"} ${fmtPct(Math.abs(cambioEgr), 1)} vs ${fmtPeriodo(mesPrevio.periodo)}`,
          detalle: `Cierre del mes anterior: ${fmtMoney(mesPrevio.egreso_total_egresos, { compact: true })}. Cierre actual: ${fmtMoney(resultadoCorte.egreso_total_egresos, { compact: true })}.`,
        });
      }
    }
    // Driver 4: Resultado mensual
    if (margenMes < 0) {
      out.push({
        tipo: "alerta",
        titulo: "Déficit operativo en el mes",
        detalle: `Los gastos superaron los ingresos en ${fmtMoney(Math.abs(margenMes), { compact: true })}. Se cubre con el superávit acumulado de meses anteriores.`,
      });
    } else if (margenMes > 0 && variacionGastos < 0) {
      out.push({
        tipo: "positivo",
        titulo: "Ahorro frente al presupuesto",
        detalle: `Ejecución por debajo de la meta proyectada (${fmtPct(Math.abs(variacionGastos), 1)}), generando un superávit de ${fmtMoney(margenMes, { compact: true })} este mes.`,
      });
    }
    // Driver 5: Cumplimiento de ingresos
    if (Math.abs(variacionIngresos) > 0.03) {
      out.push({
        tipo: variacionIngresos < 0 ? "alerta" : "info",
        titulo: `Ingresos ${variacionIngresos < 0 ? "por debajo" : "sobre"} de la cuota proyectada (${fmtPct(variacionIngresos, 1)})`,
        detalle: variacionIngresos < 0
          ? "Aumento temporal en la morosidad. Gestión jurídica y acuerdos de pago en curso."
          : "Recaudo extra por intereses de mora y descuentos, complementa el ingreso operacional regular.",
      });
    }
    return out;
  }, [resultadoCorte, mesElegido, resultadosAño, pptoFijos, pptoVars, gastosFijosMes, gastosVarsMes, margenMes, variacionGastos, variacionIngresos, periodoCorte]);

  // ====== Render ======
  if (resultadosAño.length === 0) {
    return (
      <section className="bg-white rounded-2xl p-6 border" style={{ borderColor: C.cardBorder, fontFamily: "Segoe UI, system-ui, sans-serif" }}>
        <h2 className="text-[18px] font-bold mb-2" style={{ color: C.navyDark }}>Estado de Resultados</h2>
        <p className="text-[13px]" style={{ color: C.textMute }}>
          No hay datos de resultados disponibles para el año seleccionado.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-5" style={{ fontFamily: "Segoe UI, system-ui, sans-serif" }}>
      {/* ====== HEADER ====== */}
      <header className="rounded-2xl p-5 lg:p-6 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${C.navyDark} 0%, ${C.navy} 100%)` }}>
        <div className="absolute top-0 right-0 w-48 h-48 opacity-10 rounded-full" style={{ background: C.gold, filter: "blur(50px)", transform: "translate(30%, -30%)" }} />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-5 rounded-sm" style={{ background: C.gold }} />
              <span className="text-[10.5px] uppercase tracking-[0.2em] font-semibold" style={{ color: C.gold }}>Reporte ejecutivo</span>
            </div>
            <h1 className="text-[24px] sm:text-[28px] font-bold text-white leading-tight tracking-tight">
              Estado de Resultados
            </h1>
            <p className="text-[12.5px] mt-1" style={{ color: "#D4D4D8" }}>
              Resumen ejecutivo · Mes de corte: <span className="font-semibold text-white">{periodoCorte && fmtPeriodo(periodoCorte)}</span>
            </p>
          </div>

          {/* Selectores Año + Mes */}
          <div className="flex items-stretch gap-2 flex-wrap">
            <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.10)", border: `1px solid rgba(201,165,92,0.35)` }}>
              <label className="block text-[9px] uppercase tracking-[0.18em] font-bold mb-1" style={{ color: C.gold }}>
                Año fiscal
              </label>
              <select
                value={añoFiltro}
                onChange={(e) => handleAñoChange(e.target.value)}
                className="bg-transparent text-[14px] font-bold text-white focus:outline-none cursor-pointer pr-1"
                style={{ minWidth: 70 }}
              >
                {añosOrdenados.map(a => (
                  <option key={a} value={a} className="bg-white" style={{ color: C.navyDark }}>{a}</option>
                ))}
              </select>
            </div>
            <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.10)", border: `1px solid rgba(201,165,92,0.35)` }}>
              <label className="block text-[9px] uppercase tracking-[0.18em] font-bold mb-1" style={{ color: C.gold }}>
                Mes de corte
              </label>
              <select
                value={periodoCorte}
                onChange={(e) => setMesElegido(e.target.value)}
                className="bg-transparent text-[14px] font-bold text-white focus:outline-none cursor-pointer pr-1"
                style={{ minWidth: 130 }}
              >
                {resultadosAño.map(r => (
                  <option key={r.periodo} value={r.periodo} className="bg-white" style={{ color: C.navyDark }}>{fmtPeriodo(r.periodo)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* ====== RESUMEN EJECUTIVO (narrativa para el Consejo) ====== */}
      <ResumenEjecutivo
        periodoCorte={periodoCorte}
        nMesesConDatos={nMesesConDatos}
        ingresosAcum={ingresosAcum}
        egresosAcum={egresosAcum}
        margenAcum={margenAcum}
        margenPctAcum={margenPctAcum}
        ingresoMes={ingresoMes}
        egresoMes={egresoMes}
        margenMes={margenMes}
        variacionIngresos={variacionIngresos}
        variacionGastos={variacionGastos}
        gastosFijosMes={gastosFijosMes}
        pptoFijos={pptoFijos}
        proyeccionAnual={proyeccionAnual}
        resultadosAño={resultadosAño}
      />

      {/* ====== 1. RESUMEN DE DESEMPEÑO (3 KPI cards) ====== */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-sm" style={{ background: C.gold }} />
          <h2 className="text-[14px] font-bold uppercase tracking-wider" style={{ color: C.navyDark }}>Resumen de desempeño</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            titulo="Ingreso Total vs Proyectado"
            valor={fmtMoney(ingresosAcum, { compact: true })}
            sub={`Proyectado: ${fmtMoney(ingresosProyAcum, { compact: true })}`}
            variacion={variacionIngresos}
            sem={semIngresos}
            icon={<TrendingUp size={16} />}
          />
          <KpiCard
            titulo="Margen Operativo"
            valor={fmtMoney(margenAcum, { compact: true })}
            sub={`Ingresos − Egresos (${nMesesConDatos} ${nMesesConDatos === 1 ? "mes" : "meses"})`}
            variacion={margenPctAcum}
            variacionLabel="Margen sobre ingresos"
            sem={semMargen}
            icon={margenAcum >= 0 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          />
          <KpiCard
            titulo="Variación de Gastos"
            valor={fmtPct(variacionGastos, 1)}
            sub={`Ejec: ${fmtMoney(egresosAcum, { compact: true })} · Meta: ${fmtMoney(proyectadoEgresoAcum, { compact: true })}`}
            variacion={variacionGastos}
            variacionLabel={variacionGastos > 0 ? "Sobreejecución" : "Ahorro"}
            sem={semGastos}
            icon={<Target size={16} />}
            invertido
          />
        </div>
      </section>

      {/* ====== 2. GRÁFICO DE TENDENCIAS (líneas con sombra superávit/déficit) ====== */}
      <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-sm" style={{ background: C.gold }} />
            <h2 className="text-[14px] font-bold uppercase tracking-wider" style={{ color: C.navyDark }}>Tendencia · Ingresos vs Gastos {añoFiltro}</h2>
          </div>
          <div className="flex items-center gap-3 text-[11px]" style={{ color: C.textMute }}>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2 rounded" style={{ background: "rgba(30,122,79,0.30)" }} />Superávit</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2 rounded" style={{ background: "rgba(180,58,58,0.30)" }} />Déficit</span>
          </div>
        </div>
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={serieGrafico} margin={{ top: 20, right: 18, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="gradSuperavit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.green} stopOpacity={0.30} />
                  <stop offset="100%" stopColor={C.green} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gradDeficit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.red} stopOpacity={0.05} />
                  <stop offset="100%" stopColor={C.red} stopOpacity={0.30} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: C.text, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => fmtMoney(v, { compact: true })} tick={{ fontSize: 10, fill: C.textMute }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number, name: string) => v !== null && v !== undefined ? [fmtMoney(v), name] : ["—", name]}
                labelFormatter={(_l, payload) => payload?.[0]?.payload?.periodo ? fmtPeriodo(payload[0].payload.periodo) : ""}
                contentStyle={{ borderRadius: 8, border: `1px solid ${C.cardBorder}`, fontSize: 12, fontFamily: "Segoe UI" }}
              />
              <Legend iconType="line" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />

              {/* Áreas: superávit en verde, déficit en rojo */}
              <Area type="monotone" dataKey="Superavit"    stackId="sup" fill="url(#gradSuperavit)" stroke="none" name="" legendType="none" connectNulls={false} />
              <Area type="monotone" dataKey="SuperavitBase" stackId="sup" fill="white"               stroke="none" name="" legendType="none" connectNulls={false} />
              <Area type="monotone" dataKey="Deficit"      stackId="def" fill="url(#gradDeficit)"   stroke="none" name="" legendType="none" connectNulls={false} />
              <Area type="monotone" dataKey="DeficitBase"  stackId="def" fill="white"               stroke="none" name="" legendType="none" connectNulls={false} />

              <Line type="monotone" dataKey="Ingresos" stroke={C.ingreso} strokeWidth={3} dot={{ r: 4, fill: C.ingreso, stroke: "white", strokeWidth: 1.5 }} />
              <Line type="monotone" dataKey="Gastos"   stroke={C.gasto}   strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3.5, fill: C.gasto }} />

              {periodoCorte && (
                <ReferenceLine x={fmtMesCorto(periodoCorte)} stroke={C.gold} strokeWidth={1.5} strokeDasharray="3 3" label={{ value: "Corte", position: "top", fontSize: 10, fill: C.gold, fontWeight: 700 }} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ====== 3. TABLA RESUMEN EJECUTIVO ====== */}
      <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-sm" style={{ background: C.gold }} />
          <h2 className="text-[14px] font-bold uppercase tracking-wider" style={{ color: C.navyDark }}>
            Estado de Resultados · {periodoCorte && fmtPeriodo(periodoCorte)}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]" style={{ color: C.text }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.navy}` }}>
                <th className="px-3 py-2.5 text-left font-bold uppercase text-[10.5px] tracking-wider" style={{ color: C.navy }}>Categoría</th>
                <th className="px-3 py-2.5 text-right font-bold uppercase text-[10.5px] tracking-wider" style={{ color: C.navy }}>Ejecutado mes</th>
                <th className="px-3 py-2.5 text-right font-bold uppercase text-[10.5px] tracking-wider" style={{ color: C.navy }}>Presupuesto mes</th>
                <th className="px-3 py-2.5 text-right font-bold uppercase text-[10.5px] tracking-wider" style={{ color: C.navy }}>Variación</th>
              </tr>
            </thead>
            <tbody>
              <FilaTabla
                label="(+) Total Ingresos"
                ejecutado={ingresoMes}
                presupuesto={ingresoProyMensual}
                color={C.green}
                higherIsBetter={true}
              />
              <FilaTabla
                label="(−) Gastos Fijos"
                ejecutado={gastosFijosMes}
                presupuesto={pptoFijos}
                color={C.gasto}
                higherIsBetter={false}
                indent
              />
              <FilaTabla
                label="(−) Gastos Variables"
                ejecutado={gastosVarsMes}
                presupuesto={pptoVars}
                color={C.gasto}
                higherIsBetter={false}
                indent
              />
              <FilaTabla
                label="(−) Total Egresos"
                ejecutado={egresoMes}
                presupuesto={pptoMensual}
                color={C.gasto}
                higherIsBetter={false}
              />
              <FilaTotal
                label="(=) Resultado Operativo"
                ejecutado={margenMes}
                presupuesto={ingresoProyMensual - pptoMensual}
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* ====== 4. DRIVERS DE VARIACIÓN ====== */}
      <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-sm" style={{ background: C.gold }} />
          <h2 className="text-[14px] font-bold uppercase tracking-wider" style={{ color: C.navyDark }}>Drivers de variación · Causa raíz</h2>
        </div>
        {drivers.length === 0 ? (
          <p className="text-[12.5px] py-2" style={{ color: C.textMute }}>
            Sin desviaciones materiales detectadas. El comportamiento del mes está alineado con el plan presupuestal.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {drivers.map((d, i) => {
              const color = d.tipo === "alerta" ? C.red : d.tipo === "positivo" ? C.green : C.amber;
              const Icon = d.tipo === "alerta" ? AlertTriangle : d.tipo === "positivo" ? CheckCircle2 : Target;
              return (
                <li key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: C.ivory, borderLeft: `4px solid ${color}` }}>
                  <div className="w-7 h-7 rounded-md flex items-center justify-center text-white shrink-0" style={{ background: color }}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[12.5px] leading-tight" style={{ color: C.navyDark }}>{d.titulo}</div>
                    <div className="text-[11.5px] mt-1 leading-snug" style={{ color: C.textMute }}>{d.detalle}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ====== DETALLE POR CATEGORÍA (con rango de meses acumulado) ====== */}
      <DetalleCategorias
        resultadosAño={resultadosAño}
        ejecucion={ejecucion}
        año={añoFiltro}
      />

      {/* ====== 5. PROYECCIÓN A FIN DE AÑO ====== */}
      {proyeccionAnual && (
        <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 rounded-sm" style={{ background: C.gold }} />
            <h2 className="text-[14px] font-bold uppercase tracking-wider" style={{ color: C.navyDark }}>Proyección a diciembre {añoFiltro}</h2>
            <span className="text-[10.5px] ml-1 px-2 py-0.5 rounded" style={{ background: C.ivory, color: C.textMute, border: `1px solid ${C.cardBorder}` }}>
              si se mantiene la tendencia actual
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]" style={{ color: C.text }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.navy}` }}>
                  <th className="px-3 py-2.5 text-left font-bold uppercase text-[10.5px] tracking-wider" style={{ color: C.navy }}>Indicador</th>
                  <th className="px-3 py-2.5 text-right font-bold uppercase text-[10.5px] tracking-wider" style={{ color: C.navy }}>Proyectado fin de año</th>
                  <th className="px-3 py-2.5 text-right font-bold uppercase text-[10.5px] tracking-wider" style={{ color: C.navy }}>Meta anual</th>
                  <th className="px-3 py-2.5 text-right font-bold uppercase text-[10.5px] tracking-wider" style={{ color: C.navy }}>Brecha</th>
                </tr>
              </thead>
              <tbody>
                <FilaProyeccion
                  label="Ingresos del año"
                  proyectado={proyeccionAnual.ingresoProyectado}
                  meta={proyeccionAnual.ingresoMeta}
                  higherIsBetter={true}
                />
                <FilaProyeccion
                  label="Egresos del año"
                  proyectado={proyeccionAnual.egresoProyectado}
                  meta={proyeccionAnual.egresoMeta}
                  higherIsBetter={false}
                />
                <FilaProyeccionTotal
                  label="Resultado del año"
                  proyectado={proyeccionAnual.resultadoProyectado}
                  meta={proyeccionAnual.ingresoMeta - proyeccionAnual.egresoMeta}
                />
              </tbody>
            </table>
          </div>
          <p className="text-[10.5px] mt-3" style={{ color: C.textMute, fontStyle: "italic" }}>
            * Proyección lineal con base en el promedio mensual ingresos/egresos de los {nMesesConDatos} {nMesesConDatos === 1 ? "mes" : "meses"} con datos.
            No incluye estacionalidad ni eventos extraordinarios.
          </p>
        </section>
      )}
    </div>
  );
}

/* ============ Subcomponentes ============ */

interface CategoriaDef {
  key: keyof ResultadoMes;
  label: string;
  presupuestoLabel?: string;  // nombre exacto en la API de ejecución
  icon: React.ReactNode;
  color: string;
  tipo: "ingreso" | "gasto";
}

const CATEGORIAS_INGRESO: CategoriaDef[] = [
  { key: "ingreso_operacional", label: "Cuotas de administración", icon: <Coins size={14} />,  color: "#1E5A8C", tipo: "ingreso" },
  { key: "ingreso_marginal",    label: "Ingresos marginales",       icon: <Plus size={14} />,    color: "#2E6B8C", tipo: "ingreso" },
];
const CATEGORIAS_GASTO: CategoriaDef[] = [
  { key: "egreso_seguridad",       label: "Seguridad",       presupuestoLabel: "Seguridad",       icon: <ShieldCheck size={14} />, color: "#B43A3A", tipo: "gasto" },
  { key: "egreso_mantenimiento",   label: "Mantenimiento",   presupuestoLabel: "Mantenimiento",   icon: <Wrench size={14} />,      color: "#C97A1E", tipo: "gasto" },
  { key: "egreso_administrativos", label: "Administrativos", presupuestoLabel: "Administrativos", icon: <Briefcase size={14} />,   color: "#1F3A52", tipo: "gasto" },
  { key: "egreso_ambiental",       label: "Ambiental",       presupuestoLabel: "Ambiental",       icon: <Leaf size={14} />,        color: "#1E7A4F", tipo: "gasto" },
  { key: "egreso_convivencia",     label: "Convivencia",     presupuestoLabel: "Convivencia",     icon: <Users size={14} />,       color: "#7A5A1E", tipo: "gasto" },
];

function DetalleCategorias({ resultadosAño, ejecucion, año }: { resultadosAño: ResultadoMes[]; ejecucion: EjecucionPpto[]; año: string }) {
  // Meses con datos en el año
  const mesesAño = resultadosAño.map(r => r.month);
  const minMes = mesesAño[0] ?? 1;
  const maxMes = mesesAño[mesesAño.length - 1] ?? 12;

  // Estado: rango de meses para acumular (default = todo el año cargado)
  const [mesDesde, setMesDesde] = useState<number>(minMes);
  const [mesHasta, setMesHasta] = useState<number>(maxMes);

  // Si el año cambia, resetear el rango a los meses disponibles
  // (esto se ejecuta cuando minMes/maxMes cambian)
  const desdeReal = Math.max(mesDesde, minMes);
  const hastaReal = Math.min(mesHasta, maxMes);

  // Resultados dentro del rango
  const resultadosRango = useMemo(
    () => resultadosAño.filter(r => r.month >= desdeReal && r.month <= hastaReal),
    [resultadosAño, desdeReal, hastaReal],
  );
  const nMesesRango = resultadosRango.length;

  const MES_LABEL = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const rangoLabel = nMesesRango === 1
    ? `${MES_LABEL[desdeReal]} ${año}`
    : `${MES_LABEL[desdeReal]} – ${MES_LABEL[hastaReal]} ${año}`;

  if (resultadosAño.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder, fontFamily: "Segoe UI, system-ui, sans-serif" }}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-sm" style={{ background: C.gold }} />
          <h2 className="text-[14px] font-bold uppercase tracking-wider" style={{ color: C.navyDark }}>
            Detalle por categoría · {rangoLabel}
          </h2>
          <span className="text-[10.5px] ml-1 px-2 py-0.5 rounded" style={{ background: C.ivory, color: C.textMute, border: `1px solid ${C.cardBorder}` }}>
            Acumulado de {nMesesRango} {nMesesRango === 1 ? "mes" : "meses"}
          </span>
        </div>

        {/* Selector de rango de meses (Desde / Hasta) */}
        <div className="flex items-stretch gap-2 flex-wrap">
          <div className="rounded-lg px-2.5 py-1.5 border flex items-center gap-2" style={{ borderColor: C.cardBorder, background: C.ivory }}>
            <label className="text-[9.5px] uppercase tracking-wider font-bold" style={{ color: C.textMute }}>Desde</label>
            <select
              value={desdeReal}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setMesDesde(v);
                if (v > hastaReal) setMesHasta(v);
              }}
              className="bg-transparent text-[12.5px] font-bold focus:outline-none cursor-pointer"
              style={{ color: C.navyDark }}
            >
              {mesesAño.map(m => (
                <option key={m} value={m}>{MES_LABEL[m]}</option>
              ))}
            </select>
          </div>
          <div className="rounded-lg px-2.5 py-1.5 border flex items-center gap-2" style={{ borderColor: C.cardBorder, background: C.ivory }}>
            <label className="text-[9.5px] uppercase tracking-wider font-bold" style={{ color: C.textMute }}>Hasta</label>
            <select
              value={hastaReal}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setMesHasta(v);
                if (v < desdeReal) setMesDesde(v);
              }}
              className="bg-transparent text-[12.5px] font-bold focus:outline-none cursor-pointer"
              style={{ color: C.navyDark }}
            >
              {mesesAño.map(m => (
                <option key={m} value={m}>{MES_LABEL[m]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Sección Ingresos */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] uppercase tracking-wider font-bold" style={{ color: C.green }}>(+) Ingresos</span>
          <div className="flex-1 h-px" style={{ background: C.cardBorder }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CATEGORIAS_INGRESO.map(cat => (
            <TarjetaCategoria
              key={String(cat.key)}
              cat={cat}
              resultadosAño={resultadosAño}
              resultadosRango={resultadosRango}
              desdeReal={desdeReal}
              hastaReal={hastaReal}
              ejecucion={ejecucion}
              nMesesRango={nMesesRango}
            />
          ))}
        </div>
      </div>

      {/* Sección Gastos */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] uppercase tracking-wider font-bold" style={{ color: C.red }}>(−) Gastos por rubro</span>
          <div className="flex-1 h-px" style={{ background: C.cardBorder }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CATEGORIAS_GASTO.map(cat => (
            <TarjetaCategoria
              key={String(cat.key)}
              cat={cat}
              resultadosAño={resultadosAño}
              resultadosRango={resultadosRango}
              desdeReal={desdeReal}
              hastaReal={hastaReal}
              ejecucion={ejecucion}
              nMesesRango={nMesesRango}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

interface TarjetaCategoriaProps {
  cat: CategoriaDef;
  resultadosAño: ResultadoMes[];
  resultadosRango: ResultadoMes[];
  desdeReal: number;
  hastaReal: number;
  ejecucion: EjecucionPpto[];
  nMesesRango: number;
}

function TarjetaCategoria({ cat, resultadosAño, resultadosRango, desdeReal, hastaReal, ejecucion, nMesesRango }: TarjetaCategoriaProps) {
  const MES_LABEL = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  // Ejecutado acumulado en el rango
  const ejecutado = resultadosRango.reduce((s, r) => s + Number(r[cat.key] ?? 0), 0);

  // Presupuesto del rango (proporcional al rango de meses)
  let pptoAnual = 0;
  if (cat.tipo === "ingreso") {
    // Para ingresos no hay presupuesto en el endpoint de ejecucion: usar el ingreso del primer mes × 12 como proxy
    const ingresoMensual = resultadosAño[0] ? Number(resultadosAño[0][cat.key] ?? 0) : 0;
    pptoAnual = ingresoMensual * 12;
  } else if (cat.presupuestoLabel) {
    const ppto = ejecucion.find(e => e.categoria === cat.presupuestoLabel);
    pptoAnual = ppto?.presupuesto_anual ?? 0;
  }
  const pptoRango = pptoAnual * (nMesesRango / 12);
  const variacion = pptoRango > 0 ? (ejecutado - pptoRango) / pptoRango : 0;
  const promedioMes = nMesesRango > 0 ? ejecutado / nMesesRango : 0;

  // Para el gráfico: serie completa del año, resaltando los meses del rango
  const datosGrafico = resultadosAño.map(r => ({
    mes: MES_LABEL[r.month],
    month: r.month,
    valor: Number(r[cat.key] ?? 0),
    enRango: r.month >= desdeReal && r.month <= hastaReal,
  }));

  // Semáforo: para ingresos higherIsBetter=true; para gastos higherIsBetter=false (sobreejecución es malo)
  let semColor: string;
  if (cat.tipo === "ingreso") {
    semColor = variacion >= -0.03 ? C.green : variacion >= -0.10 ? C.amber : C.red;
  } else {
    semColor = variacion <= 0.05 ? C.green : variacion <= 0.15 ? C.amber : C.red;
  }
  const semLabel = semColor === C.green ? "OK" : semColor === C.amber ? "Atención" : "Alerta";

  return (
    <div className="rounded-xl p-3 border" style={{ borderColor: C.cardBorder, background: "white" }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-white shrink-0" style={{ background: cat.color }}>
            {cat.icon}
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-bold leading-tight truncate" style={{ color: C.navyDark }}>{cat.label}</div>
            <div className="text-[9.5px] uppercase tracking-wider" style={{ color: C.textMute }}>
              {cat.tipo === "ingreso" ? "Ingreso" : "Gasto"}
            </div>
          </div>
        </div>
        <span className="text-[9.5px] uppercase font-bold px-1.5 py-0.5 rounded" style={{ background: `${semColor}1A`, color: semColor }}>{semLabel}</span>
      </div>

      {/* Cifras: Ejecutado acumulado / Presupuesto proyectado acumulado / Variación */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div>
          <div className="text-[9px] uppercase font-bold leading-tight" style={{ color: C.textMute }}>Ejecutado<br/>acumulado</div>
          <div className="text-[11.5px] font-bold tabular-nums mt-0.5 leading-tight" style={{ color: C.navyDark }}>{fmtMoney(ejecutado)}</div>
          <div className="text-[9px]" style={{ color: C.textMute }}>{nMesesRango} {nMesesRango === 1 ? "mes" : "meses"}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase font-bold leading-tight" style={{ color: C.textMute }}>Presupuesto<br/>proyectado</div>
          <div className="text-[11.5px] font-bold tabular-nums mt-0.5 leading-tight" style={{ color: C.text }}>{fmtMoney(pptoRango)}</div>
          <div className="text-[9px]" style={{ color: C.textMute }}>{nMesesRango}/12 del anual</div>
        </div>
        <div>
          <div className="text-[9px] uppercase font-bold leading-tight" style={{ color: C.textMute }}>Variación<br/>(Ejec − Proy)</div>
          <div className="text-[12.5px] font-bold tabular-nums mt-0.5" style={{ color: semColor }}>
            {variacion > 0 ? "+" : ""}{fmtPct(variacion, 1)}
          </div>
          <div className="text-[10px] tabular-nums leading-tight" style={{ color: semColor }}>
            {ejecutado - pptoRango >= 0 ? "+" : ""}{fmtMoney(ejecutado - pptoRango)}
          </div>
        </div>
      </div>

      {/* Barra de avance Ejecutado vs Presupuesto proyectado */}
      {pptoRango > 0 && (
        <div className="mb-2">
          <div className="h-2.5 rounded-full overflow-hidden relative" style={{ background: C.ivory, border: `1px solid ${C.cardBorder}` }}>
            <div
              className="h-full transition-all"
              style={{
                width: `${Math.min(100, (ejecutado / pptoRango) * 100)}%`,
                background: semColor,
              }}
            />
            {/* Línea de referencia al 100% */}
            <div className="absolute top-0 bottom-0 w-px" style={{ left: "100%", background: C.navyDark, opacity: 0.6 }} />
          </div>
          <div className="flex items-center justify-between text-[9.5px] mt-1" style={{ color: C.textMute }}>
            <span>Avance: <strong style={{ color: semColor }}>{fmtPct(ejecutado / pptoRango, 1)}</strong> del presupuesto proyectado</span>
            <span>Promedio/mes: <strong style={{ color: C.navyDark }}>{fmtMoney(promedioMes, { compact: true })}</strong></span>
          </div>
        </div>
      )}

      {/* Mini gráfico de barras mensual (resalta meses dentro del rango) */}
      <div className="h-[80px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datosGrafico} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="mes" tick={{ fontSize: 9, fill: C.textMute }} axisLine={false} tickLine={false} interval={0} />
            <YAxis hide />
            <Tooltip
              formatter={(v: number) => [fmtMoney(v, { compact: true }), cat.label]}
              contentStyle={{ borderRadius: 6, border: `1px solid ${C.cardBorder}`, fontSize: 11, padding: "4px 6px", fontFamily: "Segoe UI" }}
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
            />
            <Bar dataKey="valor" radius={[3, 3, 0, 0]}>
              {datosGrafico.map((d, i) => (
                <Cell key={i} fill={d.enRango ? cat.color : `${cat.color}55`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface ResumenEjecutivoProps {
  periodoCorte: string;
  nMesesConDatos: number;
  ingresosAcum: number;
  egresosAcum: number;
  margenAcum: number;
  margenPctAcum: number;
  ingresoMes: number;
  egresoMes: number;
  margenMes: number;
  variacionIngresos: number;
  variacionGastos: number;
  gastosFijosMes: number;
  pptoFijos: number;
  proyeccionAnual: { ingresoProyectado: number; egresoProyectado: number; resultadoProyectado: number; ingresoMeta: number; egresoMeta: number } | null;
  resultadosAño: ResultadoMes[];
}

function ResumenEjecutivo({
  periodoCorte, nMesesConDatos, ingresosAcum, egresosAcum, margenAcum, margenPctAcum,
  ingresoMes, egresoMes, margenMes, variacionIngresos, variacionGastos,
  gastosFijosMes, pptoFijos, proyeccionAnual, resultadosAño,
}: ResumenEjecutivoProps) {
  if (!periodoCorte || nMesesConDatos === 0) return null;

  // Tendencia mes a mes (último vs anterior)
  const idx = resultadosAño.findIndex(r => r.periodo === periodoCorte);
  const mesPrevio = idx > 0 ? resultadosAño[idx - 1] : null;
  const tendenciaResultado = mesPrevio
    ? margenMes - (mesPrevio.ingreso_operacional + mesPrevio.ingreso_marginal - mesPrevio.egreso_total_egresos)
    : null;

  // Conclusión global
  const conclusion = margenAcum > 0 && Math.abs(variacionGastos) < 0.10
    ? { tipo: "positivo", texto: "Las finanzas se encuentran alineadas con el plan presupuestal." }
    : margenAcum > 0
      ? { tipo: "amber", texto: "Resultado acumulado positivo, pero con desviación en la ejecución de gastos." }
      : { tipo: "rojo", texto: "Déficit operativo acumulado. Se requiere acción correctiva." };
  const conclusionColor = conclusion.tipo === "positivo" ? C.green : conclusion.tipo === "amber" ? C.amber : C.red;

  // Highlight de los gastos fijos
  const sobreFijos = pptoFijos > 0 ? (gastosFijosMes - pptoFijos) / pptoFijos : 0;

  return (
    <section className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: C.cardBorder, borderLeft: `6px solid ${C.gold}` }}>
      <div className="p-5 lg:p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-sm" style={{ background: C.gold }} />
          <h2 className="text-[14px] font-bold uppercase tracking-wider" style={{ color: C.navyDark }}>Resumen ejecutivo</h2>
          <span className="text-[10.5px] ml-1 px-2 py-0.5 rounded" style={{ background: C.ivory, color: C.textMute, border: `1px solid ${C.cardBorder}` }}>
            Para el Consejo
          </span>
        </div>

        {/* Bloque narrativo */}
        <div className="space-y-3 text-[13px] leading-relaxed" style={{ color: C.text }}>
          {/* Párrafo 1: resultado acumulado */}
          <p>
            Al cierre de <strong style={{ color: C.navyDark }}>{fmtPeriodo(periodoCorte)}</strong>, la copropiedad acumula{" "}
            {margenAcum >= 0
              ? <>un <strong style={{ color: C.green }}>superávit operativo de {fmtMoney(margenAcum, { compact: true })}</strong></>
              : <>un <strong style={{ color: C.red }}>déficit operativo de {fmtMoney(Math.abs(margenAcum), { compact: true })}</strong></>}
            {" "}durante los {nMesesConDatos} {nMesesConDatos === 1 ? "mes transcurrido" : "meses transcurridos"} del año
            ({fmtMoney(ingresosAcum, { compact: true })} en ingresos y {fmtMoney(egresosAcum, { compact: true })} en egresos),
            equivalente a un <strong style={{ color: margenPctAcum >= 0 ? C.green : C.red }}>margen del {fmtPct(margenPctAcum, 1)}</strong> sobre los ingresos.
          </p>

          {/* Párrafo 2: comportamiento del mes */}
          <p>
            En el mes de corte se facturaron <strong>{fmtMoney(ingresoMes, { compact: true })}</strong> en ingresos
            y se ejecutaron <strong>{fmtMoney(egresoMes, { compact: true })}</strong> en egresos, dejando{" "}
            {margenMes >= 0
              ? <>un <strong style={{ color: C.green }}>excedente de {fmtMoney(margenMes, { compact: true })}</strong></>
              : <>un <strong style={{ color: C.red }}>faltante de {fmtMoney(Math.abs(margenMes), { compact: true })}</strong></>}.
            {tendenciaResultado !== null && Math.abs(tendenciaResultado) > 500_000 && (
              <> El resultado del mes {tendenciaResultado > 0 ? "mejoró" : "se deterioró"} en{" "}
                <strong style={{ color: tendenciaResultado > 0 ? C.green : C.red }}>{fmtMoney(Math.abs(tendenciaResultado), { compact: true })}</strong>{" "}
                respecto a {fmtPeriodo(mesPrevio!.periodo)}.</>
            )}
          </p>

          {/* Párrafo 3: ingresos vs gastos */}
          <p>
            <strong>Ingresos:</strong>{" "}
            {Math.abs(variacionIngresos) < 0.03
              ? <>el recaudo se mantiene <strong style={{ color: C.green }}>en línea con la cuota proyectada</strong>.</>
              : variacionIngresos > 0
                ? <>el recaudo está <strong style={{ color: C.green }}>{fmtPct(variacionIngresos, 1)} por encima</strong> de la cuota proyectada (intereses de mora y descuentos contribuyen al excedente).</>
                : <>el recaudo está <strong style={{ color: C.red }}>{fmtPct(Math.abs(variacionIngresos), 1)} por debajo</strong> de la cuota proyectada (asociado a la morosidad).</>}
            {" "}
            <strong>Gastos:</strong>{" "}
            {Math.abs(variacionGastos) < 0.05
              ? <>la ejecución va <strong style={{ color: C.green }}>alineada con el presupuesto</strong>.</>
              : variacionGastos < 0
                ? <>se reporta un <strong style={{ color: C.green }}>ahorro del {fmtPct(Math.abs(variacionGastos), 1)}</strong> frente a la meta proyectada.</>
                : <>se presenta una <strong style={{ color: C.red }}>sobreejecución del {fmtPct(variacionGastos, 1)}</strong>{sobreFijos > 0.10 && <> impulsada principalmente por gastos fijos (seguridad, administración y servicios públicos)</>}.</>}
          </p>

          {/* Párrafo 4: proyección */}
          {proyeccionAnual && (
            <p>
              <strong>Proyección a diciembre:</strong> si se mantiene la tendencia actual, el año cerraría con{" "}
              <strong style={{ color: proyeccionAnual.resultadoProyectado >= 0 ? C.green : C.red }}>
                {proyeccionAnual.resultadoProyectado >= 0 ? "un superávit anual de " : "un déficit anual de "}
                {fmtMoney(Math.abs(proyeccionAnual.resultadoProyectado), { compact: true })}
              </strong>
              {" "}({fmtMoney(proyeccionAnual.ingresoProyectado, { compact: true })} en ingresos contra {fmtMoney(proyeccionAnual.egresoProyectado, { compact: true })} en egresos),
              {" "}
              {proyeccionAnual.egresoProyectado > proyeccionAnual.egresoMeta
                ? <>excediendo el presupuesto anual aprobado en {fmtMoney(proyeccionAnual.egresoProyectado - proyeccionAnual.egresoMeta, { compact: true })}.</>
                : <>manteniéndose dentro del presupuesto anual aprobado.</>}
            </p>
          )}
        </div>

        {/* Conclusión / recomendación al Consejo */}
        <div className="mt-4 p-3 rounded-lg flex items-start gap-3" style={{ background: `${conclusionColor}0F`, borderLeft: `3px solid ${conclusionColor}` }}>
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-white shrink-0" style={{ background: conclusionColor }}>
            {conclusion.tipo === "positivo" ? <CheckCircle2 size={14} /> : conclusion.tipo === "amber" ? <Target size={14} /> : <AlertTriangle size={14} />}
          </div>
          <div className="flex-1">
            <div className="text-[10.5px] uppercase tracking-wider font-bold" style={{ color: conclusionColor }}>Lectura para el Consejo</div>
            <div className="text-[13px] font-semibold mt-0.5" style={{ color: C.navyDark }}>{conclusion.texto}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface KpiCardProps {
  titulo: string;
  valor: string;
  sub: string;
  variacion: number;
  variacionLabel?: string;
  sem: SemTone;
  icon: React.ReactNode;
  invertido?: boolean;
}

function KpiCard({ titulo, valor, sub, variacion, variacionLabel, sem, icon, invertido }: KpiCardProps) {
  const colorSem = sem === "green" ? C.green : sem === "amber" ? C.amber : C.red;
  const Estado = sem === "green" ? "Óptimo" : sem === "amber" ? "Atención" : "Crítico";
  const arrow = variacion > 0
    ? <ArrowUpRight size={12} style={{ color: invertido ? C.red : C.green }} />
    : variacion < 0
      ? <ArrowDownRight size={12} style={{ color: invertido ? C.green : C.red }} />
      : null;
  return (
    <div className="bg-white rounded-2xl p-4 border relative overflow-hidden" style={{ borderColor: C.cardBorder, fontFamily: "Segoe UI, system-ui, sans-serif" }}>
      <div className="absolute top-0 right-0 w-1.5 h-full" style={{ background: colorSem }} />
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-md flex items-center justify-center text-white" style={{ background: C.navy }}>{icon}</div>
        <span className="text-[9px] uppercase tracking-[0.15em] font-bold px-2 py-0.5 rounded-full" style={{ background: `${colorSem}1A`, color: colorSem }}>{Estado}</span>
      </div>
      <div className="text-[11px] uppercase tracking-wider font-bold mb-1" style={{ color: C.textMute }}>{titulo}</div>
      <div className="text-[22px] font-bold tabular-nums leading-tight" style={{ color: C.navyDark }}>{valor}</div>
      <div className="text-[11px] mt-1" style={{ color: C.textMute }}>{sub}</div>
      <div className="mt-2 flex items-center gap-1.5">
        {arrow}
        <span className="text-[11.5px] font-bold tabular-nums" style={{ color: arrow ? colorSem : C.textMute }}>
          {variacion > 0 ? "+" : ""}{fmtPct(variacion, 1)}
        </span>
        {variacionLabel && (
          <span className="text-[10.5px]" style={{ color: C.textMute }}>· {variacionLabel}</span>
        )}
      </div>
    </div>
  );
}

interface FilaTablaProps {
  label: string;
  ejecutado: number;
  presupuesto: number;
  color: string;
  higherIsBetter: boolean;
  indent?: boolean;
}

function FilaTabla({ label, ejecutado, presupuesto, color, higherIsBetter, indent }: FilaTablaProps) {
  const variacion = presupuesto > 0 ? (ejecutado - presupuesto) / presupuesto : 0;
  const ok = higherIsBetter ? variacion >= -0.05 : variacion <= 0.05;
  const semColor = Math.abs(variacion) < 0.03 ? C.green : ok ? C.green : Math.abs(variacion) < 0.10 ? C.amber : C.red;
  const bg = semColor === C.green ? "rgba(30,122,79,0.06)" : semColor === C.amber ? "rgba(201,122,30,0.06)" : "rgba(180,58,58,0.06)";
  return (
    <tr style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
      <td className={`px-3 py-2 font-semibold ${indent ? "pl-8" : ""}`} style={{ color }}>{label}</td>
      <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ color: C.navyDark }}>{fmtMoney(ejecutado)}</td>
      <td className="px-3 py-2 text-right tabular-nums" style={{ color: C.textMute }}>{fmtMoney(presupuesto)}</td>
      <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ background: bg, color: semColor }}>
        {variacion > 0 ? "+" : ""}{fmtPct(variacion, 1)}
      </td>
    </tr>
  );
}

function FilaTotal({ label, ejecutado, presupuesto }: { label: string; ejecutado: number; presupuesto: number }) {
  const variacion = presupuesto !== 0 ? (ejecutado - presupuesto) / Math.abs(presupuesto) : 0;
  const ok = ejecutado >= 0;
  const semColor = ok ? C.green : C.red;
  const bg = ok ? "rgba(30,122,79,0.10)" : "rgba(180,58,58,0.10)";
  return (
    <tr style={{ background: bg, borderTop: `3px solid ${C.navy}` }}>
      <td className="px-3 py-3 font-bold text-[14px]" style={{ color: C.navyDark }}>{label}</td>
      <td className="px-3 py-3 text-right tabular-nums font-bold text-[15px]" style={{ color: semColor }}>{fmtMoney(ejecutado)}</td>
      <td className="px-3 py-3 text-right tabular-nums" style={{ color: C.textMute }}>{fmtMoney(presupuesto)}</td>
      <td className="px-3 py-3 text-right tabular-nums font-bold" style={{ color: semColor }}>
        {variacion > 0 ? "+" : ""}{fmtPct(variacion, 1)}
      </td>
    </tr>
  );
}

function FilaProyeccion({ label, proyectado, meta, higherIsBetter }: { label: string; proyectado: number; meta: number; higherIsBetter: boolean }) {
  const brecha = proyectado - meta;
  const ok = higherIsBetter ? brecha >= 0 : brecha <= 0;
  const semColor = Math.abs(brecha / meta) < 0.03 ? C.green : ok ? C.green : Math.abs(brecha / meta) < 0.10 ? C.amber : C.red;
  const bg = semColor === C.green ? "rgba(30,122,79,0.06)" : semColor === C.amber ? "rgba(201,122,30,0.06)" : "rgba(180,58,58,0.06)";
  return (
    <tr style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
      <td className="px-3 py-2 font-semibold" style={{ color: C.text }}>{label}</td>
      <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ color: C.navyDark }}>{fmtMoney(proyectado, { compact: true })}</td>
      <td className="px-3 py-2 text-right tabular-nums" style={{ color: C.textMute }}>{fmtMoney(meta, { compact: true })}</td>
      <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ background: bg, color: semColor }}>
        {brecha > 0 ? "+" : ""}{fmtMoney(brecha, { compact: true })}
      </td>
    </tr>
  );
}

function FilaProyeccionTotal({ label, proyectado, meta }: { label: string; proyectado: number; meta: number }) {
  const semColor = proyectado >= 0 ? C.green : C.red;
  const bg = proyectado >= 0 ? "rgba(30,122,79,0.10)" : "rgba(180,58,58,0.10)";
  const brecha = proyectado - meta;
  return (
    <tr style={{ background: bg, borderTop: `3px solid ${C.navy}` }}>
      <td className="px-3 py-3 font-bold text-[14px]" style={{ color: C.navyDark }}>{label}</td>
      <td className="px-3 py-3 text-right tabular-nums font-bold text-[15px]" style={{ color: semColor }}>{fmtMoney(proyectado, { compact: true })}</td>
      <td className="px-3 py-3 text-right tabular-nums" style={{ color: C.textMute }}>{fmtMoney(meta, { compact: true })}</td>
      <td className="px-3 py-3 text-right tabular-nums font-bold" style={{ color: semColor }}>
        {brecha > 0 ? "+" : ""}{fmtMoney(brecha, { compact: true })}
      </td>
    </tr>
  );
}
