import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Droplets, Users2, Target, Scale, X, Plus, ArrowUpRight, ArrowDownRight, Minus, BarChart3, LineChart as LineIcon } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import type { AgingAnual, EjecucionPpto, IndicadoresFin, LiquidezMes, ResultadoMes, SaldoMes } from "@/lib/api";
import { fmtMesCorto, fmtMoney, fmtPct, fmtPeriodo } from "@/lib/format";

type Tone = "good" | "warn" | "bad" | "neutral";

interface KpiDef {
  key: string;
  label: string;
  hint?: string;
  formula?: string;
  format: "money" | "pct" | "ratio";
  thresholds: { good: number; warn: number; higherIsBetter: boolean };
  computeRaw: (periodo: string) => number | null;
}

interface Group {
  title: string;
  descripcion: string;
  icon: ReactNode;
  color: string;
  kpis: KpiDef[];
}

interface Props {
  saldos: SaldoMes[];
  liquidez: LiquidezMes[];
  resultados: ResultadoMes[];
  ejecucion: EjecucionPpto[];
  agingAnual?: AgingAnual | null;
  indicadoresActual?: IndicadoresFin | null;
}

// ====== Paleta ejecutiva (línea gráfica de Inicio) ======
const C = {
  navy:       "#1F3A52",
  navyDark:   "#0F2438",
  gold:       "#C9A55C",
  goldDark:   "#A88243",
  ivory:      "#F8F6F1",
  green:      "#2D7A4F",
  amber:      "#D4A036",
  red:        "#C73E3E",
  text:       "#0E2410",
  textMute:   "#5B6963",
  cardBorder: "#E8E1D2",
};

// Color identitario de cada grupo (armonizado con la paleta ejecutiva)
const COLOR_GROUPS = {
  liquidez:    "#2D7A4F",   // verde
  cartera:     "#1F3A52",   // navy
  presupuesto: "#C9A55C",   // gold
  solvencia:   "#6E5AA0",   // púrpura suave de marca
};

// Semáforo con los colores de Inicio
const SEM_COLORS = {
  good:    C.green,
  warn:    C.amber,
  bad:     C.red,
  neutral: C.textMute,
};

function toneOf(raw: number, t: KpiDef["thresholds"]): Tone {
  if (t.higherIsBetter) {
    if (raw >= t.good) return "good";
    if (raw >= t.warn) return "warn";
    return "bad";
  } else {
    if (raw <= t.good) return "good";
    if (raw <= t.warn) return "warn";
    return "bad";
  }
}

function formatValue(raw: number, fmt: KpiDef["format"]): string {
  if (fmt === "money") return fmtMoney(raw);
  if (fmt === "pct")   return fmtPct(raw);
  return raw.toFixed(2);
}

