import { useEffect, useMemo, useState } from "react";
import {
  Droplets, Users2, Target, ShieldCheck, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown, Wrench, Briefcase, Leaf, Users,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  LineChart, Line, Area, ComposedChart, PieChart, Pie, Cell, LabelList,
} from "recharts";
import {
  api,
  type AgingAnual, type EjecucionPpto, type LiquidezMes, type ResultadoMes, type SaldoMes,
} from "@/lib/api";
import { fmtMesCorto, fmtMoney, fmtPct, fmtPeriodo } from "@/lib/format";

interface Props {
  yearFilter: number | null;
}

// ====== Paleta ejecutiva ======
const C = {
  navy:       "#1F3A52",   // autoridad — color principal
  navyDark:   "#0F2438",   // headers / títulos
  gold:       "#C9A55C",   // acento de convicción
  goldDark:   "#A88243",
  ivory:      "#F8F6F1",   // fondo crema sutil
  green:      "#2D7A4F",   // semáforo verde
  amber:      "#D4A036",   // semáforo amarillo
  red:        "#C73E3E",   // semáforo rojo
  text:       "#0E2410",   // texto principal (deepgreen-900)
  textMute:   "#5B6963",   // texto secundario
  cardBorder: "#E8E1D2",
};

// Colores aging
const AGING_COLORS = {
  "1-30 días":   "#9CC4A0",   // verde claro
  "31-90 días":  "#D4A036",   // ámbar
  "91-180 días": "#D97743",   // naranja
  "181-365 días":"#B53F3F",   // rojo medio
  "+365 días":   "#7A1F1F",   // rojo oscuro
};

const CATEGORIA_COLOR: Record<string, string> = {
  "Seguridad":        "#1F3A52",  // navy
  "Mantenimiento":    "#C9A55C",  // gold
  "Servicios":        "#2D7A4F",  // green
  "Ambiental":        "#2D7A4F",
  "Administrativos":  "#7A6B4A",  // marrón ejecutivo
  "Convivencia":      "#A88243",
};

const CATEGORIA_ICON: Record<string, typeof Wrench> = {
  Seguridad: ShieldCheck,
  Mantenimiento: Wrench,
  Convivencia: Users,
  Ambiental: Leaf,
  Administrativos: Briefcase,
};

type SemTone = "green" | "amber" | "red";
function colorSem(t: SemTone): string {
  return t === "green" ? C.green : t === "amber" ? C.amber : C.red;
}

interface Alerta {
  tipo: "alerta" | "accion" | "info";
  titulo: string;
  detalle: string;
  fecha?: string;
  severity: SemTone;
}

