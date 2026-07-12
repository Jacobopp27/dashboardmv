import { useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine,
} from "recharts";
import { Wrench, ShieldCheck, Users, Leaf, Briefcase, TrendingUp, TrendingDown, Banknote, Printer } from "lucide-react";
import type { EjecucionPpto, LiquidezMes, ResultadoMes, SaldoMes } from "@/lib/api";
import { fmtMesCorto, fmtMoney, fmtPct, fmtPeriodo } from "@/lib/format";

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

// Colores de categoría alineados con el Inicio
const CAT_INFO = {
  Seguridad:        { icon: ShieldCheck, color: "#1F3A52" },  // navy
  Mantenimiento:    { icon: Wrench,      color: "#C9A55C" },  // gold
  Ambiental:        { icon: Leaf,        color: "#2D7A4F" },  // green
  Administrativos:  { icon: Briefcase,   color: "#7A6B4A" },  // marrón ejecutivo
  Convivencia:      { icon: Users,       color: "#A88243" },  // goldDark
};

interface Props {
  liquidez: LiquidezMes[];
  saldos: SaldoMes[];
  resultados: ResultadoMes[];
  ejecucion: EjecucionPpto[];
  mesInicial: number | null;
}

// Encabezado de panel numerado (patrón del Inicio)
function PanelHead({ n, title, desc }: { n: number; title: string; desc?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: C.navyDark }}>
        <span className="text-white text-[12px] font-bold">{n}</span>
      </div>
      <div>
        <h3 className="text-[16px] font-bold" style={{ color: C.navyDark }}>{title}</h3>
        {desc && <p className="text-[11px]" style={{ color: C.textMute }}>{desc}</p>}
      </div>
    </div>
  );
}

