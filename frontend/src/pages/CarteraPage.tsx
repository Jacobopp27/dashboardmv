import { useEffect, useMemo, useState } from "react";
import { AlertOctagon, AlertTriangle, AlertCircle, CheckCircle2, Clock, User } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from "recharts";
import { api, type AgingReporte as AgingReporteType, type CarteraUnidad, type Meta, type ResumenMensual, type Unidad } from "@/lib/api";
import { fmtMoney, fmtPct, fmtPeriodo } from "@/lib/format";
import { DonutChart } from "@/components/DonutChart";
import { AnualResumenChart } from "@/components/AnualResumenChart";
import { AgingReporte } from "@/components/AgingReporte";

interface Props {
  meta: Meta;
  yearFilter: number | null;
}

// ====== Paleta ejecutiva (idéntica al Tablero de Inicio) ======
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

type RangoMora = "Al día" | "1-30 días" | "31-60 días" | "61-90 días" | "+90 días";

// Colores de mora alineados con la rampa de aging del Inicio
const RANGO_COLOR: Record<RangoMora, string> = {
  "Al día":     "#2D7A4F",   // verde saludable
  "1-30 días":  "#D4A036",   // ámbar
  "31-60 días": "#D97743",   // naranja
  "61-90 días": "#B53F3F",   // rojo medio
  "+90 días":   "#7A1F1F",   // rojo oscuro
};
const RANGO_ORDEN: RangoMora[] = ["Al día", "1-30 días", "31-60 días", "61-90 días", "+90 días"];

function rangoMora(pendiente: number, cuota: number): RangoMora {
  if (pendiente <= 0 || cuota <= 0) return "Al día";
  if (pendiente <= cuota) return "1-30 días";
  if (pendiente <= 2 * cuota) return "31-60 días";
  if (pendiente <= 3 * cuota) return "61-90 días";
  return "+90 días";
}

// Encabezado de panel numerado (patrón del Inicio)
function PanelHead({ n, title, desc }: { n: number; title: string; desc?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: C.navyDark }}>
        <span className="text-white text-[12px] font-bold">{n}</span>
      </div>
      <div>
        <h2 className="text-[16px] font-bold" style={{ color: C.navyDark }}>{title}</h2>
        {desc && <p className="text-[11px]" style={{ color: C.textMute }}>{desc}</p>}
      </div>
    </div>
  );
}

interface Estado { txt: string; color: string }

// Tarjeta KPI ejecutiva con banda lateral y pill de estado (patrón del Inicio)
function KpiCartera({
  icon, label, value, sub, accent, estado, title,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  accent: string; estado?: Estado; title?: string;
}) {
  return (
    <div className="relative bg-white rounded-2xl p-4 lg:p-5 border overflow-hidden" style={{ borderColor: C.cardBorder }}>
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent }} />
      <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.06] rounded-full" style={{ background: accent, filter: "blur(40px)", transform: "translate(40%, -40%)" }} />
      <div className="relative">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: accent }}>
            {icon}
          </div>
          {estado && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: `${estado.color}1A` }}>
              <span className="w-2 h-2 rounded-full" style={{ background: estado.color }} />
              <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: estado.color }}>{estado.txt}</span>
            </div>
          )}
        </div>
        <div className="text-[10.5px] uppercase tracking-wider font-bold mb-0.5" style={{ color: C.textMute }}>{label}</div>
        <div
          className="font-bold tabular-nums leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
          style={{ color: C.navyDark, fontSize: "clamp(1rem, 1.5vw, 1.3rem)" }}
          title={title ?? value}
        >
          {value}
        </div>
        {sub && <div className="text-[10px] mt-1 font-semibold tabular-nums" style={{ color: C.text }}>{sub}</div>}
      </div>
    </div>
  );
}