export function DashboardEjecutivo({ yearFilter }: Props) {
  const [saldos, setSaldos] = useState<SaldoMes[]>([]);
  const [liquidez, setLiquidez] = useState<LiquidezMes[]>([]);
  const [resultados, setResultados] = useState<ResultadoMes[]>([]);
  const [ejecucion, setEjecucion] = useState<EjecucionPpto[]>([]);
  const [agingAnual, setAgingAnual] = useState<AgingAnual | null>(null);
  const [year, setYear] = useState<number>(yearFilter ?? 2026);
  // Año explícito elegido por el usuario en este tablero (independiente del filtro global)
  const [añosDisponibles, setAñosDisponibles] = useState<number[]>([]);
  // Mes de corte elegido por el usuario en formato "YYYY-MM"; null = usar último mes con datos
  const [mesElegido, setMesElegido] = useState<string | null>(null);

  useEffect(() => {
    if (yearFilter) setYear(yearFilter);
  }, [yearFilter]);

  useEffect(() => {
    api.finMeta().then(m => setAñosDisponibles(m.years_available)).catch(() => {});
  }, []);

  useEffect(() => {
    // Al cambiar de año, limpiar la elección de mes (se calcula el último automáticamente)
    setMesElegido(null);
    Promise.all([
      api.finSaldos(year).catch(() => []),
      api.finLiquidez(year).catch(() => []),
      api.finResultados(year).catch(() => []),
      api.finEjecucionPpto(year).catch(() => []),
      api.carteraAgingAnual(year).catch(() => null),
    ]).then(([s, l, r, e, a]) => {
      setSaldos(s); setLiquidez(l); setResultados(r); setEjecucion(e); setAgingAnual(a);
    });
  }, [year]);

  // ====== Meses disponibles del año ======
  const mesesDisponibles = useMemo(() => {
    const set = new Set<string>();
    saldos.forEach(s => { if (s.disponible_total > 0) set.add(s.periodo); });
    liquidez.forEach(l => { if ((l.total_activo ?? l.activo_corriente) > 0) set.add(l.periodo); });
    resultados.forEach(r => { if (r.egreso_total_egresos > 0) set.add(r.periodo); });
    return Array.from(set).sort();
  }, [saldos, liquidez, resultados]);

  // ====== Mes de corte efectivo: elegido por el usuario o último con datos ======
  const periodoCorte = mesElegido && mesesDisponibles.includes(mesElegido)
    ? mesElegido
    : mesesDisponibles[mesesDisponibles.length - 1] ?? "";

  // Datos puntuales del mes de corte
  const saldoCorte    = saldos.find(s => s.periodo === periodoCorte);
  const liqCorte      = liquidez.find(l => l.periodo === periodoCorte);
  const resultadoCorte = resultados.find(r => r.periodo === periodoCorte);
  const agingUltimo   = periodoCorte ? agingAnual?.por_mes?.[periodoCorte] : null;

  // Backward-compat (otros bloques siguen usando estos nombres)
  const ultimoSaldo = saldoCorte;
  const ultimaLiq = liqCorte;

  // ====== KPI 1: Liquidez Inmediata ======
  const liquidezInmediata = ultimoSaldo?.disponible_total ?? 0;
  const semLiquidez: SemTone = liquidezInmediata > 30_000_000 ? "green" : liquidezInmediata > 10_000_000 ? "amber" : "red";

  // ====== KPI 2: Índice de Cartera (vencido / total) ======
  const indiceCarteraPct = agingUltimo && agingUltimo.total > 0
    ? agingUltimo.vencido_60 / agingUltimo.total
    : 0;
  const semCartera: SemTone = indiceCarteraPct < 0.2 ? "green" : indiceCarteraPct < 0.4 ? "amber" : "red";

  // ====== KPI 3: Cumplimiento Presupuestal (acumulado hasta el mes de corte) ======
  const cumplimiento = useMemo(() => {
    const cutoff = periodoCorte;
    const hastaCorte = cutoff
      ? resultados.filter(r => r.periodo <= cutoff && r.egreso_total_egresos > 0)
      : resultados.filter(r => r.egreso_total_egresos > 0);
    if (hastaCorte.length === 0 || ejecucion.length === 0) return { pct: 0, real: 0, proyectado: 0 };
    const real = hastaCorte.reduce((s, r) => s + r.egreso_total_egresos, 0);
    const pptoAnual = ejecucion.reduce((s, e) => s + e.presupuesto_anual, 0);
    const proyectado = pptoAnual * (hastaCorte.length / 12);
    return { pct: proyectado > 0 ? real / proyectado : 0, real, proyectado };
  }, [resultados, ejecucion, periodoCorte]);
  // Semáforo cumplimiento: cerca de 100% = verde, sobre 110% = rojo (sobrecosto)
  const semCumplimiento: SemTone =
    Math.abs(cumplimiento.pct - 1) < 0.05 ? "green" :
    cumplimiento.pct > 1.10 || cumplimiento.pct < 0.85 ? "red" : "amber";

  // ====== KPI 4: Fondo de Reserva ======
  const fondoReserva = ultimoSaldo?.fiducia ?? 0;
  const egresoPromedio = useMemo(() => {
    const validos = resultados.filter(r => r.egreso_total_egresos > 0);
    return validos.length > 0 ? validos.reduce((s, r) => s + r.egreso_total_egresos, 0) / validos.length : 0;
  }, [resultados]);
  const cobertura = egresoPromedio > 0 ? fondoReserva / egresoPromedio : 0;
  const semFondo: SemTone = cobertura >= 1 ? "green" : cobertura >= 0.5 ? "amber" : "red";

  // ====== Panel 2: Aging del mes actual ======
  const aging = (agingUltimo?.buckets ?? []).map(b => ({
    ...b,
    color: AGING_COLORS[b.bucket as keyof typeof AGING_COLORS] ?? C.navy,
  }));
  const totalCartera = agingUltimo?.total ?? 0;

  // ====== Panel 3: Serie mensual Ppto vs Real (truncada al mes de corte) ======
  const serieEjecucion = useMemo(() => {
    const pptoAnual = ejecucion.reduce((s, e) => s + e.presupuesto_anual, 0);
    const pptoMensual = pptoAnual / 12;
    const cutoff = periodoCorte;
    return resultados
      .filter(r => !cutoff || r.periodo <= cutoff)
      .map(r => {
        const real = r.egreso_total_egresos;
        return {
          mes: fmtMesCorto(r.periodo),
          periodo: r.periodo,
          Presupuesto: pptoMensual,
          Real: real > 0 ? real : null,
          Variacion: real > 0 ? real - pptoMensual : null,
        };
      });
  }, [resultados, ejecucion, periodoCorte]);

  // ====== Panel 4: Distribución por rubros (mes de corte exacto) ======
  const distribucion = resultadoCorte && resultadoCorte.egreso_total_egresos > 0 ? [
    { name: "Seguridad",       value: resultadoCorte.egreso_seguridad      ?? 0 },
    { name: "Mantenimiento",   value: resultadoCorte.egreso_mantenimiento  ?? 0 },
    { name: "Ambiental",       value: resultadoCorte.egreso_ambiental      ?? 0 },
    { name: "Administrativos", value: resultadoCorte.egreso_administrativos ?? 0 },
    { name: "Convivencia",     value: resultadoCorte.egreso_convivencia    ?? 0 },
  ].filter(d => d.value > 0) : [];
  const totalDistribucion = distribucion.reduce((s, d) => s + d.value, 0);

  // ====== Panel 5: Alertas (derivadas de los datos) ======
  const alertas: Alerta[] = useMemo(() => {
    const out: Alerta[] = [];
    if (semCartera === "red") {
      out.push({
        tipo: "alerta",
        titulo: "Cartera vencida supera el umbral crítico (>40%)",
        detalle: `Índice de morosidad: ${fmtPct(indiceCarteraPct, 1)}. Se requiere gestión jurídica o acuerdos de pago.`,
        severity: "red",
      });
    }
    if (cumplimiento.pct > 1.10 && cumplimiento.pct < 1.30) {
      out.push({
        tipo: "alerta",
        titulo: "Sobreejecución presupuestal",
        detalle: `El gasto real supera el proyectado en ${fmtPct(cumplimiento.pct - 1, 1)}. Revisar rubros con mayor desviación.`,
        severity: "amber",
      });
    }
    if (semFondo === "red") {
      out.push({
        tipo: "alerta",
        titulo: "Fondo de reserva por debajo del mínimo recomendado",
        detalle: `Cobertura actual: ${cobertura.toFixed(2)} meses de operación. Se recomienda alcanzar 1.0x.`,
        severity: "red",
      });
    }
    // Acciones positivas
    if (semLiquidez === "green") {
      out.push({
        tipo: "info",
        titulo: "Liquidez en banco saludable",
        detalle: `Disponible total: ${fmtMoney(liquidezInmediata)}. Permite operación continua sin tensión.`,
        severity: "green",
      });
    }
    if (semCumplimiento === "green") {
      out.push({
        tipo: "accion",
        titulo: "Ejecución presupuestal alineada con el plan",
        detalle: `Real vs Proyectado: ${fmtPct(cumplimiento.pct, 1)}. Plan se está cumpliendo dentro del margen.`,
        severity: "green",
      });
    }
    return out;
  }, [semCartera, indiceCarteraPct, cumplimiento, semFondo, cobertura, semLiquidez, liquidezInmediata, semCumplimiento]);

  if (!ultimaLiq) {
    return (
      <div className="napsa-card text-deepgreen-500 text-[13px]">
        Cargando información financiera…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ====== HEADER EJECUTIVO ====== */}
      <header className="rounded-2xl p-6 lg:p-7 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${C.navyDark} 0%, ${C.navy} 100%)` }}>
        <div className="absolute top-0 right-0 w-64 h-64 opacity-10 rounded-full" style={{ background: C.gold, filter: "blur(60px)", transform: "translate(30%, -30%)" }} />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-5 rounded-sm" style={{ background: C.gold }} />
              <span className="text-[11px] uppercase tracking-[0.2em] font-semibold" style={{ color: C.gold }}>Urbanización Monteverdi P.H.</span>
            </div>
            <h1 className="text-[26px] sm:text-[30px] font-bold text-white leading-tight tracking-tight">
              Tablero Ejecutivo Financiero
            </h1>
            <p className="text-[13px] mt-1.5" style={{ color: "#D4D4D8" }}>
              Corte: <span className="font-semibold text-white">{periodoCorte && fmtPeriodo(periodoCorte)}</span>
              <span className="mx-2 opacity-50">·</span>
              Año fiscal <span className="font-semibold text-white">{year}</span>
            </p>
          </div>

          {/* Selectores ejecutivos: Año fiscal + Mes de corte */}
          <div className="flex items-stretch gap-2 flex-wrap">
            <div className="rounded-lg px-3 py-2 backdrop-blur-sm" style={{ background: "rgba(255,255,255,0.10)", border: `1px solid rgba(201,165,92,0.35)` }}>
              <label className="block text-[9px] uppercase tracking-[0.18em] font-bold mb-1" style={{ color: C.gold }}>
                Año fiscal
              </label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                className="bg-transparent text-[14px] font-bold text-white focus:outline-none cursor-pointer pr-1"
                style={{ minWidth: 70 }}
              >
                {(añosDisponibles.length > 0 ? añosDisponibles : [year]).map(a => (
                  <option key={a} value={a} className="text-deepgreen-900 bg-white">{a}</option>
                ))}
              </select>
            </div>
            <div className="rounded-lg px-3 py-2 backdrop-blur-sm" style={{ background: "rgba(255,255,255,0.10)", border: `1px solid rgba(201,165,92,0.35)` }}>
              <label className="block text-[9px] uppercase tracking-[0.18em] font-bold mb-1" style={{ color: C.gold }}>
                Mes de corte
              </label>
              <select
                value={periodoCorte}
                onChange={(e) => setMesElegido(e.target.value)}
                disabled={mesesDisponibles.length === 0}
                className="bg-transparent text-[14px] font-bold text-white focus:outline-none cursor-pointer pr-1"
                style={{ minWidth: 130 }}
              >
                {mesesDisponibles.length === 0 && (
                  <option value="" className="text-deepgreen-900 bg-white">Sin datos</option>
                )}
                {mesesDisponibles.map(p => (
                  <option key={p} value={p} className="text-deepgreen-900 bg-white">{fmtPeriodo(p)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* ====== PANEL 1: SEMÁFOROS DE SALUD FINANCIERA ====== */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: C.navyDark }}>
            <span className="text-white text-[12px] font-bold">1</span>
          </div>
          <h2 className="text-[16px] font-bold" style={{ color: C.navyDark }}>Semáforos de Salud Financiera</h2>
          <div className="flex-1 h-px ml-2" style={{ background: C.cardBorder }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCardEjecutivo
            label="Liquidez Inmediata"
            descripcion="Disponible en bancos + caja"
            valor={fmtMoney(liquidezInmediata)}
            sub={`${ultimoSaldo ? fmtPeriodo(ultimoSaldo.periodo) : ""}`}
            tone={semLiquidez}
            icon={<Droplets size={18} />}
          />
          <KpiCardEjecutivo
            label="Índice de Cartera"
            descripcion="Vencida >60d / Total cartera"
            valor={fmtPct(indiceCarteraPct, 1)}
            sub={`Cartera total: ${fmtMoney(totalCartera, { compact: true })}`}
            tone={semCartera}
            icon={<Users2 size={18} />}
            invertido
          />
          <KpiCardEjecutivo
            label="Cumplimiento Presupuestal"
            descripcion="Ejecutado real vs proyectado"
            valor={fmtPct(cumplimiento.pct, 1)}
            sub={`Real: ${fmtMoney(cumplimiento.real, { compact: true })} / Proy: ${fmtMoney(cumplimiento.proyectado, { compact: true })}`}
            tone={semCumplimiento}
            icon={<Target size={18} />}
          />
          <KpiCardEjecutivo
            label="Fondo de Reserva"
            descripcion="Cobertura en meses de gasto"
            valor={fmtMoney(fondoReserva)}
            sub={`Cobertura: ${cobertura.toFixed(2)}x meses`}
            tone={semFondo}
            icon={<ShieldCheck size={18} />}
          />
        </div>
      </section>

      {/* ====== PANEL 2: ANÁLISIS DE CARTERA — BARRAS APILADAS ====== */}
      <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: C.navyDark }}>
            <span className="text-white text-[12px] font-bold">2</span>
          </div>
          <div>
            <h2 className="text-[16px] font-bold" style={{ color: C.navyDark }}>Análisis de Cartera por Antigüedad</h2>
            <p className="text-[11px]" style={{ color: C.textMute }}>Distribución de la cartera vencida por rangos de mora</p>
          </div>
        </div>

        {totalCartera > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Gráfico de barras horizontales */}
            <div className="lg:col-span-2 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aging} layout="vertical" margin={{ top: 10, right: 30, left: 50, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => fmtMoney(v, { compact: true })} tick={{ fontSize: 11, fill: C.textMute }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="bucket" tick={{ fontSize: 11, fill: C.text, fontWeight: 600 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip
                    formatter={(v: number) => [fmtMoney(v), "Valor"]}
                    contentStyle={{ borderRadius: 8, border: `1px solid ${C.cardBorder}`, fontSize: 12 }}
                  />
                  <Bar dataKey="valor" radius={[0, 6, 6, 0]}>
                    {aging.map((b, i) => <Cell key={i} fill={b.color} />)}
                    <LabelList dataKey="valor" position="right" formatter={(v: number) => fmtMoney(v, { compact: true })} style={{ fontSize: 10.5, fill: C.text, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tabla resumen — cifras compactas y overflow-hidden para evitar desborde */}
            <div className="flex flex-col justify-center min-w-0">
              <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: C.textMute }}>Resumen</div>
              <div className="rounded-xl p-3 min-w-0 overflow-hidden" style={{ background: C.ivory, border: `1px solid ${C.cardBorder}` }}>
                <div className="text-[10px] font-semibold mb-1 truncate" style={{ color: C.textMute }}>Cartera total al corte</div>
                <div
                  className="text-[15px] font-bold tabular-nums leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
                  style={{ color: C.navyDark }}
                  title={fmtMoney(totalCartera)}
                >
                  {fmtMoney(totalCartera, { compact: true })}
                </div>
                <div className="mt-2.5 space-y-1">
                  {aging.map((b) => {
                    const pct = b.valor / totalCartera;
                    return (
                      <div key={b.bucket} className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: b.color }} />
                        <span className="text-[10px] flex-1 truncate leading-tight" style={{ color: C.text }}>
                          {b.bucket}
                        </span>
                        <span className="text-[10px] font-bold tabular-nums shrink-0" style={{ color: pct > 0.3 ? C.red : C.text }}>
                          {fmtPct(pct, 0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2.5 pt-2.5 border-t text-[9.5px] leading-snug" style={{ borderColor: C.cardBorder, color: C.textMute }}>
                  {indiceCarteraPct > 0.4
                    ? <><strong style={{ color: C.red }}>Atención:</strong> riesgo estructural · requiere gestión jurídica</>
                    : indiceCarteraPct > 0.2
                      ? <><strong style={{ color: C.amber }}>Vigilar:</strong> tendencia al alza en mora &gt;60d</>
                      : <><strong style={{ color: C.green }}>Saludable:</strong> morosidad controlada</>}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-[13px] py-6 text-center" style={{ color: C.textMute }}>
            Sin datos de cartera para el período actual.
          </div>
        )}
      </section>

      {/* ====== PANEL 3: EJECUCIÓN DE GASTOS — LÍNEAS COMPARATIVAS ====== */}
      <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: C.navyDark }}>
            <span className="text-white text-[12px] font-bold">3</span>
          </div>
          <div>
            <h2 className="text-[16px] font-bold" style={{ color: C.navyDark }}>Ejecución de Gastos — Real vs Presupuesto</h2>
            <p className="text-[11px]" style={{ color: C.textMute }}>Tendencia mensual y variación acumulada del año</p>
          </div>
        </div>

        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={serieEjecucion} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="variacionUp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.red} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={C.red} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="variacionDown" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.green} stopOpacity={0.20} />
                  <stop offset="100%" stopColor={C.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: C.text, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => fmtMoney(v, { compact: true })} tick={{ fontSize: 10, fill: C.textMute }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number, name: string) => [v !== null && v !== undefined ? fmtMoney(v) : "—", name]}
                labelFormatter={(_l, payload) => payload?.[0]?.payload?.periodo ? fmtPeriodo(payload[0].payload.periodo) : ""}
                contentStyle={{ borderRadius: 8, border: `1px solid ${C.cardBorder}`, fontSize: 12 }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {/* Línea Presupuesto */}
              <Line type="monotone" dataKey="Presupuesto" stroke={C.navy} strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 3, fill: C.navy }} />
              {/* Línea Real */}
              <Line type="monotone" dataKey="Real" stroke={C.gold} strokeWidth={3} dot={{ r: 4.5, fill: C.gold, stroke: "white", strokeWidth: 1.5 }} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Resumen de variación */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl p-3" style={{ background: C.ivory, border: `1px solid ${C.cardBorder}` }}>
            <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMute }}>Real acumulado</div>
            <div className="text-[16px] font-bold tabular-nums mt-0.5" style={{ color: C.navyDark }}>{fmtMoney(cumplimiento.real)}</div>
          </div>
          <div className="rounded-xl p-3" style={{ background: C.ivory, border: `1px solid ${C.cardBorder}` }}>
            <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMute }}>Proyectado acumulado</div>
            <div className="text-[16px] font-bold tabular-nums mt-0.5" style={{ color: C.navyDark }}>{fmtMoney(cumplimiento.proyectado)}</div>
          </div>
          <div className="rounded-xl p-3" style={{ background: C.ivory, border: `1px solid ${C.cardBorder}` }}>
            <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMute }}>Variación</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              {cumplimiento.real > cumplimiento.proyectado
                ? <TrendingUp size={14} style={{ color: C.red }} />
                : <TrendingDown size={14} style={{ color: C.green }} />}
              <span className="text-[16px] font-bold tabular-nums" style={{ color: cumplimiento.real > cumplimiento.proyectado ? C.red : C.green }}>
                {fmtMoney(cumplimiento.real - cumplimiento.proyectado)}
              </span>
              <span className="text-[10.5px]" style={{ color: C.textMute }}>
                ({fmtPct(cumplimiento.pct - 1, 1)})
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ====== PANEL 4: DISTRIBUCIÓN POR RUBROS — DONUT ====== */}
      <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: C.navyDark }}>
            <span className="text-white text-[12px] font-bold">4</span>
          </div>
          <div>
            <h2 className="text-[16px] font-bold" style={{ color: C.navyDark }}>Distribución de Gastos por Rubro</h2>
            <p className="text-[11px]" style={{ color: C.textMute }}>
              {resultadoCorte && `Egresos de ${fmtPeriodo(resultadoCorte.periodo)} — ${fmtMoney(totalDistribucion)}`}
            </p>
          </div>
        </div>

        {distribucion.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribucion}
                    dataKey="value"
                    cx="50%" cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                    stroke="white"
                    strokeWidth={2}
                  >
                    {distribucion.map((d, i) => (
                      <Cell key={i} fill={CATEGORIA_COLOR[d.name] ?? `hsl(${i * 60}, 40%, 40%)`} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, name: string) => [`${fmtMoney(v)} (${fmtPct(v / totalDistribucion, 1)})`, name]}
                    contentStyle={{ borderRadius: 8, border: `1px solid ${C.cardBorder}`, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              {distribucion
                .slice()
                .sort((a, b) => b.value - a.value)
                .map((d) => {
                  const Icon = CATEGORIA_ICON[d.name] ?? Briefcase;
                  const pct = d.value / totalDistribucion;
                  return (
                    <div key={d.name} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: C.ivory, border: `1px solid ${C.cardBorder}` }}>
                      <div className="w-9 h-9 rounded-md flex items-center justify-center text-white shrink-0" style={{ background: CATEGORIA_COLOR[d.name] ?? "#7A6B4A" }}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-bold leading-tight" style={{ color: C.navyDark }}>{d.name}</div>
                        <div className="text-[10.5px]" style={{ color: C.textMute }}>{fmtPct(pct, 1)} del total</div>
                      </div>
                      <div className="text-[13px] font-bold tabular-nums shrink-0" style={{ color: C.navyDark }}>{fmtMoney(d.value)}</div>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
          <div className="text-[13px] py-6 text-center" style={{ color: C.textMute }}>
            Sin datos de gastos por rubro para el período actual.
          </div>
        )}
      </section>

      {/* ====== PANEL 5: ALERTAS Y ACCIONES ====== */}
      <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: C.navyDark }}>
            <span className="text-white text-[12px] font-bold">5</span>
          </div>
          <div>
            <h2 className="text-[16px] font-bold" style={{ color: C.navyDark }}>Alertas y Acciones de Gestión</h2>
            <p className="text-[11px]" style={{ color: C.textMute }}>Lectura cualitativa de la situación, derivada de los indicadores</p>
          </div>
        </div>

        <div className="space-y-2">
          {alertas.map((a, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: C.ivory, borderLeft: `4px solid ${colorSem(a.severity)}` }}>
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: colorSem(a.severity), color: "white" }}>
                {a.tipo === "alerta" ? <AlertTriangle size={14} /> : a.tipo === "accion" ? <CheckCircle2 size={14} /> : <TrendingUp size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: colorSem(a.severity) }}>
                    {a.tipo === "alerta" ? "Alerta" : a.tipo === "accion" ? "Acción positiva" : "Información"}
                  </span>
                </div>
                <div className="text-[13px] font-bold mt-0.5" style={{ color: C.navyDark }}>{a.titulo}</div>
                <div className="text-[11.5px] mt-0.5" style={{ color: C.textMute }}>{a.detalle}</div>
              </div>
            </div>
          ))}
          {alertas.length === 0 && (
            <div className="text-[12px] py-3 text-center" style={{ color: C.textMute }}>
              Sin alertas en el período. Todos los indicadores están dentro de los rangos esperados.
            </div>
          )}
        </div>

        {/* Pie de página ejecutivo */}
        <div className="mt-4 pt-3 flex items-center justify-between flex-wrap gap-2 text-[10.5px]" style={{ borderTop: `1px solid ${C.cardBorder}`, color: C.textMute }}>
          <span>Tablero generado a partir de los archivos contables oficiales de la urbanización.</span>
          <span className="font-semibold" style={{ color: C.navy }}>Administración · Monteverdi P.H.</span>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// Tarjeta KPI ejecutiva — diseño grande con semáforo
