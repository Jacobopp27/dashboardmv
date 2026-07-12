import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, Target } from "lucide-react";
import { api, type EjecucionPpto, type FlujoDetallado, type LineaFlujo, type ResultadoMes, type SaldoMes } from "@/lib/api";
import { fmtMesCorto, fmtMoney, fmtPct, fmtPeriodo } from "@/lib/format";

interface Props {
  saldos: SaldoMes[];
  resultados: ResultadoMes[];
  añosDisponibles: number[];
}

// Paleta ejecutiva — alineada con resto del dashboard
const C = {
  navy:       "#0F2438",
  navyDark:   "#091A2C",
  gold:       "#C9A55C",
  ivory:      "#FAF7F0",
  green:      "#1E7A4F",
  red:        "#B43A3A",
  amber:      "#C97A1E",
  cardBorder: "#E5E1D6",
  textMute:   "#5A6470",
  text:       "#0F2438",
  entrada:    "#1E5A8C",  // azul para entradas
  salida:     "#B43A3A",  // rojo para salidas
  saldo:      "#C9A55C",  // dorado para línea de saldo acumulado
};

export function FlujoDeCajaView({ saldos: saldosProp, resultados, añosDisponibles }: Props) {
  // Para la tabla dinámica: cargar el presupuesto anual por categoría
  const [ejecucionAño, setEjecucionAño] = useState<EjecucionPpto[]>([]);
  const [flujoDet, setFlujoDet] = useState<FlujoDetallado | null>(null);
  // Selector de año
  const añosOrdenados = useMemo(
    () => añosDisponibles.length > 0
      ? [...añosDisponibles].sort()
      : Array.from(new Set(saldosProp.map(s => Number(s.periodo.split("-")[0])))).sort(),
    [añosDisponibles, saldosProp],
  );
  const [añoElegido, setAñoElegido] = useState<string | null>(null);
  const añoFiltro = añoElegido ?? String(añosOrdenados[añosOrdenados.length - 1] ?? "");

  // Cargar saldos del año seleccionado (el padre puede traer otro año por filtro global)
  const [saldosAño, setSaldosAño] = useState<SaldoMes[]>([]);
  useEffect(() => {
    if (!añoFiltro) return;
    api.finSaldos(Number(añoFiltro)).then(setSaldosAño).catch(() => setSaldosAño([]));
    api.finEjecucionPpto(Number(añoFiltro)).then(setEjecucionAño).catch(() => setEjecucionAño([]));
    api.finFlujoDetallado(Number(añoFiltro)).then(setFlujoDet).catch(() => setFlujoDet(null));
  }, [añoFiltro]);
  const saldos = saldosAño.length > 0 ? saldosAño : saldosProp;

  // Resultados del año filtrado
  const resultadosAño = useMemo(
    () => resultados
      .filter(r => r.periodo.startsWith(añoFiltro))
      .sort((a, b) => a.periodo.localeCompare(b.periodo)),
    [resultados, añoFiltro],
  );

  // Saldos del año filtrado, ordenados
  const saldosAñoOrden = useMemo(
    () => saldos
      .filter(s => s.periodo.startsWith(añoFiltro))
      .sort((a, b) => a.periodo.localeCompare(b.periodo)),
    [saldos, añoFiltro],
  );

  // ===== Construcción del flujo de caja mensual =====
  /** Para cada mes con datos: saldo inicial (saldo anterior), entradas (recaudo del mes),
   *  salidas (egresos del mes), flujo neto, saldo final (saldo del mes según balance). */
  const flujo = useMemo(() => {
    const out: Array<{
      mes: string;
      periodo: string;
      saldoInicial: number;
      entradasCuotas: number;
      entradasOtros: number;
      entradasTotal: number;
      salidas: number;
      flujoNeto: number;
      saldoFinal: number;
      diferencia: number; // (saldoFinal real) − (saldoInicial + flujoNeto)
    }> = [];

    let saldoInicial = 0;
    // Saldo inicial del año: tomar el saldo previo más cercano (mes anterior o diciembre año previo)
    if (saldosAñoOrden.length > 0) {
      const idxFirst = saldos.findIndex(s => s.periodo === saldosAñoOrden[0].periodo);
      saldoInicial = idxFirst > 0 ? saldos[idxFirst - 1].disponible_total : 0;
    }

    for (const r of resultadosAño) {
      const s = saldosAñoOrden.find(x => x.periodo === r.periodo);
      const entradasCuotas = r.ingreso_operacional ?? 0;
      const entradasOtros  = r.ingreso_marginal ?? 0;
      const entradasTotal  = entradasCuotas + entradasOtros;
      const salidas        = r.egreso_total_egresos ?? 0;
      const flujoNeto      = entradasTotal - salidas;
      const saldoFinal     = s?.disponible_total ?? (saldoInicial + flujoNeto);
      const diferencia     = saldoFinal - (saldoInicial + flujoNeto);

      // Solo agregar si hay actividad (entradas o salidas > 0)
      if (entradasTotal > 0 || salidas > 0 || (s && s.disponible_total > 0)) {
        out.push({
          mes: fmtMesCorto(r.periodo),
          periodo: r.periodo,
          saldoInicial,
          entradasCuotas,
          entradasOtros,
          entradasTotal,
          salidas,
          flujoNeto,
          saldoFinal,
          diferencia,
        });
      }

      saldoInicial = saldoFinal;
    }
    return out;
  }, [resultadosAño, saldosAñoOrden, saldos]);

  // ===== Totales del año =====
  const totales = useMemo(() => {
    const totalEntradas = flujo.reduce((s, m) => s + m.entradasTotal, 0);
    const totalSalidas  = flujo.reduce((s, m) => s + m.salidas, 0);
    const flujoNetoAño  = totalEntradas - totalSalidas;
    const saldoInicialAño = flujo[0]?.saldoInicial ?? 0;
    const saldoFinalAño   = flujo[flujo.length - 1]?.saldoFinal ?? 0;
    return { totalEntradas, totalSalidas, flujoNetoAño, saldoInicialAño, saldoFinalAño, nMeses: flujo.length };
  }, [flujo]);

  // ===== Saldo más bajo (mes crítico) =====
  const mesCritico = useMemo(() => {
    if (flujo.length === 0) return null;
    return flujo.reduce((min, m) => (m.saldoFinal < min.saldoFinal ? m : min), flujo[0]);
  }, [flujo]);

  // ===== Datos del gráfico (incluyendo saldo acumulado) =====
  const dataGrafico = flujo.map(m => ({
    mes: m.mes,
    periodo: m.periodo,
    Entradas: m.entradasTotal,
    Salidas: -m.salidas,  // negativo para que vaya hacia abajo
    "Saldo final": m.saldoFinal,
    "Flujo neto": m.flujoNeto,
  }));

  // ===== Conclusión para el Consejo =====
  const conclusion = (() => {
    if (totales.nMeses === 0) return { tipo: "amber" as const, texto: "Sin datos de flujo de caja para el año seleccionado." };
    if (totales.flujoNetoAño > 0 && totales.saldoFinalAño > totales.saldoInicialAño) {
      return { tipo: "positivo" as const, texto: "El año cierra con flujo de caja positivo y aumento de la posición disponible. Liquidez bajo control." };
    }
    if (totales.flujoNetoAño < 0 && totales.saldoFinalAño > 5_000_000) {
      return { tipo: "amber" as const, texto: "Flujo neto negativo: se consumió parte del saldo acumulado, aunque la liquidez aún se mantiene en niveles operativos." };
    }
    return { tipo: "rojo" as const, texto: "Flujo neto negativo con erosión del saldo disponible. Requiere acción para asegurar la liquidez operativa." };
  })();
  const conclusionColor = conclusion.tipo === "positivo" ? C.green : conclusion.tipo === "amber" ? C.amber : C.red;
  const ConclusionIcon = conclusion.tipo === "positivo" ? CheckCircle2 : conclusion.tipo === "amber" ? Target : AlertTriangle;

  if (flujo.length === 0) {
    return (
      <section className="bg-white rounded-2xl p-6 border" style={{ borderColor: C.cardBorder, fontFamily: "Segoe UI, system-ui, sans-serif" }}>
        <h2 className="text-[18px] font-bold mb-2" style={{ color: C.navyDark }}>Flujo de Caja</h2>
        <p className="text-[13px]" style={{ color: C.textMute }}>
          Sin datos de flujo para el año seleccionado.
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
              Flujo de Caja
            </h1>
            <p className="text-[12.5px] mt-1" style={{ color: "#D4D4D8" }}>
              Movimientos de efectivo · Año fiscal <span className="font-semibold text-white">{añoFiltro}</span>
              <span className="mx-2 opacity-50">·</span>
              <span className="font-semibold text-white">{totales.nMeses}</span> {totales.nMeses === 1 ? "mes" : "meses"} con datos
            </p>
          </div>
          <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(201,165,92,0.35)" }}>
            <label className="block text-[9px] uppercase tracking-[0.18em] font-bold mb-1" style={{ color: C.gold }}>Año fiscal</label>
            <select
              value={añoFiltro}
              onChange={(e) => setAñoElegido(e.target.value)}
              className="bg-transparent text-[14px] font-bold text-white focus:outline-none cursor-pointer pr-1"
              style={{ minWidth: 70 }}
            >
              {añosOrdenados.map(a => (
                <option key={a} value={a} className="bg-white" style={{ color: C.navyDark }}>{a}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* ====== RESUMEN EJECUTIVO ====== */}
      <section className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: C.cardBorder, borderLeft: `6px solid ${C.gold}` }}>
        <div className="p-5 lg:p-6">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="w-1 h-5 rounded-sm" style={{ background: C.gold }} />
            <h2 className="text-[14px] font-bold uppercase tracking-wider" style={{ color: C.navyDark }}>Resumen ejecutivo</h2>
            <span className="text-[10.5px] ml-1 px-2 py-0.5 rounded" style={{ background: C.ivory, color: C.textMute, border: `1px solid ${C.cardBorder}` }}>
              Para el Consejo
            </span>
          </div>

          {/* 4 cifras destacadas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
            <CifraFlujo
              label="Saldo inicial"
              valor={totales.saldoInicialAño}
              hint={flujo[0] ? `al inicio de ${fmtPeriodo(flujo[0].periodo)}` : ""}
              color={C.navy}
            />
            <CifraFlujo
              label="Entradas del año"
              valor={totales.totalEntradas}
              hint={`Cuotas + marginales · ${totales.nMeses} meses`}
              color={C.entrada}
              prefix="+"
            />
            <CifraFlujo
              label="Salidas del año"
              valor={-totales.totalSalidas}
              hint={`Egresos operacionales · ${totales.nMeses} meses`}
              color={C.salida}
            />
            <CifraFlujo
              label="Saldo final"
              valor={totales.saldoFinalAño}
              hint={flujo[flujo.length - 1] ? `al cierre de ${fmtPeriodo(flujo[flujo.length - 1].periodo)}` : ""}
              color={totales.saldoFinalAño >= totales.saldoInicialAño ? C.green : C.red}
              delta={totales.saldoFinalAño - totales.saldoInicialAño}
            />
          </div>

          {/* Bloque narrativo */}
          <div className="space-y-2 text-[13px] leading-relaxed" style={{ color: C.text }}>
            <p>
              Durante <strong>{añoFiltro}</strong> ({totales.nMeses} {totales.nMeses === 1 ? "mes" : "meses"} con datos),
              la copropiedad recibió <strong style={{ color: C.entrada }}>{fmtMoney(totales.totalEntradas, { compact: true })}</strong> en entradas y desembolsó{" "}
              <strong style={{ color: C.salida }}>{fmtMoney(totales.totalSalidas, { compact: true })}</strong> en salidas,
              generando un <strong>flujo neto de </strong>
              {totales.flujoNetoAño >= 0
                ? <strong style={{ color: C.green }}>+{fmtMoney(totales.flujoNetoAño, { compact: true })}</strong>
                : <strong style={{ color: C.red }}>{fmtMoney(totales.flujoNetoAño, { compact: true })}</strong>}.
            </p>
            <p>
              <strong>Posición disponible:</strong> partió en <strong>{fmtMoney(totales.saldoInicialAño, { compact: true })}</strong>{" "}
              y cerró en <strong>{fmtMoney(totales.saldoFinalAño, { compact: true })}</strong>,
              {" "}lo que representa un cambio de{" "}
              <strong style={{ color: totales.saldoFinalAño >= totales.saldoInicialAño ? C.green : C.red }}>
                {totales.saldoFinalAño - totales.saldoInicialAño >= 0 ? "+" : ""}
                {fmtMoney(totales.saldoFinalAño - totales.saldoInicialAño, { compact: true })}
              </strong> en la liquidez operativa.
            </p>
            {mesCritico && (
              <p>
                <strong>Mes con menor liquidez:</strong>{" "}
                <strong style={{ color: C.amber }}>{fmtPeriodo(mesCritico.periodo)}</strong>{" "}
                con un saldo final de <strong>{fmtMoney(mesCritico.saldoFinal, { compact: true })}</strong>.
              </p>
            )}
          </div>

          {/* Conclusión */}
          <div className="mt-4 p-3 rounded-lg flex items-start gap-3" style={{ background: `${conclusionColor}0F`, borderLeft: `3px solid ${conclusionColor}` }}>
            <div className="w-7 h-7 rounded-md flex items-center justify-center text-white shrink-0" style={{ background: conclusionColor }}>
              <ConclusionIcon size={14} />
            </div>
            <div className="flex-1">
              <div className="text-[10.5px] uppercase tracking-wider font-bold" style={{ color: conclusionColor }}>Lectura para el Consejo</div>
              <div className="text-[13px] font-semibold mt-0.5" style={{ color: C.navyDark }}>{conclusion.texto}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== GRÁFICO ENTRADAS/SALIDAS + SALDO ====== */}
      <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-sm" style={{ background: C.gold }} />
            <h2 className="text-[14px] font-bold uppercase tracking-wider" style={{ color: C.navyDark }}>
              Movimientos mensuales · {añoFiltro}
            </h2>
          </div>
          <div className="flex items-center gap-3 text-[11px]" style={{ color: C.textMute }}>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: C.entrada }} />Entradas</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: C.salida }} />Salidas</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5" style={{ background: C.saldo }} />Saldo final</span>
          </div>
        </div>
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dataGrafico} margin={{ top: 20, right: 18, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.saldo} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={C.saldo} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: C.text, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => fmtMoney(Math.abs(v), { compact: true })} tick={{ fontSize: 10, fill: C.textMute }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number, name: string) => [fmtMoney(Math.abs(v)), name]}
                labelFormatter={(_l, payload) => payload?.[0]?.payload?.periodo ? fmtPeriodo(payload[0].payload.periodo) : ""}
                contentStyle={{ borderRadius: 8, border: `1px solid ${C.cardBorder}`, fontSize: 12, fontFamily: "Segoe UI" }}
              />
              <ReferenceLine y={0} stroke={C.navy} strokeOpacity={0.4} />
              <Area type="monotone" dataKey="Saldo final" fill="url(#gradSaldo)" stroke="none" legendType="none" />
              <Bar dataKey="Entradas" fill={C.entrada} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Salidas"  fill={C.salida}  radius={[0, 0, 4, 4]} />
              <Line type="monotone" dataKey="Saldo final" stroke={C.saldo} strokeWidth={2.5} dot={{ r: 3.5, fill: C.saldo, stroke: "white", strokeWidth: 1.5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ====== TABLA DETALLADA ====== */}
      <section className="bg-white rounded-2xl p-5 lg:p-6 border overflow-hidden" style={{ borderColor: C.cardBorder }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-sm" style={{ background: C.gold }} />
          <h2 className="text-[14px] font-bold uppercase tracking-wider" style={{ color: C.navyDark }}>
            Detalle mensual del flujo
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]" style={{ color: C.text }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.navy}` }}>
                <th className="px-3 py-2.5 text-left font-bold uppercase text-[10.5px] tracking-wider" style={{ color: C.navy }}>Mes</th>
                <th className="px-3 py-2.5 text-right font-bold uppercase text-[10.5px] tracking-wider" style={{ color: C.navy }}>Saldo inicial</th>
                <th className="px-3 py-2.5 text-right font-bold uppercase text-[10.5px] tracking-wider" style={{ color: C.entrada }}>(+) Entradas</th>
                <th className="px-3 py-2.5 text-right font-bold uppercase text-[10.5px] tracking-wider" style={{ color: C.salida }}>(−) Salidas</th>
                <th className="px-3 py-2.5 text-right font-bold uppercase text-[10.5px] tracking-wider" style={{ color: C.navy }}>Flujo neto</th>
                <th className="px-3 py-2.5 text-right font-bold uppercase text-[10.5px] tracking-wider" style={{ color: C.gold }}>Saldo final</th>
              </tr>
            </thead>
            <tbody>
              {flujo.map((m) => {
                const flujoColor = m.flujoNeto >= 0 ? C.green : C.red;
                const flujoBg    = m.flujoNeto >= 0 ? "rgba(30,122,79,0.06)" : "rgba(180,58,58,0.06)";
                return (
                  <tr key={m.periodo} style={{ borderBottom: `1px solid ${C.cardBorder}` }} className="hover:bg-deepgreen-50/30">
                    <td className="px-3 py-2 font-semibold" style={{ color: C.navyDark }}>{fmtPeriodo(m.periodo)}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: C.textMute }}>{fmtMoney(m.saldoInicial, { compact: true })}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ color: C.entrada }}>
                      +{fmtMoney(m.entradasTotal, { compact: true })}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ color: C.salida }}>
                      −{fmtMoney(m.salidas, { compact: true })}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ background: flujoBg, color: flujoColor }}>
                      <span className="inline-flex items-center gap-0.5">
                        {m.flujoNeto >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                        {m.flujoNeto >= 0 ? "+" : ""}{fmtMoney(m.flujoNeto, { compact: true })}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ color: C.navyDark }}>{fmtMoney(m.saldoFinal, { compact: true })}</td>
                  </tr>
                );
              })}
              {/* Fila total */}
              <tr style={{ background: "rgba(15,36,56,0.06)", borderTop: `3px solid ${C.navy}` }}>
                <td className="px-3 py-3 font-bold text-[13px]" style={{ color: C.navyDark }}>TOTAL {añoFiltro}</td>
                <td className="px-3 py-3 text-right tabular-nums font-bold" style={{ color: C.navyDark }}>{fmtMoney(totales.saldoInicialAño, { compact: true })}</td>
                <td className="px-3 py-3 text-right tabular-nums font-bold" style={{ color: C.entrada }}>+{fmtMoney(totales.totalEntradas, { compact: true })}</td>
                <td className="px-3 py-3 text-right tabular-nums font-bold" style={{ color: C.salida }}>−{fmtMoney(totales.totalSalidas, { compact: true })}</td>
                <td className="px-3 py-3 text-right tabular-nums font-bold text-[13px]" style={{
                  background: totales.flujoNetoAño >= 0 ? "rgba(30,122,79,0.12)" : "rgba(180,58,58,0.12)",
                  color: totales.flujoNetoAño >= 0 ? C.green : C.red,
                }}>
                  {totales.flujoNetoAño >= 0 ? "+" : ""}{fmtMoney(totales.flujoNetoAño, { compact: true })}
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-bold text-[13px]" style={{ color: C.navyDark }}>{fmtMoney(totales.saldoFinalAño, { compact: true })}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[10.5px] mt-3" style={{ color: C.textMute, fontStyle: "italic" }}>
          Pasa el cursor sobre los valores para ver el monto completo. El "saldo final" se toma directamente del ESFA mensual; el "flujo neto" se calcula como entradas − salidas del estado de resultados.
        </p>
      </section>

      {/* ====== TABLA DINÁMICA: Proyección anual por concepto (12 meses, detallada) ====== */}
      <TablaDinamicaFlujo
        año={añoFiltro}
        flujoDet={flujoDet}
        saldoInicialAño={totales.saldoInicialAño}
      />
    </div>
  );
}