export function EstadosMensualesView({ liquidez, saldos, resultados, ejecucion, mesInicial }: Props) {
  // Set de meses disponibles (con datos)
  const mesesDisponibles = Array.from(new Set([
    ...liquidez.map((l) => l.periodo),
    ...resultados.map((r) => r.periodo),
    ...saldos.map((s) => s.periodo),
  ])).sort();
  const periodoInicial = mesesDisponibles.find((p) => p.endsWith(`-${String(mesInicial ?? 0).padStart(2, "0")}`))
    ?? mesesDisponibles[mesesDisponibles.length - 1];
  const [periodoSel, setPeriodoSel] = useState<string>(periodoInicial ?? "");

  if (mesesDisponibles.length === 0) {
    return <div className="bg-white rounded-2xl p-5 border text-[13px]" style={{ borderColor: C.cardBorder, color: C.textMute, fontFamily: "Segoe UI, system-ui, sans-serif" }}>Sin datos para mostrar.</div>;
  }

  // Datos del mes seleccionado
  const liq = liquidez.find((l) => l.periodo === periodoSel);
  const res = resultados.find((r) => r.periodo === periodoSel);
  const sal = saldos.find((s) => s.periodo === periodoSel);

  const ingresoOp = res?.ingreso_operacional ?? 0;
  const ingresoMg = res?.ingreso_marginal ?? 0;
  const totalIng  = ingresoOp + ingresoMg;
  const totalEgr  = res?.egreso_total_egresos ?? 0;
  const result    = res?.diferencia ?? (totalIng - totalEgr);

  const saldoBanco = (sal?.banco_operacion ?? 0) + (sal?.efectivo_caja ?? 0);
  const fiducia    = sal?.fiducia ?? 0;
  const carteraP   = liq?.copropietarios ?? 0;

  // Egresos del mes por categoría
  const egresosCat = res ? [
    { categoria: "Mantenimiento",   valor: res.egreso_mantenimiento   },
    { categoria: "Seguridad",       valor: res.egreso_seguridad       },
    { categoria: "Convivencia",     valor: res.egreso_convivencia     },
    { categoria: "Ambiental",       valor: res.egreso_ambiental       },
    { categoria: "Administrativos", valor: res.egreso_administrativos },
  ].filter((x) => x.valor > 0).sort((a, b) => b.valor - a.valor) : [];

  // Comparación vs promedio del año (para contextualizar el mes)
  const year = parseInt(periodoSel.split("-")[0], 10);
  const resultadosAño = resultados.filter((r) => r.year === year);
  const promedioMesIng = resultadosAño.length > 0
    ? resultadosAño.reduce((s, r) => s + r.ingreso_operacional + r.ingreso_marginal, 0) / resultadosAño.length
    : 0;
  const promedioMesEgr = resultadosAño.length > 0
    ? resultadosAño.reduce((s, r) => s + r.egreso_total_egresos, 0) / resultadosAño.length
    : 0;

  // Serie del año completo para chart con mes resaltado
  const serieAño = resultadosAño.map((r) => ({
    periodo: r.periodo,
    ingresos: r.ingreso_operacional + r.ingreso_marginal,
    egresos: r.egreso_total_egresos,
    resultado: r.diferencia,
  }));

  return (
    <div className="space-y-5 print-area" style={{ fontFamily: "Segoe UI, system-ui, sans-serif" }}>
      {/* Selector de mes prominente */}
      <div className="bg-white rounded-2xl p-5 border flex items-center justify-between flex-wrap gap-3" style={{ borderColor: C.cardBorder }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-5 rounded-sm" style={{ background: C.gold }} />
            <span className="text-[11px] uppercase tracking-[0.18em] font-semibold" style={{ color: C.goldDark }}>Estado mensual individual</span>
          </div>
          <h2 className="text-[26px] sm:text-[30px] font-bold leading-tight tracking-tight" style={{ color: C.navyDark }}>{fmtPeriodo(periodoSel)}</h2>
          <div className="hidden print:block text-[11px] mt-1" style={{ color: C.textMute }}>Urbanización Monteverdi P.H. · Informe generado el {new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}</div>
        </div>
        <div className="flex items-end gap-2 print:hidden">
          <div className="rounded-lg px-3 py-2 border" style={{ borderColor: C.cardBorder, background: C.ivory }}>
            <label className="block text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: C.textMute }}>Cambiar mes</label>
            <select
              value={periodoSel}
              onChange={(e) => setPeriodoSel(e.target.value)}
              className="bg-transparent text-[14px] font-bold focus:outline-none cursor-pointer pr-1"
              style={{ color: C.navyDark, minWidth: 130 }}
            >
              {mesesDisponibles.map((p) => (
                <option key={p} value={p}>{fmtPeriodo(p)}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-white text-[13px] font-semibold hover:opacity-90 transition-opacity shadow-sm"
            style={{ background: C.navy }}
            title="Imprimir / Guardar como PDF"
          >
            <Printer size={14} />
            Imprimir / PDF
          </button>
        </div>
      </div>

      {/* PANEL 1 — 4 KPIs del mes seleccionado */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: C.navyDark }}>
            <span className="text-white text-[12px] font-bold">1</span>
          </div>
          <h3 className="text-[16px] font-bold" style={{ color: C.navyDark }}>Indicadores del Mes</h3>
          <div className="flex-1 h-px ml-2" style={{ background: C.cardBorder }} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPIBig
            icon={<TrendingUp size={18} />}
            label="Ingresos del mes"
            value={fmtMoney(totalIng, { compact: true })}
            fullValue={fmtMoney(totalIng)}
            hint={`Op: ${fmtMoney(ingresoOp, { compact: true })} · Mg: ${fmtMoney(ingresoMg, { compact: true })}`}
            color={C.green}
          />
          <KPIBig
            icon={<TrendingDown size={18} />}
            label="Egresos del mes"
            value={fmtMoney(totalEgr, { compact: true })}
            fullValue={fmtMoney(totalEgr)}
            hint={`Promedio del año: ${fmtMoney(promedioMesEgr, { compact: true })}`}
            color={C.navy}
          />
          <KPIBig
            icon={result >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            label={result >= 0 ? "Resultado (Superávit)" : "Resultado (Déficit)"}
            value={fmtMoney(result, { compact: true })}
            fullValue={fmtMoney(result)}
            hint={totalIng > 0 ? `Margen: ${fmtPct(result / totalIng)}` : "—"}
            color={result >= 0 ? C.green : C.red}
          />
          <KPIBig
            icon={<Banknote size={18} />}
            label="Saldo en banco al cierre"
            value={fmtMoney(saldoBanco, { compact: true })}
            fullValue={fmtMoney(saldoBanco)}
            hint={`Fiducia: ${fmtMoney(fiducia, { compact: true })}`}
            color={C.goldDark}
          />
        </div>
      </section>

      {/* Grid: Egresos por categoría | Detalle del mes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* PANEL 2 — Egresos del mes por categoría */}
        <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
          <PanelHead n={2} title="Egresos por Categoría" desc={`Detalle del gasto operacional · ${fmtPeriodo(periodoSel)}`} />
          <div className="space-y-2">
            {egresosCat.map((c) => {
              const meta = CAT_INFO[c.categoria as keyof typeof CAT_INFO];
              const Icon = meta?.icon ?? Wrench;
              const color = meta?.color ?? C.green;
              const pct = totalEgr > 0 ? c.valor / totalEgr : 0;
              return (
                <div key={c.categoria} className="rounded-lg p-2.5 border" style={{ borderColor: C.cardBorder, background: C.ivory }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-7 h-7 rounded-md flex items-center justify-center text-white shrink-0" style={{ background: color }}>
                      <Icon size={14} />
                    </span>
                    <span className="text-[13px] font-semibold flex-1" style={{ color: C.navyDark }}>{c.categoria}</span>
                    <span className="text-[14px] font-bold tabular-nums" style={{ color: C.navyDark }}>{fmtMoney(c.valor, { compact: true })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: `${color}1A` }}>
                      <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: color }} />
                    </div>
                    <span className="text-[10px] tabular-nums w-9 text-right" style={{ color: C.textMute }}>{fmtPct(pct)}</span>
                  </div>
                </div>
              );
            })}
            {egresosCat.length === 0 && (
              <div className="text-[12px] text-center py-8" style={{ color: C.textMute }}>Sin egresos registrados</div>
            )}
          </div>
        </section>

        {/* PANEL 3 — Resumen financiero del mes */}
        <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
          <PanelHead n={3} title="Resumen del Mes" desc="Estado de Resultados + Saldos al cierre" />
          <div className="space-y-2.5 text-[13px]">
            <ResumenRow label="Ingresos operacionales (cuotas)" value={ingresoOp} color={C.green} />
            <ResumenRow label="Ingresos marginales (intereses, descuentos)" value={ingresoMg} color={C.green} />
            <ResumenRow label="TOTAL INGRESOS" value={totalIng} color={C.navyDark} bold />

            <div className="border-t my-2" style={{ borderColor: C.cardBorder }} />

            <ResumenRow label="Egresos operacionales" value={-totalEgr} color={C.navy} />
            <ResumenRow label="RESULTADO DEL MES" value={result} color={result >= 0 ? C.green : C.red} bold big />

            <div className="border-t my-2" style={{ borderColor: C.cardBorder }} />

            <div className="text-[10px] uppercase tracking-wider font-bold pt-1" style={{ color: C.textMute }}>Saldos al cierre</div>
            <ResumenRow label="Caja menor" value={sal?.efectivo_caja ?? 0} color={C.text} />
            <ResumenRow label="Banco operación" value={sal?.banco_operacion ?? 0} color={C.text} />
            <ResumenRow label="Fiducia (fondo imprevistos)" value={fiducia} color={C.goldDark} />
            <ResumenRow label="Cartera por cobrar (copropietarios)" value={carteraP} color={C.green} />
          </div>
        </section>
      </div>

      {/* PANEL 4 — Gráfico anual con mes resaltado */}
      <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
        <PanelHead n={4} title={`Posición del Mes en el Contexto Anual · ${year}`} desc="El mes seleccionado aparece resaltado en dorado" />
        {serieAño.length === 0 ? (
          <div className="h-[260px] flex items-center justify-center text-[13px]" style={{ color: C.textMute }}>Sin datos anuales</div>
        ) : (
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serieAño} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="periodo" tickFormatter={fmtMesCorto} tick={{ fontSize: 11, fill: C.textMute, fontWeight: 600 }} axisLine={{ stroke: C.cardBorder }} tickLine={false} />
                <YAxis tickFormatter={(v) => fmtMoney(v, { compact: true })} tick={{ fontSize: 10, fill: C.textMute }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number, name: string) => [fmtMoney(v), name]}
                  labelFormatter={(l: string) => fmtPeriodo(l)}
                  contentStyle={{ borderRadius: 8, border: `1px solid ${C.cardBorder}`, background: "#FFFFFF", fontSize: 12, color: C.text }}
                />
                <Legend iconType="square" wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                {/* Ingresos: resalta el mes seleccionado en dorado */}
                <Bar dataKey="ingresos" name="Ingresos" radius={[4, 4, 0, 0]}>
                  {serieAño.map((d, i) => (
                    <Cell key={i} fill={d.periodo === periodoSel ? C.gold : C.green} />
                  ))}
                </Bar>
                {/* Egresos: misma idea, resaltado en azul claro */}
                <Bar dataKey="egresos" name="Egresos" radius={[4, 4, 0, 0]}>
                  {serieAño.map((d, i) => (
                    <Cell key={i} fill={d.periodo === periodoSel ? "#7091A4" : C.navy} />
                  ))}
                </Bar>
                <ReferenceLine y={promedioMesIng} stroke={C.green} strokeDasharray="4 4" label={{ value: "Promedio ingresos", position: "right", fill: C.green, fontSize: 10 }} />
                <ReferenceLine y={promedioMesEgr} stroke={C.navy} strokeDasharray="4 4" label={{ value: "Promedio egresos", position: "right", fill: C.navy, fontSize: 10 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}

function KPIBig({ icon, label, value, fullValue, hint, color }: { icon: React.ReactNode; label: string; value: string; fullValue?: string; hint?: string; color: string }) {
  return (
    <div className="relative bg-white rounded-2xl p-4 border overflow-hidden" style={{ borderColor: C.cardBorder }}>
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: color }} />
      <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.06] rounded-full" style={{ background: color, filter: "blur(40px)", transform: "translate(40%, -40%)" }} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: color }}>{icon}</span>
          <span className="text-[10px] uppercase tracking-wider font-bold leading-tight" style={{ color: C.textMute }}>{label}</span>
        </div>
        <div
          className="font-bold tabular-nums leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
          style={{ color: C.navyDark, fontSize: "clamp(1.05rem, 1.7vw, 1.4rem)" }}
          title={fullValue ?? value}
        >
          {value}
        </div>
        {hint && <div className="text-[10px] mt-1.5" style={{ color: C.textMute }}>{hint}</div>}
      </div>
    </div>
  );
}

function ResumenRow({ label, value, color, bold = false, big = false }: { label: string; value: number; color: string; bold?: boolean; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={`${bold ? "font-bold uppercase text-[11px] tracking-wider" : ""} truncate`} style={{ color: bold ? C.navyDark : C.textMute }}>{label}</span>
      <span className={`tabular-nums whitespace-nowrap ${big ? "text-[18px] font-bold" : bold ? "text-[14px] font-bold" : "font-semibold"}`} style={{ color }}>
        {fmtMoney(value)}
      </span>
    </div>
  );
}