// ============================================================================
function KpiCardEjecutivo({
  label, descripcion, valor, sub, tone, icon, invertido = false,
}: {
  label: string;
  descripcion: string;
  valor: string;
  sub?: string;
  tone: SemTone;
  icon: React.ReactNode;
  invertido?: boolean;
}) {
  const color = colorSem(tone);
  return (
    <div className="relative bg-white rounded-2xl p-4 lg:p-5 border overflow-hidden group hover:shadow-lg transition-shadow" style={{ borderColor: C.cardBorder }}>
      {/* Banda vertical lateral con color de semáforo */}
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: color }} />
      {/* Glow sutil top-right */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.06] rounded-full" style={{ background: color, filter: "blur(40px)", transform: "translate(40%, -40%)" }} />

      <div className="relative">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: color }}>
            {icon}
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color }}>
              {tone === "green" ? (invertido ? "Bajo" : "Óptimo") : tone === "amber" ? "Atención" : "Crítico"}
            </span>
          </div>
        </div>

        <div className="text-[10.5px] uppercase tracking-wider font-bold mb-0.5" style={{ color: C.textMute }}>{label}</div>
        <div className="text-[22px] sm:text-[24px] font-bold tabular-nums leading-tight" style={{ color: C.navyDark, fontFeatureSettings: '"tnum"' }}>
          {valor}
        </div>
        <div className="text-[10.5px] mt-1.5" style={{ color: C.textMute }}>{descripcion}</div>
        {sub && <div className="text-[10px] mt-1 font-semibold tabular-nums" style={{ color: C.text }}>{sub}</div>}
      </div>
    </div>
  );
}