function CifraFlujo({
  label, valor, hint, color, prefix, delta,
}: {
  label: string; valor: number; hint?: string; color: string; prefix?: string; delta?: number;
}) {
  return (
    <div className="rounded-lg p-3 border min-w-0 overflow-hidden" style={{ borderColor: C.cardBorder, background: C.ivory }}>
      <div className="text-[10px] uppercase tracking-wider font-bold mb-0.5 truncate" style={{ color: C.textMute }}>{label}</div>
      <div
        className="font-bold tabular-nums leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
        style={{ color, fontSize: "clamp(0.95rem, 1.6vw, 1.2rem)" }}
        title={fmtMoney(valor)}
      >
        {prefix}{fmtMoney(valor, { compact: true })}
      </div>
      {delta !== undefined && (
        <div className="flex items-center gap-1 mt-1">
          {delta >= 0 ? <ArrowUpRight size={10} style={{ color: C.green }} /> : <ArrowDownRight size={10} style={{ color: C.red }} />}
          <span className="text-[10.5px] font-bold tabular-nums" style={{ color: delta >= 0 ? C.green : C.red }}>
            {delta >= 0 ? "+" : ""}{fmtMoney(delta, { compact: true })}
          </span>
        </div>
      )}
      {hint && <div className="text-[9.5px] mt-0.5 truncate" style={{ color: C.textMute }}>{hint}</div>}
    </div>
  );
}