export function CarteraPage({ meta, yearFilter }: Props) {
  const [cartera, setCartera] = useState<CarteraUnidad[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [resumenAnual, setResumenAnual] = useState<ResumenMensual[]>([]);
  const [aging, setAging] = useState<AgingReporteType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodoSel, setPeriodoSel] = useState<string | null>(null);

  // Año efectivo para análisis anual: usa el del filtro o el del último período disponible
  const yearForAnnual = yearFilter ?? meta.years_available.slice(-1)[0];

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.carteraMensual(yearFilter ?? undefined),
      api.unidades(),
      api.carteraResumenMensual(yearForAnnual),
    ])
      .then(([c, u, r]) => { setCartera(c); setUnidades(u); setResumenAnual(r); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [yearFilter, yearForAnnual]);

  // Períodos disponibles (más reciente primero)
  const periodos = useMemo(() => {
    const set = new Set(cartera.map((r) => r.periodo));
    return Array.from(set).sort().reverse();
  }, [cartera]);

  // Seleccionar período: el más reciente por defecto
  const periodo = periodoSel ?? periodos[0] ?? null;

  // Filtrar al período seleccionado
  const filas = useMemo(() => {
    if (!periodo) return [];
    return cartera.filter((r) => r.periodo === periodo);
  }, [cartera, periodo]);

  // Mapa unidad → propietario
  const propietarioPorUnidad = useMemo(() => {
    const m = new Map<number, string>();
    for (const u of unidades) {
      if (u.rol === "propietario" && !m.has(u.unidad)) {
        m.set(u.unidad, u.nombre_completo);
      }
    }
    return m;
  }, [unidades]);

  // Clasificar mora
  const conMora = useMemo(() => {
    return filas.map((r) => ({
      ...r,
      propietario: propietarioPorUnidad.get(r.unidad) ?? "—",
      rango: rangoMora(r.cuenta_pendiente, r.administracion) as RangoMora,
    }));
  }, [filas, propietarioPorUnidad]);

  // Reset período cuando cambia el año
  useEffect(() => { setPeriodoSel(null); }, [yearFilter, periodos.length]);

  // Cargar aging cuando hay un período seleccionado
  const periodoActual = periodoSel ?? periodos[0] ?? null;
  useEffect(() => {
    if (!periodoActual) { setAging(null); return; }
    const [y, m] = periodoActual.split("-").map((n) => parseInt(n, 10));
    api.carteraAging(y, m).then(setAging).catch(() => setAging(null));
  }, [periodoActual]);

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-5 border flex items-center gap-3" style={{ borderColor: C.cardBorder, fontFamily: "Segoe UI, system-ui, sans-serif" }}>
        <AlertCircle size={20} style={{ color: C.red }} />
        <div className="text-[13px]" style={{ color: C.red }}>{error}</div>
      </div>
    );
  }

  if (loading && cartera.length === 0) {
    return (
      <div className="bg-white rounded-2xl h-[400px] border animate-pulse" style={{ borderColor: C.cardBorder }} />
    );
  }

  if (periodos.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-5 border" style={{ borderColor: C.cardBorder, fontFamily: "Segoe UI, system-ui, sans-serif" }}>
        <div className="text-center py-8 text-[13px]" style={{ color: C.textMute }}>
          {yearFilter ? `No hay datos de cartera mensual para ${yearFilter}.` : "Sin datos de cartera."}
        </div>
      </div>
    );
  }

  // KPIs del período seleccionado
  const totalFacturado = filas.reduce((s, r) => s + r.valor_facturado, 0);
  const totalRecaudado = filas.reduce((s, r) => s + r.valor_pagado, 0);
  const carteraPendiente = filas.reduce((s, r) => s + Math.max(r.cuenta_pendiente, 0), 0);
  const morosos = conMora.filter((r) => r.cuenta_pendiente > 0);
  const pctRecaudo = totalFacturado > 0 ? totalRecaudado / totalFacturado : 0;

  // Distribución por rango
  const porRango = RANGO_ORDEN.map((rango) => {
    const items = conMora.filter((r) => r.rango === rango);
    return {
      rango,
      unidades: items.length,
      valor: items.reduce((s, r) => s + Math.max(r.cuenta_pendiente, 0), 0),
    };
  });

  const topDeudores = [...morosos].sort((a, b) => b.cuenta_pendiente - a.cuenta_pendiente).slice(0, 10);

  // Semáforos para las tarjetas KPI (solo presentación)
  const recaudoTone: Estado = pctRecaudo >= 0.85 ? { txt: "Óptimo", color: C.green }
    : pctRecaudo >= 0.70 ? { txt: "Atención", color: C.amber } : { txt: "Crítico", color: C.red };
  const pendRatio = totalFacturado > 0 ? carteraPendiente / totalFacturado : 0;
  const pendTone: Estado = pendRatio < 0.15 ? { txt: "Bajo", color: C.green }
    : pendRatio < 0.30 ? { txt: "Atención", color: C.amber } : { txt: "Alto", color: C.red };
  const moraRatio = morosos.length / Math.max(filas.length, 1);
  const moraTone: Estado = moraRatio < 0.20 ? { txt: "Óptimo", color: C.green }
    : moraRatio < 0.40 ? { txt: "Atención", color: C.amber } : { txt: "Crítico", color: C.red };

  return (
    <div className="space-y-5" style={{ fontFamily: "Segoe UI, system-ui, sans-serif" }}>
      {/* ====== HEADER EJECUTIVO ====== */}
      <header className="rounded-2xl p-6 lg:p-7 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${C.navyDark} 0%, ${C.navy} 100%)` }}>
        <div className="absolute top-0 right-0 w-64 h-64 opacity-10 rounded-full" style={{ background: C.gold, filter: "blur(60px)", transform: "translate(30%, -30%)" }} />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-5 rounded-sm" style={{ background: C.gold }} />
              <span className="text-[11px] uppercase tracking-[0.2em] font-semibold" style={{ color: C.gold }}>Urbanización Monteverdi P.H.</span>
            </div>
            <h1 className="text-[24px] sm:text-[28px] font-bold text-white leading-tight tracking-tight">
              Análisis de Cartera
            </h1>
            <p className="text-[13px] mt-1.5" style={{ color: "#D4D4D8" }}>
              Facturación, recaudo y estado de mora por unidad
              {periodo && <>
                <span className="mx-2 opacity-50">·</span>
                Corte: <span className="font-semibold text-white">{fmtPeriodo(periodo)}</span>
              </>}
            </p>
          </div>

          {/* Selector de período (patrón boxed del Inicio) */}
          <div className="rounded-lg px-3 py-2 backdrop-blur-sm" style={{ background: "rgba(255,255,255,0.10)", border: `1px solid rgba(201,165,92,0.35)` }}>
            <label className="block text-[9px] uppercase tracking-[0.18em] font-bold mb-1" style={{ color: C.gold }}>
              Período
            </label>
            <select
              value={periodo ?? ""}
              onChange={(e) => setPeriodoSel(e.target.value)}
              className="bg-transparent text-[14px] font-bold text-white focus:outline-none cursor-pointer pr-1"
              style={{ minWidth: 130 }}
            >
              {periodos.map((p) => (
                <option key={p} value={p} className="text-deepgreen-900 bg-white">{fmtPeriodo(p)}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* ====== PANEL 1: INDICADORES DEL PERÍODO ====== */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: C.navyDark }}>
            <span className="text-white text-[12px] font-bold">1</span>
          </div>
          <h2 className="text-[16px] font-bold" style={{ color: C.navyDark }}>Indicadores del Período</h2>
          <div className="flex-1 h-px ml-2" style={{ background: C.cardBorder }} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCartera
            icon={<AlertOctagon size={18} />}
            label="Facturado"
            value={fmtMoney(totalFacturado, { compact: true })}
            title={fmtMoney(totalFacturado)}
            sub={`${filas.length} unidades`}
            accent={C.navy}
          />
          <KpiCartera
            icon={<CheckCircle2 size={18} />}
            label="Recaudado"
            value={fmtMoney(totalRecaudado, { compact: true })}
            title={fmtMoney(totalRecaudado)}
            sub={`${fmtPct(pctRecaudo)} del facturado`}
            accent={recaudoTone.color}
            estado={recaudoTone}
          />
          <KpiCartera
            icon={<AlertTriangle size={18} />}
            label="Pendiente"
            value={fmtMoney(carteraPendiente, { compact: true })}
            title={fmtMoney(carteraPendiente)}
            sub={`${fmtPct(pendRatio)} de la facturación`}
            accent={pendTone.color}
            estado={pendTone}
          />
          <KpiCartera
            icon={<Clock size={18} />}
            label="Unidades en mora"
            value={`${morosos.length} de ${filas.length}`}
            sub={`${fmtPct(moraRatio)} del total`}
            accent={moraTone.color}
            estado={moraTone}
          />
        </div>
      </section>

      {/* ====== PANEL 2: DISTRIBUCIÓN Y ESTADO DE LA CARTERA ====== */}
      <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
        <PanelHead n={2} title="Distribución y Estado de la Cartera" desc="Cartera pendiente por rango de mora y proporción de unidades al día vs. en mora" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          {/* Distribución por rango de mora */}
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: C.textMute }}>Unidades por rango de mora</div>
            <div className="w-full h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porRango} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="rango" tick={{ fontSize: 10.5, fill: C.textMute, fontWeight: 600 }} axisLine={{ stroke: C.cardBorder }} tickLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: C.textMute }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    formatter={(v: number, _name, item) => [
                      `${v} unidades · ${fmtMoney(item.payload.valor)}`,
                      "Detalle",
                    ]}
                    contentStyle={{ borderRadius: 8, border: `1px solid ${C.cardBorder}`, fontSize: 12 }}
                  />
                  <Bar dataKey="unidades" radius={[6, 6, 0, 0]}>
                    {porRango.map((r) => (
                      <Cell key={r.rango} fill={RANGO_COLOR[r.rango as RangoMora]} />
                    ))}
                    <LabelList dataKey="unidades" position="top" style={{ fontSize: 11, fill: C.text, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Donut estado general */}
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: C.textMute }}>Estado general de las unidades</div>
            <DonutChart
              data={[
                { name: "Al día", value: filas.length - morosos.length, color: C.green },
                { name: "En mora", value: morosos.length, color: C.red },
              ]}
              centerLabel="Total"
              centerValue={`${filas.length}`}
            />
            <div className="flex justify-center gap-6 mt-3 text-[13px]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: C.green }} />
                <span style={{ color: C.text }}><strong>{filas.length - morosos.length}</strong> al día</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: C.red }} />
                <span style={{ color: C.text }}><strong>{morosos.length}</strong> en mora</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== PANEL 3: TOP DEUDORES ====== */}
      <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
        <PanelHead n={3} title="Top 10 Unidades con Mayor Saldo Pendiente" desc={periodo ? fmtPeriodo(periodo) : undefined} />
        {topDeudores.length === 0 ? (
          <div className="text-center py-6 flex items-center justify-center gap-2" style={{ color: C.green }}>
            <CheckCircle2 size={18} />
            <span className="font-semibold">¡Ninguna unidad en mora!</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {topDeudores.map((d) => {
              const pct = Math.min(d.cuenta_pendiente / topDeudores[0].cuenta_pendiente, 1);
              const color = RANGO_COLOR[d.rango];
              return (
                <div key={d.unidad} className="flex items-center gap-3">
                  <div className="w-14 shrink-0 text-[13px] font-bold" style={{ color: C.navyDark }}>Casa {d.unidad}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[13px] truncate flex items-center gap-1.5" style={{ color: C.text }}>
                        <User size={12} style={{ color: C.textMute }} /> {d.propietario}
                      </span>
                      <span className="text-[13px] font-bold tabular-nums shrink-0" style={{ color: C.navyDark }}>{fmtMoney(d.cuenta_pendiente)}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: C.ivory }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct * 100}%`, background: color }}
                      />
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: C.textMute }}>{d.rango}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ====== PANEL 4: COMPORTAMIENTO ANUAL ====== */}
      <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
        <PanelHead n={4} title="Comportamiento Anual del Recaudo" desc={`Año ${yearForAnnual} · Facturación, recaudo y cartera total por mes`} />
        {resumenAnual.length === 0 ? (
          <div className="text-[13px] py-8 text-center" style={{ color: C.textMute }}>Sin datos para el año {yearForAnnual}.</div>
        ) : (
          <>
            <AnualResumenChart data={resumenAnual} />
            <div className="overflow-x-auto mt-4 -mx-5">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left" style={{ color: C.textMute, borderBottom: `1px solid ${C.cardBorder}` }}>
                    <th className="px-5 py-2 font-semibold">Mes</th>
                    <th className="px-3 py-2 font-semibold text-right">Facturado</th>
                    <th className="px-3 py-2 font-semibold text-right">Recaudado</th>
                    <th className="px-3 py-2 font-semibold text-right">Cartera Total</th>
                    <th className="px-3 py-2 font-semibold text-right">% Recaudo</th>
                    <th className="px-3 py-2 font-semibold text-right">% Cartera Morosa</th>
                    <th className="px-5 py-2 font-semibold text-right">Morosos</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenAnual.map((r) => {
                    const tonePct = r.pct_recaudo >= 0.85 ? C.green : r.pct_recaudo >= 0.70 ? C.amber : C.red;
                    return (
                      <tr key={r.periodo} style={{ borderBottom: `1px solid ${C.ivory}` }}>
                        <td className="px-5 py-2.5 font-semibold" style={{ color: C.navyDark }}>{fmtPeriodo(r.periodo)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: C.text }}>{fmtMoney(r.facturado)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: C.green }}>{fmtMoney(r.recaudado)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: C.red }}>{fmtMoney(r.cartera_total)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: tonePct }}>{fmtPct(r.pct_recaudo)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: C.goldDark }}>{fmtPct(r.pct_morosa)}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums" style={{ color: C.text }}>{r.n_morosos}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* ====== PANEL 5: EDADES DE CARTERA (aging real) ====== */}
      {aging && (
        <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
          <PanelHead n={5} title="Edades de Cartera" desc="Reporte de antigüedad por unidad al corte" />
          <AgingReporte data={aging} total_unidades={filas.length} />
        </section>
      )}

      {/* ====== PANEL 6: DETALLE POR UNIDAD ====== */}
      <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
        <PanelHead n={aging ? 6 : 5} title="Detalle por Unidad" desc="Facturación, pago y estado de mora de cada casa" />
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left" style={{ color: C.textMute, borderBottom: `1px solid ${C.cardBorder}` }}>
                <th className="px-5 py-2 font-semibold">Casa</th>
                <th className="px-3 py-2 font-semibold">Propietario</th>
                <th className="px-3 py-2 font-semibold text-right">Cuota</th>
                <th className="px-3 py-2 font-semibold text-right">Facturado</th>
                <th className="px-3 py-2 font-semibold text-right">Pagado</th>
                <th className="px-3 py-2 font-semibold text-right">Pendiente</th>
                <th className="px-5 py-2 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {conMora
                .sort((a, b) => b.cuenta_pendiente - a.cuenta_pendiente)
                .map((r) => (
                  <tr key={r.unidad} style={{ borderBottom: `1px solid ${C.ivory}` }}>
                    <td className="px-5 py-2.5 font-semibold" style={{ color: C.navyDark }}>{r.unidad}</td>
                    <td className="px-3 py-2.5 truncate max-w-[200px]" style={{ color: C.text }}>{r.propietario}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: C.text }}>{fmtMoney(r.administracion)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: C.text }}>{fmtMoney(r.valor_facturado)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: C.text }}>{fmtMoney(r.valor_pagado)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: r.cuenta_pendiente > 0 ? C.red : C.green }}>
                      {fmtMoney(r.cuenta_pendiente)}
                    </td>
                    <td className="px-5 py-2.5">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ background: `${RANGO_COLOR[r.rango]}1A`, color: RANGO_COLOR[r.rango] }}
                      >
                        {r.rango}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