export function KPIsConsolidadoView({ saldos, liquidez, resultados, ejecucion, agingAnual }: Props) {
  const [vista, setVista] = useState<"comparativo" | "anual">("comparativo");

  // Meses con datos reales (excluye filas de relleno con todos los valores en 0)
  const mesesDisponibles = useMemo(() => {
    const set = new Set<string>();
    saldos.forEach(s => { if (s.disponible_total > 0) set.add(s.periodo); });
    liquidez.forEach(l => { if ((l.total_activo ?? l.activo_corriente) > 0) set.add(l.periodo); });
    resultados.forEach(r => {
      if (r.ingreso_operacional > 0 || r.egreso_total_egresos > 0) set.add(r.periodo);
    });
    return Array.from(set).sort();
  }, [saldos, liquidez, resultados]);

  const añosDisponibles = useMemo(
    () => Array.from(new Set(mesesDisponibles.map(p => p.split("-")[0]))).sort(),
    [mesesDisponibles],
  );

  const ultimo = mesesDisponibles[mesesDisponibles.length - 1] ?? "";
  // Año elegido por el usuario (puede ser null antes de la primera elección)
  const [añoElegido, setAñoElegido] = useState<string | null>(null);
  const añoFiltro = añoElegido ?? añosDisponibles[añosDisponibles.length - 1] ?? "";
  const setAñoFiltro = (a: string) => setAñoElegido(a);

  const mesesAñoFiltro = useMemo(
    () => mesesDisponibles.filter(p => p.startsWith(añoFiltro)),
    [mesesDisponibles, añoFiltro],
  );

  // Estado: meses elegidos manualmente. El derivado abajo aplica filtro de año + default.
  const [seleccionadosRaw, setSeleccionados] = useState<string[]>([]);
  const seleccionados = useMemo(() => {
    const filtrados = seleccionadosRaw.filter(p => p.startsWith(añoFiltro));
    if (filtrados.length > 0) return filtrados;
    const ultimoDelAño = mesesAñoFiltro[mesesAñoFiltro.length - 1];
    return ultimoDelAño ? [ultimoDelAño] : [];
  }, [seleccionadosRaw, añoFiltro, mesesAñoFiltro]);

  const toggleMes = (mes: string) => {
    setSeleccionados(rawPrev => {
      const otrosAños = rawPrev.filter(p => !p.startsWith(añoFiltro));
      const base = seleccionados;
      if (base.includes(mes)) {
        const nuevoDelAño = base.filter(p => p !== mes);
        return [...otrosAños, ...nuevoDelAño].sort();
      }
      if (base.length >= 3) return rawPrev;
      return [...otrosAños, ...base, mes].sort();
    });
  };

  const getSaldo = (p: string) => saldos.find(s => s.periodo === p);
  const getLiq   = (p: string) => liquidez.find(l => l.periodo === p);
  const getRes   = (p: string) => resultados.find(r => r.periodo === p);
  const getAging = (p: string) => agingAnual?.por_mes?.[p] ?? null;

  const pptoTotalAnual = ejecucion.reduce((s, e) => s + e.presupuesto_anual, 0);

  // Egreso promedio mensual del año (para cobertura fondo de reserva)
  const resultadosAño = resultados.filter(r => r.periodo.startsWith(añoFiltro));
  const egresoPromedioMensual = resultadosAño.length > 0
    ? resultadosAño.reduce((s, r) => s + r.egreso_total_egresos, 0) / resultadosAño.length
    : 0;

  // Helper: mes anterior (YYYY-MM)
  const mesAnterior = (p: string): string => {
    const [y, m] = p.split("-").map(Number);
    if (m === 1) return `${y - 1}-12`;
    return `${y}-${String(m - 1).padStart(2, "0")}`;
  };

  // ===== Definición de KPIs según fórmulas exactas =====
  const groups: Group[] = [
    {
      title: "KPIs Liquidez",
      descripcion: "Capacidad de cubrir obligaciones de corto plazo",
      icon: <Droplets size={18} />, color: COLOR_GROUPS.liquidez,
      kpis: [
        {
          key: "liq_razon_corriente",
          label: "Razón Corriente",
          hint: "Activo corriente / Pasivo corriente (≥ 1.5 saludable)",
          formula: "AC / PC",
          format: "ratio",
          thresholds: { good: 1.5, warn: 1.0, higherIsBetter: true },
          computeRaw: (p) => {
            const l = getLiq(p); if (!l || l.pasivo_corriente === 0) return null;
            return l.activo_corriente / l.pasivo_corriente;
          },
        },
      ],
    },
    {
      title: "KPIs Cartera",
      descripcion: "Morosidad y velocidad de recaudo de cuotas",
      icon: <Users2 size={18} />, color: COLOR_GROUPS.cartera,
      kpis: [
        {
          key: "car_morosidad",
          label: "Índice de Morosidad",
          hint: "Cartera vencida >60 días / Total cartera por cobrar",
          formula: "Cartera >60 d / Cartera total",
          format: "pct",
          thresholds: { good: 0.20, warn: 0.40, higherIsBetter: false },
          computeRaw: (p) => {
            const a = getAging(p); if (!a || a.total === 0) return null;
            return a.vencido_60 / a.total;
          },
        },
        {
          key: "car_ciclo_recaudo",
          label: "Ciclo de Recaudo",
          hint: "Cuentas por cobrar / Ingresos por cuotas × 100",
          formula: "CxC / Ingresos cuotas × 100",
          format: "pct",
          thresholds: { good: 0.30, warn: 0.60, higherIsBetter: false },
          computeRaw: (p) => {
            const l = getLiq(p); const r = getRes(p);
            if (!l || !r || r.ingreso_operacional === 0) return null;
            return l.copropietarios / r.ingreso_operacional;
          },
        },
      ],
    },
    {
      title: "KPIs Gestión Presupuestal",
      descripcion: "Ejecución del gasto frente al presupuesto aprobado",
      icon: <Target size={18} />, color: COLOR_GROUPS.presupuesto,
      kpis: [
        {
          key: "pre_ejecucion",
          label: "Ejecución Presupuestal",
          hint: "Gasto ejecutado / Presupuesto aprobado del mes × 100",
          formula: "Gasto ejecutado / Ppto mensual",
          format: "pct",
          thresholds: { good: 1.05, warn: 1.15, higherIsBetter: false },
          computeRaw: (p) => {
            const r = getRes(p); if (!r) return null;
            const pptoMensual = pptoTotalAnual / 12;
            if (pptoMensual === 0) return null;
            return r.egreso_total_egresos / pptoMensual;
          },
        },
        {
          key: "pre_variacion",
          label: "Variación Presupuestal",
          hint: "Ejecutado − Proyectado (negativo = ahorro)",
          formula: "Ejecutado − Proyectado",
          format: "money",
          thresholds: { good: 0, warn: 2_000_000, higherIsBetter: false },
          computeRaw: (p) => {
            const r = getRes(p); if (!r) return null;
            const pptoMensual = pptoTotalAnual / 12;
            return r.egreso_total_egresos - pptoMensual;
          },
        },
      ],
    },
    {
      title: "KPIs Solvencia",
      descripcion: "Respaldo patrimonial y fondos de reserva",
      icon: <Scale size={18} />, color: COLOR_GROUPS.solvencia,
      kpis: [
        {
          key: "sol_fondo",
          label: "Fondo de Reserva",
          hint: "Saldo en Fiducuenta Bancolombia",
          formula: "Saldo Fiducuenta",
          format: "money",
          thresholds: { good: 10_000_000, warn: 5_000_000, higherIsBetter: true },
          computeRaw: (p) => getSaldo(p)?.fiducia ?? null,
        },
        {
          key: "sol_cobertura_reserva",
          label: "Cobertura Fondo Reserva",
          hint: "Saldo Fondo / Egresos mensuales promedio (meses cubiertos)",
          formula: "Fondo Reserva / Egreso prom. mensual",
          format: "ratio",
          thresholds: { good: 0.5, warn: 0.25, higherIsBetter: true },
          computeRaw: (p) => {
            const s = getSaldo(p);
            if (!s || egresoPromedioMensual === 0) return null;
            return s.fiducia / egresoPromedioMensual;
          },
        },
        {
          key: "sol_capital_trabajo",
          label: "Capital de Trabajo Neto",
          hint: "Activo corriente / Pasivo corriente",
          formula: "AC / PC",
          format: "ratio",
          thresholds: { good: 1.5, warn: 1.0, higherIsBetter: true },
          computeRaw: (p) => {
            const l = getLiq(p); if (!l || l.pasivo_corriente === 0) return null;
            return l.activo_corriente / l.pasivo_corriente;
          },
        },
        {
          key: "sol_patrimonial",
          label: "Solvencia Patrimonial",
          hint: "Patrimonio total / Activos totales",
          formula: "Patrimonio / Activo",
          format: "pct",
          thresholds: { good: 0.30, warn: 0.10, higherIsBetter: true },
          computeRaw: (p) => {
            const l = getLiq(p);
            if (!l || !l.total_activo || l.total_activo === 0) return null;
            return (l.total_patrimonio ?? 0) / l.total_activo;
          },
        },
        {
          key: "sol_tendencia_cartera",
          label: "Tendencia de Cartera",
          hint: "CxC actual / CxC mes anterior (>1 = creciendo)",
          formula: "CxC actual / CxC mes anterior",
          format: "ratio",
          thresholds: { good: 1.0, warn: 1.10, higherIsBetter: false },
          computeRaw: (p) => {
            const l = getLiq(p);
            const lPrev = getLiq(mesAnterior(p));
            if (!l || !lPrev || lPrev.copropietarios === 0) return null;
            return l.copropietarios / lPrev.copropietarios;
          },
        },
      ],
    },
  ];

  if (seleccionados.length === 0 && vista === "comparativo") {
    return (
      <div
        className="bg-white rounded-2xl p-5 border text-[13px]"
        style={{ borderColor: C.cardBorder, color: C.textMute, fontFamily: "Segoe UI, system-ui, sans-serif" }}
      >
        Selecciona al menos un mes para ver los indicadores.
      </div>
    );
  }

  return (
    <div className="space-y-5" style={{ fontFamily: "Segoe UI, system-ui, sans-serif" }}>
      {/* Toggle de vista */}
      <section className="bg-white rounded-2xl p-4 lg:p-5 border" style={{ borderColor: C.cardBorder }}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div>
            <h2 className="text-[16px] font-bold" style={{ color: C.navyDark }}>
              {vista === "comparativo" ? "Comparativo entre meses" : "Comportamiento anual"}
            </h2>
            <p className="text-[11px] mt-0.5" style={{ color: C.textMute }}>
              {vista === "comparativo"
                ? "Toca un mes para añadirlo o quitarlo. Hasta 3 meses simultáneos."
                : "Evolución de cada KPI mes a mes a lo largo del año seleccionado."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg p-0.5 border" style={{ background: C.ivory, borderColor: C.cardBorder }}>
              <button
                onClick={() => setVista("comparativo")}
                className="px-3 py-1.5 rounded-md text-[12px] font-semibold flex items-center gap-1.5 transition-all"
                style={vista === "comparativo"
                  ? { background: "#fff", color: C.navyDark, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }
                  : { background: "transparent", color: C.textMute }}
              >
                <BarChart3 size={13} /> Comparativo
              </button>
              <button
                onClick={() => setVista("anual")}
                className="px-3 py-1.5 rounded-md text-[12px] font-semibold flex items-center gap-1.5 transition-all"
                style={vista === "anual"
                  ? { background: "#fff", color: C.navyDark, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }
                  : { background: "transparent", color: C.textMute }}
              >
                <LineIcon size={13} /> Comport. anual
              </button>
            </div>
            <div className="rounded-lg px-3 py-1.5 border" style={{ borderColor: C.cardBorder, background: "#fff" }}>
              <label className="block text-[9px] uppercase tracking-wider font-bold mb-0.5" style={{ color: C.textMute }}>Año</label>
              <select
                value={añoFiltro}
                onChange={(e) => setAñoFiltro(e.target.value)}
                className="bg-transparent text-[13px] font-bold focus:outline-none cursor-pointer"
                style={{ color: C.navyDark }}
              >
                {añosDisponibles.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
        </div>

        {vista === "comparativo" && (
          <>
            <div className="flex flex-wrap gap-2">
              {mesesAñoFiltro.map((p) => {
                const activo = seleccionados.includes(p);
                const disabled = !activo && seleccionados.length >= 3;
                return (
                  <button
                    key={p}
                    onClick={() => toggleMes(p)}
                    disabled={disabled}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all flex items-center gap-1.5"
                    style={activo
                      ? { background: C.navy, color: "#fff", borderColor: C.navy, boxShadow: "0 2px 6px rgba(31,58,82,0.25)" }
                      : disabled
                        ? { background: C.ivory, color: "#B8B0A0", borderColor: C.cardBorder, cursor: "not-allowed" }
                        : { background: "#fff", color: C.navyDark, borderColor: C.cardBorder }}
                  >
                    {activo ? <X size={12} /> : <Plus size={12} />}
                    {fmtPeriodo(p)}
                  </button>
                );
              })}
            </div>
            {seleccionados.length > 0 && (
              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px]" style={{ color: C.textMute }}>Comparando:</span>
                {seleccionados.map((p, i) => (
                  <span
                    key={p}
                    className="text-[11px] font-bold px-2 py-0.5 rounded border"
                    style={{ background: `${C.gold}1A`, color: C.goldDark, borderColor: `${C.gold}55` }}
                  >
                    {i === 0 ? "Base: " : "vs "}{fmtPeriodo(p)}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* === VISTA COMPARATIVO === */}
      {vista === "comparativo" && groups.map((g, gi) => (
        <section key={g.title} className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: C.navyDark }}>
              <span className="text-white text-[12px] font-bold">{gi + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[16px] font-bold" style={{ color: C.navyDark }}>{g.title}</h2>
              <p className="text-[11px]" style={{ color: C.textMute }}>{g.descripcion}</p>
            </div>
            <span className="w-8 h-8 rounded-md flex items-center justify-center text-white shrink-0" style={{ background: g.color }}>{g.icon}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: C.cardBorder }}>
                  <th className="px-2 py-2 font-bold uppercase text-[10px] tracking-wider" style={{ color: C.textMute }}>Indicador / Fórmula</th>
                  {seleccionados.map((p) => (
                    <th key={p} className="px-2 py-2 font-bold uppercase text-[10px] tracking-wider text-right" style={{ color: C.textMute }}>
                      {fmtPeriodo(p)}
                    </th>
                  ))}
                  {seleccionados.length > 1 && (
                    <th className="px-2 py-2 font-bold uppercase text-[10px] tracking-wider text-right whitespace-nowrap" style={{ color: C.textMute }}>
                      Diferencia ({fmtPeriodo(seleccionados[0])} → {fmtPeriodo(seleccionados[seleccionados.length - 1])})
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {g.kpis.map((kpi) => {
                  const valores = seleccionados.map((p) => {
                    const raw = kpi.computeRaw(p);
                    if (raw === null) return null;
                    return { value: formatValue(raw, kpi.format), raw, tone: toneOf(raw, kpi.thresholds) };
                  });
                  const base = valores[0];
                  const ultimo = valores[valores.length - 1];
                  // Diferencia absoluta entre el último y el primer mes seleccionado
                  let diff: number | null = null;
                  let deltaPct: number | null = null;
                  if (base && ultimo) {
                    diff = ultimo.raw - base.raw;
                    if (base.raw !== 0) deltaPct = diff / Math.abs(base.raw);
                  }
                  const diffColor = diff === null || Math.abs(diff) < 0.0001 ? C.textMute : diff > 0 ? C.green : C.red;

                  return (
                    <tr key={kpi.key} className="border-b" style={{ borderColor: `${C.cardBorder}80` }}>
                      <td className="px-2 py-2.5 align-top">
                        <div className="font-semibold leading-tight" style={{ color: C.navyDark }}>{kpi.label}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: C.textMute }}>{kpi.hint}</div>
                        {kpi.formula && (
                          <div className="text-[9.5px] font-mono mt-0.5" style={{ color: C.gold }}>{kpi.formula}</div>
                        )}
                      </td>
                      {valores.map((v, i) => (
                        <td key={i} className="px-2 py-2.5 align-top text-right">
                          {v ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="font-bold tabular-nums" style={{ color: SEM_COLORS[v.tone] }}>{v.value}</span>
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SEM_COLORS[v.tone] }} />
                            </div>
                          ) : (
                            <span className="text-[11px]" style={{ color: C.textMute }}>—</span>
                          )}
                        </td>
                      ))}
                      {seleccionados.length > 1 && (
                        <td className="px-2 py-2.5 align-top text-right">
                          {diff !== null ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <div className="flex items-center justify-end gap-1">
                                {Math.abs(diff) < 0.0001 ? <Minus size={11} style={{ color: C.textMute }} /> :
                                  diff > 0 ? <ArrowUpRight size={11} style={{ color: C.green }} /> :
                                  <ArrowDownRight size={11} style={{ color: C.red }} />}
                                <span className="text-[12px] font-bold tabular-nums" style={{ color: diffColor }}>
                                  {diff > 0 ? "+" : ""}{formatValue(diff, kpi.format)}
                                </span>
                              </div>
                              {deltaPct !== null && Math.abs(deltaPct) >= 0.001 && (
                                <span className="text-[10px] tabular-nums" style={{ color: deltaPct > 0 ? `${C.green}B3` : `${C.red}B3` }}>
                                  ({deltaPct > 0 ? "+" : ""}{fmtPct(deltaPct, 1)})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px]" style={{ color: C.textMute }}>—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {/* === VISTA ANUAL: gráficos de comportamiento === */}
      {vista === "anual" && groups.map((g, gi) => (
        <section key={g.title} className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: C.navyDark }}>
              <span className="text-white text-[12px] font-bold">{gi + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[16px] font-bold" style={{ color: C.navyDark }}>{g.title}</h2>
              <p className="text-[11px]" style={{ color: C.textMute }}>Evolución {añoFiltro} · {g.descripcion}</p>
            </div>
            <span className="w-8 h-8 rounded-md flex items-center justify-center text-white shrink-0" style={{ background: g.color }}>{g.icon}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {g.kpis.map((kpi) => {
              const data = mesesAñoFiltro.map((p) => {
                const raw = kpi.computeRaw(p);
                return {
                  mes: fmtMesCorto(p),
                  periodo: p,
                  valor: raw,
                  tone: raw !== null ? toneOf(raw, kpi.thresholds) : ("neutral" as Tone),
                };
              });
              const datosValidos = data.filter(d => d.valor !== null);
              const ultimoDato = datosValidos[datosValidos.length - 1];
              const primerDato = datosValidos[0];
              let trendPct: number | null = null;
              if (ultimoDato && primerDato && primerDato.valor !== null && ultimoDato.valor !== null && primerDato.valor !== 0) {
                trendPct = (ultimoDato.valor - primerDato.valor) / Math.abs(primerDato.valor);
              }

              return (
                <div key={kpi.key} className="rounded-xl p-3 border" style={{ background: C.ivory, borderColor: C.cardBorder }}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <div>
                      <div className="text-[12px] font-bold leading-tight" style={{ color: C.navyDark }}>{kpi.label}</div>
                      <div className="text-[9.5px] mt-0.5" style={{ color: C.textMute }}>{kpi.hint}</div>
                      {kpi.formula && <div className="text-[9px] font-mono mt-0.5" style={{ color: C.gold }}>{kpi.formula}</div>}
                    </div>
                    {ultimoDato && ultimoDato.valor !== null && (
                      <div className="text-right shrink-0">
                        <div className="text-[13px] font-bold tabular-nums" style={{ color: SEM_COLORS[ultimoDato.tone] }}>
                          {formatValue(ultimoDato.valor, kpi.format)}
                        </div>
                        {trendPct !== null && (
                          <div
                            className="text-[9.5px] flex items-center justify-end gap-0.5"
                            style={{ color: Math.abs(trendPct) < 0.001 ? C.textMute : trendPct > 0 ? C.green : C.red }}
                          >
                            {trendPct > 0 ? <ArrowUpRight size={10} /> : trendPct < 0 ? <ArrowDownRight size={10} /> : <Minus size={10} />}
                            <span className="tabular-nums">{trendPct > 0 ? "+" : ""}{fmtPct(trendPct, 1)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="h-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 10, fill: C.textMute }} axisLine={false} tickLine={false} />
                        <YAxis
                          tick={{ fontSize: 9, fill: C.textMute }}
                          axisLine={false}
                          tickLine={false}
                          width={55}
                          tickFormatter={(v) => {
                            if (kpi.format === "money") return fmtMoney(v, { compact: true });
                            if (kpi.format === "pct") return `${(v * 100).toFixed(0)}%`;
                            return v.toFixed(1);
                          }}
                        />
                        <Tooltip
                          contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${C.cardBorder}`, padding: "6px 8px" }}
                          formatter={(value: number) => [value !== null && value !== undefined ? formatValue(value, kpi.format) : "—", kpi.label]}
                          labelStyle={{ fontWeight: 700, color: C.text }}
                        />
                        <ReferenceLine
                          y={kpi.thresholds.good}
                          stroke={SEM_COLORS.good}
                          strokeDasharray="4 4"
                          strokeOpacity={0.6}
                          label={{ value: "Bueno", position: "insideTopRight", fontSize: 8, fill: SEM_COLORS.good }}
                        />
                        <ReferenceLine
                          y={kpi.thresholds.warn}
                          stroke={SEM_COLORS.warn}
                          strokeDasharray="4 4"
                          strokeOpacity={0.6}
                          label={{ value: "Alerta", position: "insideBottomRight", fontSize: 8, fill: SEM_COLORS.warn }}
                        />
                        <Line
                          type="monotone"
                          dataKey="valor"
                          stroke={g.color}
                          strokeWidth={2.5}
                          dot={{ r: 3.5, fill: g.color }}
                          activeDot={{ r: 5 }}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Leyenda del semáforo */}
      <section className="bg-white rounded-2xl p-5 border" style={{ borderColor: C.cardBorder }}>
        <h3 className="text-[13px] font-bold mb-2" style={{ color: C.navyDark }}>Sistema de semáforo</h3>
        <div className="flex items-center gap-4 flex-wrap text-[12px]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: C.green }} />
            <span style={{ color: C.text }}><strong>Verde:</strong> Saludable</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: C.amber }} />
            <span style={{ color: C.text }}><strong>Amarillo:</strong> Atención</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: C.red }} />
            <span style={{ color: C.text }}><strong>Rojo:</strong> Crítico</span>
          </span>
          {vista === "anual" && (
            <span className="text-[11px] ml-auto" style={{ color: C.textMute }}>
              Líneas punteadas: umbrales <span style={{ color: SEM_COLORS.good }}>verde</span> / <span style={{ color: SEM_COLORS.warn }}>amarillo</span>
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