/* ============ TABLA DINÁMICA PROYECCIÓN — SUB-CATEGORÍAS DETALLADAS ============ */

const MESES_LARGO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Orden estándar de las secciones de gastos (como en el Excel modelo)
const SECCIONES_ORDEN = ["MANTENIMIENTO", "SEGURIDAD", "CONVIVENCIA", "AMBIENTAL", "ADMINISTRATIVOS"] as const;

// Líneas de ingreso adicionales NO presentes en el estado de resultados pero
// usadas en el flujo de caja proyectado del Excel. Se muestran con cero por
// defecto para que el Consejo pueda llenarlas a mano si lo desea (proyección).
const INGRESOS_ADICIONALES = [
  "RETROACTIVO",
  "CARTERA MES ANTERIOR",
  "CUOTA EXTRA",
  "SALDO INICIAL BANCOS",
] as const;

function TablaDinamicaFlujo({
  año, flujoDet, saldoInicialAño,
}: {
  año: string;
  flujoDet: FlujoDetallado | null;
  saldoInicialAño: number;
}) {
  // Calcular qué meses tienen datos reales: alguno de gastos > 0
  const mesesConDatos = useMemo(() => {
    const set = new Set<number>();
    if (flujoDet) {
      for (const g of flujoDet.gastos) {
        for (const [m, v] of Object.entries(g.meses)) {
          if (v > 0) set.add(Number(m));
        }
      }
    }
    return set;
  }, [flujoDet]);

  // Mes de corte: el último mes con datos reales (default)
  const ultimoReal = useMemo(() => {
    return mesesConDatos.size > 0 ? Math.max(...Array.from(mesesConDatos)) : 0;
  }, [mesesConDatos]);
  const [mesCorte, setMesCorte] = useState<number | null>(null);
  const mesCorteEfectivo = mesCorte ?? ultimoReal;
  // Filtro de vista: ambos | solo real ejecutado | solo proyección
  const [vista, setVista] = useState<"ambos" | "real" | "proyeccion">("ambos");

  // Reset mes elegido cuando cambia el año (vía cambio de flujoDet)
  useEffect(() => { setMesCorte(null); }, [año]);

  // Índices de meses visibles según vista seleccionada (0..11) — debe ir ANTES del early return
  const mesesVisibles: number[] = useMemo(() => {
    const all = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    if (vista === "real")       return all.filter(i => i + 1 <= mesCorteEfectivo);
    if (vista === "proyeccion") return all.filter(i => i + 1 > mesCorteEfectivo);
    return all;
  }, [vista, mesCorteEfectivo]);

  // Early return cuando no hay datos
  if (!flujoDet || (flujoDet.ingresos.length === 0 && flujoDet.gastos.length === 0)) {
    return null;
  }

  // Agrupar gastos por sección
  const gastosPorSeccion: Record<string, LineaFlujo[]> = {};
  for (const g of flujoDet.gastos) {
    const sec = g.categoria || "OTROS";
    if (!gastosPorSeccion[sec]) gastosPorSeccion[sec] = [];
    gastosPorSeccion[sec].push(g);
  }

  // Función: obtener el valor de un mes — real si mes ≤ corte, proyección si > corte
  const valorPara = (linea: LineaFlujo, mes: number): number => {
    if (mes <= mesCorteEfectivo) {
      // REAL del Excel
      return linea.meses[String(mes)] ?? 0;
    }
    // PROYECCIÓN: promedio de los meses con datos reales
    const realesValores = Array.from(mesesConDatos)
      .filter(m => m <= mesCorteEfectivo)
      .map(m => linea.meses[String(m)] ?? 0)
      .filter(v => v > 0);
    if (realesValores.length > 0) {
      return realesValores.reduce((s, v) => s + v, 0) / realesValores.length;
    }
    // Fallback: presupuesto anual / 12
    return linea.presupuesto_anual > 0 ? linea.presupuesto_anual / 12 : (linea.presupuesto_mes || 0);
  };

  // Total por mes para ingresos + adicionales (filas a mano con 0)
  const totalIngresosPorMes = (mes: number): number => {
    let s = 0;
    for (const i of flujoDet.ingresos) s += valorPara(i, mes);
    return s;
  };

  // Total por mes para una sección de gasto
  const totalSeccionPorMes = (seccion: string, mes: number): number => {
    const lineas = gastosPorSeccion[seccion] ?? [];
    let s = 0;
    for (const l of lineas) s += valorPara(l, mes);
    return s;
  };

  // Total gastos por mes
  const totalGastosPorMes = (mes: number): number => {
    let s = 0;
    for (const sec of SECCIONES_ORDEN) s += totalSeccionPorMes(sec, mes);
    return s;
  };

  // Acumulado del año (suma de los 12 meses)
  const acumAño = (fn: (mes: number) => number): number => {
    let s = 0;
    for (let m = 1; m <= 12; m++) s += fn(m);
    return s;
  };

  return (
    <section className="bg-white rounded-2xl p-5 lg:p-6 border overflow-hidden" style={{ borderColor: C.cardBorder }}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-sm" style={{ background: C.gold }} />
          <h2 className="text-[14px] font-bold uppercase tracking-wider" style={{ color: C.navyDark }}>
            Proyección detallada {año} · Flujo de caja
          </h2>
          <span className="text-[10.5px] ml-1 px-2 py-0.5 rounded" style={{ background: C.ivory, color: C.textMute, border: `1px solid ${C.cardBorder}` }}>
            Sub-categorías individuales
          </span>
        </div>
        {/* Selectores de vista + mes de corte */}
        <div className="flex items-stretch gap-2 flex-wrap">
          {/* Toggle Real / Ambos / Proyección */}
          <div className="flex bg-deepgreen-50 rounded-lg p-0.5 border" style={{ borderColor: C.cardBorder }}>
            {([
              { key: "real",       label: "Real ejecutado",  bg: "rgba(15,36,56,0.10)",  color: C.navyDark },
              { key: "ambos",      label: "Ambos",            bg: "transparent",          color: C.navyDark },
              { key: "proyeccion", label: "Proyección",       bg: "rgba(201,165,92,0.18)",color: C.navyDark },
            ] as const).map(opt => (
              <button
                key={opt.key}
                onClick={() => setVista(opt.key)}
                className="px-2.5 py-1 rounded-md text-[11px] font-bold transition-all"
                style={{
                  background: vista === opt.key ? "white" : "transparent",
                  color: vista === opt.key ? C.navyDark : C.textMute,
                  boxShadow: vista === opt.key ? "0 1px 3px rgba(0,0,0,0.10)" : "none",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Selector de mes de corte */}
          <div className="flex items-center gap-1.5 bg-white border rounded-lg px-2.5 py-1.5" style={{ borderColor: C.cardBorder }}>
            <label className="text-[9.5px] uppercase tracking-wider font-bold" style={{ color: C.textMute }}>Mes de corte</label>
            <select
              value={mesCorteEfectivo}
              onChange={(e) => setMesCorte(parseInt(e.target.value, 10))}
              className="bg-transparent text-[12.5px] font-bold focus:outline-none cursor-pointer"
              style={{ color: C.navyDark }}
            >
              {MESES_LARGO.map((m, i) => (
                <option key={m} value={i + 1}>{m} {año}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10.5px] mb-2" style={{ color: C.textMute }}>
        {vista !== "proyeccion" && (
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(15,36,56,0.10)" }} />Real ejecutado (≤ {MESES_LARGO[mesCorteEfectivo - 1]})</span>
        )}
        {vista !== "real" && (
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm border" style={{ borderColor: C.cardBorder, background: "white" }} />Proyección (&gt; {MESES_LARGO[mesCorteEfectivo - 1]})</span>
        )}
        <span className="ml-auto text-[10px]" style={{ color: C.textMute }}>
          Vista: <strong style={{ color: C.navyDark }}>{vista === "ambos" ? "Real + Proyección" : vista === "real" ? "Solo real ejecutado" : "Solo proyección"}</strong>
        </span>
      </div>


      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: C.cardBorder }}>
        <table className="text-[10.5px] tabular-nums" style={{ color: C.text, minWidth: 1300, width: "100%" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.navy}`, background: C.ivory }}>
              <th className="px-2.5 py-2 text-left font-bold uppercase text-[9.5px] tracking-wider sticky left-0 z-10 bg-[#FAF7F0]" style={{ color: C.navy, minWidth: 240 }}>Concepto</th>
              <th className="px-2 py-2 text-right font-bold uppercase text-[9px] tracking-wider whitespace-nowrap" style={{ color: C.navy }}>Mensual {año}</th>
              {mesesVisibles.map(i => {
                const m = MESES_LARGO[i];
                const real = i + 1 <= mesCorteEfectivo;
                return (
                  <th key={m} className="px-2 py-2 text-right font-bold uppercase text-[9px] tracking-wider whitespace-nowrap" style={{ color: real ? C.navy : C.textMute, background: real ? "rgba(15,36,56,0.05)" : "transparent" }}>
                    {m}
                  </th>
                );
              })}
              <th className="px-2.5 py-2 text-right font-bold uppercase text-[9px] tracking-wider whitespace-nowrap" style={{ color: C.gold, background: "rgba(201,165,92,0.08)" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {/* === INGRESOS OPERACIONALES === */}
            <SectionHeader label="INGRESOS OPERACIONALES" color={C.entrada} bg="rgba(30,90,140,0.06)" colSpan={mesesVisibles.length + 3} />
            {flujoDet.ingresos.map((l, i) => (
              <FilaDetalle key={`ing-${i}`} linea={l} mesCorte={mesCorteEfectivo} valorPara={valorPara} color={C.entrada} mesesVisibles={mesesVisibles} />
            ))}
            {/* Líneas de ingreso adicionales (vacías por defecto, para proyección manual) */}
            {INGRESOS_ADICIONALES.map((label) => (
              <FilaVacia key={label} label={label} mesCorte={mesCorteEfectivo} mesesVisibles={mesesVisibles}
                valorSaldoInicial={label === "SALDO INICIAL BANCOS" ? saldoInicialAño : 0} />
            ))}
            {/* TOTAL INGRESOS */}
            <tr style={{ borderTop: `2px solid ${C.entrada}`, background: "rgba(30,90,140,0.10)" }}>
              <td className="px-2.5 py-2 font-bold uppercase tracking-wider sticky left-0 z-10" style={{ color: C.entrada, background: "rgba(30,90,140,0.10)" }}>TOTAL INGRESOS</td>
              <td className="px-2 py-2 text-right font-bold whitespace-nowrap" style={{ color: C.entrada }}>
                {fmtMoney(flujoDet.ingresos.reduce((s, i) => s + (i.presupuesto_mes || i.presupuesto_anual / 12), 0), { compact: true })}
              </td>
              {mesesVisibles.map(i => {
                const mes = i + 1;
                const v = totalIngresosPorMes(mes) + (mes === 1 ? saldoInicialAño : 0);
                return (
                  <td key={mes} className="px-2 py-2 text-right font-bold whitespace-nowrap" style={{ color: C.entrada, background: mes <= mesCorteEfectivo ? "rgba(15,36,56,0.05)" : undefined }}>
                    {fmtMoney(v, { compact: true })}
                  </td>
                );
              })}
              <td className="px-2.5 py-2 text-right font-bold whitespace-nowrap" style={{ color: C.entrada, background: "rgba(201,165,92,0.10)" }}>
                {fmtMoney(acumAño(totalIngresosPorMes) + saldoInicialAño, { compact: true })}
              </td>
            </tr>

            {/* === GASTOS OPERACIONALES === */}
            <SectionHeader label="GASTOS OPERACIONALES" color={C.salida} bg="rgba(180,58,58,0.06)" colSpan={mesesVisibles.length + 3} />
            {SECCIONES_ORDEN.map(seccion => {
              const lineas = gastosPorSeccion[seccion] ?? [];
              if (lineas.length === 0) return null;
              return (
                <React.Fragment key={`sec-${seccion}`}>
                  <SubsectionHeader label={seccion} colSpan={mesesVisibles.length + 3} />
                  {lineas.map((l, i) => (
                    <FilaDetalle key={`${seccion}-${i}`} linea={l} mesCorte={mesCorteEfectivo} valorPara={valorPara} color={C.salida} mesesVisibles={mesesVisibles} />
                  ))}
                  {/* Subtotal de la sección */}
                  <tr key={`tot-${seccion}`} style={{ borderTop: `1px solid ${C.cardBorder}`, background: "rgba(180,58,58,0.05)" }}>
                    <td className="px-2.5 py-1.5 font-bold sticky left-0 z-10" style={{ color: C.salida, background: "rgba(180,58,58,0.05)", paddingLeft: 24 }}>
                      Total {seccion.charAt(0) + seccion.slice(1).toLowerCase()}
                    </td>
                    <td className="px-2 py-1.5 text-right font-bold whitespace-nowrap" style={{ color: C.salida }}>
                      {fmtMoney(lineas.reduce((s, l) => s + (l.presupuesto_mes || l.presupuesto_anual / 12), 0), { compact: true })}
                    </td>
                    {mesesVisibles.map(i => {
                      const mes = i + 1;
                      return (
                        <td key={mes} className="px-2 py-1.5 text-right font-bold whitespace-nowrap" style={{ color: C.salida, background: mes <= mesCorteEfectivo ? "rgba(15,36,56,0.05)" : undefined }}>
                          {fmtMoney(totalSeccionPorMes(seccion, mes), { compact: true })}
                        </td>
                      );
                    })}
                    <td className="px-2.5 py-1.5 text-right font-bold whitespace-nowrap" style={{ color: C.salida, background: "rgba(201,165,92,0.10)" }}>
                      {fmtMoney(acumAño(m => totalSeccionPorMes(seccion, m)), { compact: true })}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
            {/* TOTAL GASTOS */}
            <tr style={{ borderTop: `2px solid ${C.salida}`, background: "rgba(180,58,58,0.10)" }}>
              <td className="px-2.5 py-2 font-bold uppercase tracking-wider sticky left-0 z-10" style={{ color: C.salida, background: "rgba(180,58,58,0.10)" }}>TOTAL GASTOS</td>
              <td className="px-2 py-2 text-right font-bold whitespace-nowrap" style={{ color: C.salida }}>
                {fmtMoney(flujoDet.gastos.reduce((s, g) => s + (g.presupuesto_mes || g.presupuesto_anual / 12), 0), { compact: true })}
              </td>
              {mesesVisibles.map(i => (
                <td key={i + 1} className="px-2 py-2 text-right font-bold whitespace-nowrap" style={{ color: C.salida, background: i + 1 <= mesCorteEfectivo ? "rgba(15,36,56,0.05)" : undefined }}>
                  {fmtMoney(totalGastosPorMes(i + 1), { compact: true })}
                </td>
              ))}
              <td className="px-2.5 py-2 text-right font-bold whitespace-nowrap" style={{ color: C.salida, background: "rgba(201,165,92,0.10)" }}>
                {fmtMoney(acumAño(totalGastosPorMes), { compact: true })}
              </td>
            </tr>

            {/* FLUJO NETO */}
            <tr style={{ borderTop: `3px solid ${C.navy}`, background: "rgba(15,36,56,0.10)" }}>
              <td className="px-2.5 py-2 font-bold text-[11px] uppercase tracking-wider sticky left-0 z-10" style={{ color: C.navyDark, background: "rgba(15,36,56,0.10)" }}>Flujo neto del mes</td>
              <td className="px-2 py-2 text-right font-bold text-[11px]" style={{ color: C.navyDark }}>—</td>
              {mesesVisibles.map(i => {
                const mes = i + 1;
                const ing = totalIngresosPorMes(mes) + (mes === 1 ? saldoInicialAño : 0);
                const gas = totalGastosPorMes(mes);
                const neto = ing - gas;
                return (
                  <td key={mes} className="px-2 py-2 text-right font-bold text-[11px] whitespace-nowrap" style={{
                    color: neto >= 0 ? C.green : C.red,
                    background: mes <= mesCorteEfectivo ? "rgba(15,36,56,0.05)" : undefined,
                  }}>
                    {neto >= 0 ? "+" : ""}{fmtMoney(neto, { compact: true })}
                  </td>
                );
              })}
              <td className="px-2.5 py-2 text-right font-bold text-[12px] whitespace-nowrap" style={{
                color: (acumAño(totalIngresosPorMes) + saldoInicialAño - acumAño(totalGastosPorMes)) >= 0 ? C.green : C.red,
                background: "rgba(201,165,92,0.12)",
              }}>
                {fmtMoney(acumAño(totalIngresosPorMes) + saldoInicialAño - acumAño(totalGastosPorMes), { compact: true })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[10.5px] mt-3" style={{ color: C.textMute, fontStyle: "italic" }}>
        Los meses con fondo azulado (≤ {MESES_LARGO[mesCorteEfectivo - 1]}) contienen <strong>ejecución real</strong> del Excel. Los meses sin sombreado son <strong>proyección</strong>:
        el valor de cada línea es el promedio de los meses ejecutados. Filas como "Retroactivo", "Cartera mes anterior", "Cuota extra" y "Saldo inicial bancos" se incluyen
        por estructura pero no provienen del estado de resultados — quedan en cero como referencia para anotaciones manuales del Consejo.
      </p>
    </section>
  );
}

function SectionHeader({ label, color, bg, colSpan }: { label: string; color: string; bg: string; colSpan: number }) {
  return (
    <tr style={{ background: bg }}>
      <td colSpan={colSpan} className="px-2.5 py-1.5 text-[10.5px] font-bold uppercase tracking-wider sticky left-0 z-10" style={{ color, background: bg }}>
        <span className="inline-block w-2 h-2 rounded mr-2" style={{ background: color }} /> {label}
      </td>
    </tr>
  );
}

function SubsectionHeader({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr style={{ background: "rgba(15,36,56,0.04)" }}>
      <td colSpan={colSpan} className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider sticky left-0 z-10" style={{ color: C.navyDark, background: "rgba(15,36,56,0.04)" }}>
        {label}
      </td>
    </tr>
  );
}

function FilaDetalle({
  linea, mesCorte, valorPara, color, mesesVisibles,
}: {
  linea: LineaFlujo;
  mesCorte: number;
  valorPara: (l: LineaFlujo, m: number) => number;
  color: string;
  mesesVisibles: number[];
}) {
  // Total acumulado del año completo (siempre 12 meses)
  let total = 0;
  for (let m = 1; m <= 12; m++) total += valorPara(linea, m);
  // Promedio mensual de los reales (para columna "Mensual {año}")
  const mensual = linea.presupuesto_mes || (linea.presupuesto_anual > 0 ? linea.presupuesto_anual / 12 : 0);

  return (
    <tr style={{ borderTop: `1px solid ${C.cardBorder}` }} className="hover:bg-deepgreen-50/30">
      <td className="px-2.5 py-1 font-medium sticky left-0 z-10 bg-white" style={{ color: C.text, paddingLeft: 20 }}>
        <span className="truncate inline-block" style={{ maxWidth: 220 }} title={linea.label}>{linea.label}</span>
      </td>
      <td className="px-2 py-1 text-right whitespace-nowrap" style={{ color: C.textMute }}>{fmtMoney(mensual, { compact: true })}</td>
      {mesesVisibles.map(i => {
        const mes = i + 1;
        const v = valorPara(linea, mes);
        const real = mes <= mesCorte;
        return (
          <td key={mes} className="px-2 py-1 text-right whitespace-nowrap" title={fmtMoney(v)} style={{
            color: real ? color : C.textMute,
            background: real ? "rgba(15,36,56,0.05)" : "transparent",
            fontWeight: real ? 500 : 400,
            fontStyle: real ? "normal" : "italic",
          }}>
            {fmtMoney(v, { compact: true })}
          </td>
        );
      })}
      <td className="px-2.5 py-1 text-right font-bold whitespace-nowrap" style={{ color, background: "rgba(201,165,92,0.08)" }}>
        {fmtMoney(total, { compact: true })}
      </td>
    </tr>
  );
}

function FilaVacia({
  label, mesCorte, valorSaldoInicial, mesesVisibles,
}: {
  label: string;
  mesCorte: number;
  valorSaldoInicial: number;
  mesesVisibles: number[];
}) {
  return (
    <tr style={{ borderTop: `1px solid ${C.cardBorder}`, fontStyle: "italic" }}>
      <td className="px-2.5 py-1 font-medium sticky left-0 z-10 bg-white truncate" style={{ color: C.textMute, paddingLeft: 20 }} title={label}>
        {label}
      </td>
      <td className="px-2 py-1 text-right whitespace-nowrap" style={{ color: C.textMute }}>—</td>
      {mesesVisibles.map(i => {
        const mes = i + 1;
        const real = mes <= mesCorte;
        const v = label === "SALDO INICIAL BANCOS" && mes === 1 ? valorSaldoInicial : 0;
        return (
          <td key={mes} className="px-2 py-1 text-right whitespace-nowrap" style={{
            color: C.textMute,
            background: real ? "rgba(15,36,56,0.03)" : "transparent",
          }}>
            {v > 0 ? fmtMoney(v, { compact: true }) : "—"}
          </td>
        );
      })}
      <td className="px-2.5 py-1 text-right font-bold whitespace-nowrap" style={{ color: C.textMute, background: "rgba(201,165,92,0.05)" }}>
        {valorSaldoInicial > 0 && label === "SALDO INICIAL BANCOS" ? fmtMoney(valorSaldoInicial, { compact: true }) : "—"}
      </td>
    </tr>
  );
}

