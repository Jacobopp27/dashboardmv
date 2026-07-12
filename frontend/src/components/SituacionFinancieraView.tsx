import { useMemo, useState } from "react";
import { Plus, X, Layout, Columns, ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, CheckCircle2, Target } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LabelList } from "recharts";
import type { LiquidezMes } from "@/lib/api";
import { fmtMesCorto, fmtMoney, fmtPct, fmtPeriodo } from "@/lib/format";

interface Props {
  liquidez: LiquidezMes[];
  monthToFilter?: number | null;
}

interface ConceptoRow {
  label: string;
  bold?: boolean;
  indent?: boolean;
  group?: "activo" | "pasivo" | "patrim";
  /** Devuelve el valor para una fila de LiquidezMes; null para omitir si todos los meses son 0 */
  read: (l: LiquidezMes) => number;
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

/** Definición completa del ESFA: cuentas en orden, agrupadas por sección */
const CONCEPTOS: ConceptoRow[] = [
  // ACTIVO
  { label: "ACTIVO", bold: true,  group: "activo", read: () => 0 },
  { label: "Efectivo y equivalentes", group: "activo", read: () => 0 },
  { label: "Caja menor",       indent: true, group: "activo", read: (l) => l.efectivo_caja ?? 0 },
  { label: "Banco operación",  indent: true, group: "activo", read: (l) => l.banco_operacion ?? 0 },
  { label: "Fiducuenta",       indent: true, group: "activo", read: (l) => l.fiducia ?? 0 },
  { label: "Inversión CDT",    indent: true, group: "activo", read: (l) => l.inversion_cdt ?? 0 },
  { label: "Cuentas por cobrar", group: "activo", read: () => 0 },
  { label: "Copropietarios",                indent: true, group: "activo", read: (l) => l.copropietarios },
  { label: "Consignaciones por identificar", indent: true, group: "activo", read: (l) => l.consignaciones_pendientes ?? 0 },
  { label: "Deudores varios",                indent: true, group: "activo", read: (l) => l.deudores_varios ?? 0 },
  { label: "Anticipo proveedores",           indent: true, group: "activo", read: (l) => l.anticipo_proveedores ?? 0 },
  { label: "Gastos prepagados", group: "activo", read: () => 0 },
  { label: "Pólizas de seguro", indent: true, group: "activo", read: (l) => l.gastos_prepagados ?? 0 },
  { label: "TOTAL ACTIVO", bold: true, group: "activo", read: (l) => l.total_activo ?? l.activo_corriente },

  // PASIVO
  { label: "PASIVO", bold: true, group: "pasivo", read: () => 0 },
  { label: "Pasivo corriente", group: "pasivo", read: () => 0 },
  { label: "Costos y gastos por pagar", indent: true, group: "pasivo", read: (l) => l.cuentas_por_pagar ?? 0 },
  { label: "Retención impuestos",       indent: true, group: "pasivo", read: (l) => l.retencion_impuestos ?? 0 },
  { label: "ReteICA",                   indent: true, group: "pasivo", read: (l) => l.reteica ?? 0 },
  { label: "Consignaciones por identificar", indent: true, group: "pasivo", read: (l) => l.consignaciones_por_pagar ?? 0 },
  { label: "Total cuentas por pagar",   indent: true, bold: true, group: "pasivo", read: (l) => l.total_cuentas_por_pagar ?? 0 },
  { label: "Pasivos diferidos", indent: true, group: "pasivo", read: (l) => l.total_pasivos_diferidos ?? 0 },
  { label: "Otros pasivos",     indent: true, group: "pasivo", read: (l) => l.total_otros_pasivos ?? 0 },
  { label: "TOTAL PASIVO", bold: true, group: "pasivo", read: (l) => l.total_pasivo ?? l.pasivo_corriente },

  // PATRIMONIO
  { label: "PATRIMONIO", bold: true, group: "patrim", read: () => 0 },
  { label: "Fondo de imprevistos", indent: true, group: "patrim", read: (l) => l.fondo_imprevistos ?? 0 },
  { label: "Superávit / Déficit acumulado", indent: true, group: "patrim", read: (l) => {
    const tp = l.total_patrimonio ?? 0;
    const fi = l.fondo_imprevistos ?? 0;
    return tp - fi;
  }},
  { label: "TOTAL PATRIMONIO", bold: true, group: "patrim", read: (l) => l.total_patrimonio ?? 0 },
];

// Colores contables (se conservan por convención financiera)
const COLOR_ACTIVO = "#1E4620";
const COLOR_PASIVO = "#1F3A52";
const COLOR_PATRIM = "#D4AF37";

function colorOf(group?: "activo" | "pasivo" | "patrim"): string {
  if (group === "pasivo") return COLOR_PASIVO;
  if (group === "patrim") return COLOR_PATRIM;
  return COLOR_ACTIVO;
}

export function SituacionFinancieraView({ liquidez, monthToFilter }: Props) {
  const [modo, setModo] = useState<"individual" | "comparativo">("individual");

  const mesesOrdenados = useMemo(() => [...liquidez].sort((a, b) => a.periodo.localeCompare(b.periodo)), [liquidez]);
  const ultimo = mesesOrdenados[mesesOrdenados.length - 1];

  // Años disponibles según los datos
  const añosDisponibles = useMemo(
    () => Array.from(new Set(mesesOrdenados.map(l => l.periodo.split("-")[0]))).sort(),
    [mesesOrdenados],
  );
  // Año seleccionado por el usuario (puede ser null antes de la primera elección)
  const [añoElegido, setAñoElegido] = useState<string | null>(null);
  // Año efectivo: el elegido por el usuario, o el último disponible
  const añoFiltro = añoElegido ?? añosDisponibles[añosDisponibles.length - 1] ?? "";
  const setAñoFiltro = (a: string) => setAñoElegido(a);
  const mesesAñoFiltro = useMemo(
    () => añoFiltro
      ? mesesOrdenados.filter(l => l.periodo.startsWith(añoFiltro))
      : mesesOrdenados,
    [añoFiltro, mesesOrdenados],
  );

  // Selector individual: usa "YYYY-MM" para evitar colisión entre años distintos.
  // Si el usuario no escogió mes explícitamente, mostramos el último mes del año filtrado.
  const [periodoIndividual, setPeriodoIndividual] = useState<string | null>(null);
  const periodoPorDefecto = useMemo(() => {
    // Si el usuario eligió un mes y pertenece al año filtrado, respetarlo
    if (periodoIndividual && periodoIndividual.startsWith(añoFiltro)) return periodoIndividual;
    // Si el filtro global trae un mes "Hasta", precargar ese mes del año filtrado
    if (monthToFilter) {
      const match = mesesAñoFiltro.find(l => l.month === monthToFilter);
      if (match) return match.periodo;
    }
    // Por defecto: último mes con datos del año filtrado
    const ultimoDelAño = mesesAñoFiltro[mesesAñoFiltro.length - 1];
    return ultimoDelAño?.periodo ?? ultimo?.periodo;
  }, [periodoIndividual, monthToFilter, mesesAñoFiltro, añoFiltro, ultimo]);
  const liqIndividual = liquidez.find((l) => l.periodo === periodoPorDefecto) ?? ultimo;

  // Selector comparativo (multi-mes, max 3) — almacena periodos elegidos por el usuario.
  // El array efectivo se filtra al año actual al renderizar (vía useMemo).
  const [seleccionadosRaw, setSeleccionados] = useState<string[]>([]);
  const seleccionados = useMemo(() => {
    const filtrados = seleccionadosRaw.filter(p => p.startsWith(añoFiltro));
    if (filtrados.length > 0) return filtrados;
    // Si no hay seleccionados del año actual, preseleccionar el último mes del año
    const ultimoDelAño = mesesAñoFiltro[mesesAñoFiltro.length - 1];
    return ultimoDelAño ? [ultimoDelAño.periodo] : [];
  }, [seleccionadosRaw, añoFiltro, mesesAñoFiltro]);
  const toggleMes = (periodo: string) => {
    setSeleccionados(rawPrev => {
      // Conservamos los seleccionados de otros años (por si hay), trabajamos sobre los del año actual
      const otrosAños = rawPrev.filter(p => !p.startsWith(añoFiltro));
      const base = seleccionados; // lo que el usuario ve como activo (puede incluir el default)
      if (base.includes(periodo)) {
        const nuevoDelAño = base.filter(p => p !== periodo);
        return [...otrosAños, ...nuevoDelAño].sort();
      }
      if (base.length >= 3) return rawPrev;
      return [...otrosAños, ...base, periodo].sort();
    });
  };

  const liqsComp = seleccionados
    .map(p => liquidez.find(l => l.periodo === p))
    .filter((l): l is LiquidezMes => Boolean(l));

  if (!ultimo) {
    return (
      <div
        className="bg-white rounded-2xl p-5 border text-[13px]"
        style={{ borderColor: C.cardBorder, color: C.textMute, fontFamily: "Segoe UI, system-ui, sans-serif" }}
      >
        Sin datos de balance disponibles. Verifica los archivos ESFA en la carpeta de datos.
      </div>
    );
  }

  return (
    <div className="space-y-4" style={{ fontFamily: "Segoe UI, system-ui, sans-serif" }}>
      {/* Header con toggle */}
      <section className="bg-white rounded-2xl p-4 lg:p-5 border" style={{ borderColor: C.cardBorder }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-[16px] font-bold" style={{ color: C.navyDark }}>
              {modo === "individual" ? "Vista individual del balance" : "Comparativo entre meses"}
            </h2>
            <p className="text-[11px] mt-0.5" style={{ color: C.textMute }}>
              {modo === "individual"
                ? "Selecciona un mes para ver el ESFA completo."
                : "Selecciona hasta 3 meses para comparar las cuentas lado a lado."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg p-0.5 border" style={{ background: C.ivory, borderColor: C.cardBorder }}>
              <button
                onClick={() => setModo("individual")}
                className="px-3 py-1.5 rounded-md text-[12px] font-semibold flex items-center gap-1.5 transition-all"
                style={modo === "individual"
                  ? { background: "#fff", color: C.navyDark, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }
                  : { background: "transparent", color: C.textMute }}
              >
                <Layout size={13} /> Individual
              </button>
              <button
                onClick={() => setModo("comparativo")}
                className="px-3 py-1.5 rounded-md text-[12px] font-semibold flex items-center gap-1.5 transition-all"
                style={modo === "comparativo"
                  ? { background: "#fff", color: C.navyDark, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }
                  : { background: "transparent", color: C.textMute }}
              >
                <Columns size={13} /> Comparativo
              </button>
            </div>

            {/* Selector de Año (siempre visible, filtra los meses elegibles) */}
            <div className="rounded-lg px-3 py-1.5 border" style={{ borderColor: C.cardBorder, background: "#fff" }}>
              <label className="block text-[9px] uppercase tracking-wider font-bold mb-0.5" style={{ color: C.textMute }}>Año</label>
              <select
                value={añoFiltro}
                onChange={(e) => setAñoFiltro(e.target.value)}
                className="bg-transparent text-[13px] font-bold focus:outline-none cursor-pointer"
                style={{ color: C.navyDark }}
              >
                {añosDisponibles.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            {modo === "individual" && (
              <div className="rounded-lg px-3 py-1.5 border" style={{ borderColor: C.cardBorder, background: "#fff" }}>
                <label className="block text-[9px] uppercase tracking-wider font-bold mb-0.5" style={{ color: C.textMute }}>Mes</label>
                <select
                  value={periodoPorDefecto ?? ""}
                  onChange={(e) => setPeriodoIndividual(e.target.value)}
                  className="bg-transparent text-[13px] font-bold focus:outline-none cursor-pointer"
                  style={{ color: C.navyDark }}
                >
                  {mesesAñoFiltro.map((l) => (
                    <option key={l.periodo} value={l.periodo}>{fmtPeriodo(l.periodo)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {modo === "comparativo" && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-2">
              {mesesAñoFiltro.map((l) => {
                const activo = seleccionados.includes(l.periodo);
                const disabled = !activo && seleccionados.length >= 3;
                return (
                  <button
                    key={l.periodo}
                    onClick={() => toggleMes(l.periodo)}
                    disabled={disabled}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all flex items-center gap-1.5"
                    style={activo
                      ? { background: C.navy, color: "#fff", borderColor: C.navy, boxShadow: "0 2px 6px rgba(31,58,82,0.25)" }
                      : disabled
                        ? { background: C.ivory, color: "#B8B0A0", borderColor: C.cardBorder, cursor: "not-allowed" }
                        : { background: "#fff", color: C.navyDark, borderColor: C.cardBorder }}
                  >
                    {activo ? <X size={12} /> : <Plus size={12} />}
                    {fmtPeriodo(l.periodo)}
                  </button>
                );
              })}
            </div>
            {seleccionados.length > 0 && (
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
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
          </div>
        )}
      </section>

      {/* === RESUMEN EJECUTIVO PARA EL CONSEJO === */}
      {modo === "individual" && liqIndividual && (
        <ResumenEjecutivoESFA
          actual={liqIndividual}
          previo={mesAnterior(liqIndividual, mesesOrdenados)}
        />
      )}
      {modo === "comparativo" && liqsComp.length > 0 && (
        <ResumenEjecutivoESFA
          actual={liqsComp[liqsComp.length - 1]}
          previo={liqsComp.length >= 2 ? liqsComp[0] : mesAnterior(liqsComp[liqsComp.length - 1], mesesOrdenados)}
          labelPrevio={liqsComp.length >= 2 ? "mes base" : undefined}
        />
      )}

      {/* === MODO INDIVIDUAL === */}
      {modo === "individual" && liqIndividual && (
        <>
          <TarjetasIndividuales l={liqIndividual} />
          <GraficoBalanceAnual liquidez={mesesAñoFiltro} mesResaltado={liqIndividual.periodo} />
        </>
      )}

      {/* === MODO COMPARATIVO === */}
      {modo === "comparativo" && liqsComp.length === 0 && (
        <div className="bg-white rounded-2xl p-5 border text-[13px]" style={{ borderColor: C.cardBorder, color: C.textMute }}>
          Selecciona al menos un mes para comparar.
        </div>
      )}
      {modo === "comparativo" && liqsComp.length > 0 && (
        <>
          <TablaComparativa liqs={liqsComp} />
          <GraficoBalanceComparativo liqs={liqsComp} />
        </>
      )}
    </div>
  );
}

const COLOR_BARRA = {
  activo:    "#1E4620",  // verde Monteverdi
  pasivo:    "#1F3A52",  // azul marino
  patrim:    "#D4AF37",  // dorado
};

/** Encabezado de panel estilo Inicio: acento dorado + título navyDark + descripción */
function PanelHeader({ titulo, descripcion, meta }: { titulo: string; descripcion?: string; meta?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-1.5 h-9 rounded-sm shrink-0" style={{ background: C.gold }} />
      <div className="min-w-0">
        <h3 className="text-[16px] font-bold leading-tight" style={{ color: C.navyDark }}>{titulo}</h3>
        {descripcion && <p className="text-[11px]" style={{ color: C.textMute }}>{descripcion}</p>}
      </div>
      {meta && <span className="ml-auto text-[11px]" style={{ color: C.textMute }}>{meta}</span>}
    </div>
  );
}

/** Gráfico de barras para evolución mensual (modo individual): muestra Activo, Pasivo, Patrimonio
 *  para todos los meses del año filtrado, resaltando el mes elegido */
function GraficoBalanceAnual({ liquidez, mesResaltado }: { liquidez: LiquidezMes[]; mesResaltado: string }) {
  const data = liquidez.map((l) => {
    const activo = l.total_activo ?? l.activo_corriente;
    const pasivo = l.total_pasivo ?? l.pasivo_corriente;
    const patrim = l.total_patrimonio ?? (activo - pasivo);
    return {
      mes: fmtMesCorto(l.periodo),
      periodo: l.periodo,
      Activo: activo,
      Pasivo: pasivo,
      Patrimonio: patrim,
    };
  });
  if (data.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
      <PanelHeader
        titulo="Comportamiento mensual del balance"
        descripcion="Evolución de Activo, Pasivo y Patrimonio a lo largo del año"
        meta={<>Mes seleccionado: <strong style={{ color: C.navyDark }}>{fmtPeriodo(mesResaltado)}</strong></>}
      />
      <div className="w-full h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: C.textMute }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => fmtMoney(v, { compact: true })} tick={{ fontSize: 10, fill: C.textMute }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: number, name: string) => [fmtMoney(v), name]}
              labelFormatter={(_l, payload) => payload?.[0]?.payload?.periodo ? fmtPeriodo(payload[0].payload.periodo) : ""}
              contentStyle={{ borderRadius: 8, border: `1px solid ${C.cardBorder}`, fontSize: 12 }}
            />
            <Legend iconType="square" wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
            <Bar dataKey="Activo"     fill={COLOR_BARRA.activo}  radius={[4, 4, 0, 0]} />
            <Bar dataKey="Pasivo"     fill={COLOR_BARRA.pasivo}  radius={[4, 4, 0, 0]} />
            <Bar dataKey="Patrimonio" fill={COLOR_BARRA.patrim}  radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10.5px] mt-1" style={{ color: C.textMute }}>
        <span style={{ color: COLOR_ACTIVO, fontWeight: 700 }}>Verde:</span> Activos &nbsp;·&nbsp;
        <span style={{ color: COLOR_PASIVO, fontWeight: 700 }}>Azul:</span> Pasivos &nbsp;·&nbsp;
        <span style={{ color: "#B8941F", fontWeight: 700 }}>Dorado:</span> Patrimonio
      </p>
    </section>
  );
}

/** Gráfico comparativo: barras agrupadas Activo/Pasivo/Patrimonio por cada mes seleccionado */
function GraficoBalanceComparativo({ liqs }: { liqs: LiquidezMes[] }) {
  const data = liqs.map((l) => {
    const activo = l.total_activo ?? l.activo_corriente;
    const pasivo = l.total_pasivo ?? l.pasivo_corriente;
    const patrim = l.total_patrimonio ?? (activo - pasivo);
    return {
      mes: fmtPeriodo(l.periodo),
      Activo: activo,
      Pasivo: pasivo,
      Patrimonio: patrim,
    };
  });
  return (
    <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
      <PanelHeader
        titulo="Activo · Pasivo · Patrimonio · comparativo"
        descripcion="Estructura del balance en los meses seleccionados"
        meta={<>{liqs.length} {liqs.length === 1 ? "mes" : "meses"}</>}
      />
      <div className="w-full h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 24, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 12, fill: C.text, fontWeight: 600 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => fmtMoney(v, { compact: true })} tick={{ fontSize: 10, fill: C.textMute }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: number, name: string) => [fmtMoney(v), name]}
              contentStyle={{ borderRadius: 8, border: `1px solid ${C.cardBorder}`, fontSize: 12 }}
            />
            <Legend iconType="square" wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
            <Bar dataKey="Activo" fill={COLOR_BARRA.activo} radius={[4, 4, 0, 0]}>
              <LabelList dataKey="Activo" position="top" formatter={(v: number) => fmtMoney(v, { compact: true })} style={{ fontSize: 9.5, fill: COLOR_BARRA.activo, fontWeight: 700 }} />
            </Bar>
            <Bar dataKey="Pasivo" fill={COLOR_BARRA.pasivo} radius={[4, 4, 0, 0]}>
              <LabelList dataKey="Pasivo" position="top" formatter={(v: number) => fmtMoney(v, { compact: true })} style={{ fontSize: 9.5, fill: COLOR_BARRA.pasivo, fontWeight: 700 }} />
            </Bar>
            <Bar dataKey="Patrimonio" fill={COLOR_BARRA.patrim} radius={[4, 4, 0, 0]}>
              <LabelList dataKey="Patrimonio" position="top" formatter={(v: number) => fmtMoney(v, { compact: true })} style={{ fontSize: 9.5, fill: "#B8941F", fontWeight: 700 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

/** Las 3 tarjetas grandes (Activos / Pasivos / Patrimonio) del mes elegido */
function TarjetasIndividuales({ l }: { l: LiquidezMes }) {
  const prepagados = l.gastos_prepagados ?? 0;
  const totalActivo  = l.total_activo ?? l.activo_corriente;
  const cuentasPagar = (l.cuentas_por_pagar ?? 0) + (l.retencion_impuestos ?? 0) + (l.reteica ?? 0);
  const pasivosDifer = l.total_pasivos_diferidos ?? 0;
  const otrosPasivos = l.total_otros_pasivos ?? 0;
  const totalPasivo  = l.total_pasivo ?? (cuentasPagar + pasivosDifer + otrosPasivos);
  const fondoImprev  = l.fondo_imprevistos ?? 0;
  const totalPatrim  = l.total_patrimonio ?? (totalActivo - totalPasivo);
  const superavit    = totalPatrim - fondoImprev;

  const Row = ({ label, value, bold = false, indent = false }: { label: string; value: number; bold?: boolean; indent?: boolean }) => (
    <div
      className={`flex items-baseline justify-between gap-1.5 py-0.5 ${indent ? "pl-2" : ""} ${bold ? "font-bold border-t mt-1 pt-1.5 text-[11px]" : "text-[10.5px]"}`}
      style={bold ? { color: C.navyDark, borderColor: C.cardBorder } : { color: C.text }}
    >
      <span className="truncate min-w-0 leading-tight">{label}</span>
      <span className="tabular-nums shrink-0 leading-tight whitespace-nowrap">{fmtMoney(value)}</span>
    </div>
  );

  const SubLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[8.5px] uppercase tracking-wider font-bold mt-1.5 mb-0" style={{ color: C.textMute }}>{children}</div>
  );

  return (
    <div className="space-y-3">
      <div className="text-[11px] px-1" style={{ color: C.textMute }}>
        Corte al <span className="font-bold" style={{ color: C.navyDark }}>{fmtPeriodo(l.periodo)}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ACTIVOS */}
        <section className="relative bg-white rounded-2xl p-4 border overflow-hidden" style={{ borderColor: C.cardBorder }}>
          <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: COLOR_ACTIVO }} />
          <div className="relative">
            <div className="flex flex-col gap-0.5 mb-2 pb-2 border-b" style={{ borderColor: C.cardBorder }}>
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 text-white" style={{ background: COLOR_ACTIVO }}>+</span>
                <h2 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.navyDark }}>Activos</h2>
              </div>
              <div className="text-[18px] sm:text-[20px] font-bold tabular-nums whitespace-nowrap leading-none" style={{ color: COLOR_ACTIVO }}>{fmtMoney(totalActivo)}</div>
            </div>
            <div className="space-y-0">
              <div className="text-[8.5px] uppercase tracking-wider font-bold mt-1 mb-0" style={{ color: C.textMute }}>Efectivo y equivalentes</div>
              <Row label="Caja menor"      value={l.efectivo_caja ?? 0} indent />
              <Row label="Banco operación" value={l.banco_operacion ?? 0} indent />
              <Row label="Fiducuenta"      value={l.fiducia ?? 0} indent />
              {(l.inversion_cdt ?? 0) > 0 && <Row label="CDT" value={l.inversion_cdt ?? 0} indent />}
              <SubLabel>Cuentas por cobrar</SubLabel>
              <Row label="Copropietarios" value={l.copropietarios} indent />
              {(l.consignaciones_pendientes ?? 0) !== 0 && <Row label="Consignaciones x identificar" value={l.consignaciones_pendientes ?? 0} indent />}
              {(l.deudores_varios ?? 0) > 0 && <Row label="Deudores varios" value={l.deudores_varios ?? 0} indent />}
              {(l.anticipo_proveedores ?? 0) > 0 && <Row label="Anticipo proveedores" value={l.anticipo_proveedores ?? 0} indent />}
              {prepagados > 0 && (
                <>
                  <SubLabel>Gastos prepagados</SubLabel>
                  <Row label="Pólizas de seguro" value={prepagados} indent />
                </>
              )}
              <Row label="TOTAL ACTIVO" value={totalActivo} bold />
            </div>
          </div>
        </section>

        {/* PASIVOS */}
        <section className="relative bg-white rounded-2xl p-4 border overflow-hidden" style={{ borderColor: C.cardBorder }}>
          <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: COLOR_PASIVO }} />
          <div className="relative">
            <div className="flex flex-col gap-0.5 mb-2 pb-2 border-b" style={{ borderColor: C.cardBorder }}>
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 text-white" style={{ background: COLOR_PASIVO }}>−</span>
                <h2 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.navyDark }}>Pasivos</h2>
              </div>
              <div className="text-[18px] sm:text-[20px] font-bold tabular-nums whitespace-nowrap leading-none" style={{ color: COLOR_PASIVO }}>{fmtMoney(totalPasivo)}</div>
            </div>
            <div className="space-y-0">
              <div className="text-[8.5px] uppercase tracking-wider font-bold mt-1 mb-0" style={{ color: C.textMute }}>Pasivo corriente</div>
              <Row label="Costos y gastos por pagar" value={l.cuentas_por_pagar ?? 0} indent />
              {(l.retencion_impuestos ?? 0) > 0 && <Row label="Retención impuestos" value={l.retencion_impuestos ?? 0} indent />}
              {(l.reteica ?? 0) > 0 && <Row label="ReteICA" value={l.reteica ?? 0} indent />}
              {(l.consignaciones_por_pagar ?? 0) > 0 && <Row label="Consignaciones por identificar" value={l.consignaciones_por_pagar ?? 0} indent />}
              <Row label="Subtotal corriente" value={l.pasivo_corriente} bold indent />
              {pasivosDifer > 0 && (
                <>
                  <SubLabel>Pasivos diferidos</SubLabel>
                  <Row label="Cuotas extras / reinversión" value={pasivosDifer} indent />
                </>
              )}
              {otrosPasivos > 0 && (
                <>
                  <SubLabel>Otros pasivos</SubLabel>
                  <Row label="Provisiones" value={otrosPasivos} indent />
                </>
              )}
              <Row label="TOTAL PASIVO" value={totalPasivo} bold />
            </div>
          </div>
        </section>

        {/* PATRIMONIO */}
        <section className="relative bg-white rounded-2xl p-4 border overflow-hidden" style={{ borderColor: C.cardBorder }}>
          <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: COLOR_PATRIM }} />
          <div className="relative">
            <div className="flex flex-col gap-0.5 mb-2 pb-2 border-b" style={{ borderColor: C.cardBorder }}>
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 text-white" style={{ background: COLOR_PATRIM }}>≡</span>
                <h2 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.navyDark }}>Patrimonio</h2>
              </div>
              <div className="text-[18px] sm:text-[20px] font-bold tabular-nums whitespace-nowrap leading-none" style={{ color: "#B8941F" }}>{fmtMoney(totalPatrim)}</div>
            </div>
            <div className="space-y-0">
              {fondoImprev > 0 && (
                <>
                  <div className="text-[8.5px] uppercase tracking-wider font-bold mt-1 mb-0" style={{ color: C.textMute }}>Fondos</div>
                  <Row label="Fondo de imprevistos" value={fondoImprev} indent />
                </>
              )}
              <SubLabel>Resultados</SubLabel>
              <Row label="Superávit / Déficit acumulado" value={superavit} indent />
              <Row label="TOTAL PATRIMONIO" value={totalPatrim} bold />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Tabla comparativa con cuentas en filas y meses en columnas */
function TablaComparativa({ liqs }: { liqs: LiquidezMes[] }) {
  // Mostrar solo conceptos con al menos un valor != 0 entre los meses seleccionados
  const filas = CONCEPTOS.filter((c) => {
    if (c.bold || c.label.toUpperCase() === c.label) return true;  // Headers y totales siempre
    return liqs.some(l => Math.abs(c.read(l)) > 0.5);
  });

  return (
    <section className="bg-white rounded-2xl p-5 lg:p-6 border overflow-x-auto" style={{ borderColor: C.cardBorder }}>
      <PanelHeader
        titulo="Balance comparativo por cuenta"
        descripcion="Cuentas del ESFA lado a lado con su diferencia entre meses"
      />
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b-2" style={{ borderColor: C.cardBorder }}>
            <th className="px-2 py-2 text-left font-bold uppercase text-[10px] tracking-wider min-w-[200px]" style={{ color: C.textMute }}>
              Concepto
            </th>
            {liqs.map((l) => (
              <th key={l.periodo} className="px-2 py-2 text-right font-bold uppercase text-[10px] tracking-wider whitespace-nowrap" style={{ color: C.textMute }}>
                {fmtPeriodo(l.periodo)}
              </th>
            ))}
            {liqs.length > 1 && (
              <th className="px-2 py-2 text-right font-bold uppercase text-[10px] tracking-wider whitespace-nowrap" style={{ color: C.textMute }}>
                Diferencia ({fmtPeriodo(liqs[0].periodo)} → {fmtPeriodo(liqs[liqs.length - 1].periodo)})
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {filas.map((c, i) => {
            const valores = liqs.map(l => c.read(l));
            const base = valores[0];
            const ultimo = valores[valores.length - 1];
            // Mostrar diferencia en filas con cifras (no en headers de sección)
            const tieneValor = valores.some(v => Math.abs(v) > 0.5);
            let delta: number | null = null;
            let deltaPct: number | null = null;
            if (tieneValor) {
              delta = ultimo - base;
              if (base !== 0) deltaPct = delta / Math.abs(base);
            }
            const deltaColor = delta === null || Math.abs(delta) < 1 ? C.textMute : delta > 0 ? C.green : C.red;

            // Header de sección: ACTIVO/PASIVO/PATRIMONIO solo (sin "TOTAL", que son filas con cifras)
            const esHeader = (c.label === "ACTIVO" || c.label === "PASIVO" || c.label === "PATRIMONIO") && c.bold;
            const color = colorOf(c.group);

            if (esHeader) {
              return (
                <tr key={i} style={{ background: C.ivory }}>
                  <td colSpan={liqs.length + (liqs.length > 1 ? 2 : 1)}
                    className="px-2 py-2 font-bold text-[12px] uppercase tracking-wider border-y"
                    style={{ color, borderColor: C.cardBorder }}
                  >
                    <span className="inline-block w-2 h-2 rounded mr-2" style={{ background: color }} />
                    {c.label}
                  </td>
                </tr>
              );
            }

            return (
              <tr key={i} className="border-b" style={{ borderColor: `${C.cardBorder}80`, background: c.bold ? `${C.ivory}` : undefined }}>
                <td className={`px-2 py-1.5 ${c.indent ? "pl-6" : ""} ${c.bold ? "font-bold" : ""}`} style={{ color: c.bold ? C.navyDark : C.text }}>
                  {c.label}
                </td>
                {valores.map((v, j) => (
                  <td key={j} className={`px-2 py-1.5 text-right tabular-nums ${c.bold ? "font-bold" : ""}`} style={c.bold ? { color } : { color: C.text }}>
                    {v === 0 ? <span style={{ color: C.textMute }}>—</span> : fmtMoney(v)}
                  </td>
                ))}
                {liqs.length > 1 && (
                  <td className="px-2 py-1.5 text-right">
                    {delta !== null ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <div className="flex items-center justify-end gap-1">
                          {Math.abs(delta) < 1 ? <Minus size={11} style={{ color: C.textMute }} /> :
                            delta > 0 ? <ArrowUpRight size={11} style={{ color: C.green }} /> :
                            <ArrowDownRight size={11} style={{ color: C.red }} />}
                          <span className="text-[11.5px] font-bold tabular-nums" style={{ color: deltaColor }}>
                            {delta > 0 ? "+" : ""}{fmtMoney(delta)}
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

      {/* Verificación de ecuación: Activo = Pasivo + Patrimonio */}
      <div className="mt-3 pt-2 border-t-2" style={{ borderColor: C.cardBorder }}>
        <div className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: C.textMute }}>Verificación ecuación contable</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {liqs.map((l) => {
            const a = l.total_activo ?? l.activo_corriente;
            const p = l.total_pasivo ?? l.pasivo_corriente;
            const pt = l.total_patrimonio ?? 0;
            const diff = a - (p + pt);
            const ok = Math.abs(diff) < 1;
            return (
              <div
                key={l.periodo}
                className="text-[11px] p-2 rounded border"
                style={ok
                  ? { background: `${C.green}12`, borderColor: `${C.green}40`, color: C.green }
                  : { background: `${C.red}12`, borderColor: `${C.red}40`, color: C.red }}
              >
                <div className="font-bold mb-0.5">{fmtPeriodo(l.periodo)}</div>
                <div className="tabular-nums">
                  {fmtMoney(a, { compact: true })} = {fmtMoney(p, { compact: true })} + {fmtMoney(pt, { compact: true })}
                </div>
                <div className="text-[9.5px] mt-0.5">
                  {ok ? "✓ Cuadra" : `⚠ Δ ${fmtMoney(diff)}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ============ RESUMEN EJECUTIVO ESFA ============ */

// Paleta armonizada con la línea gráfica de Inicio (paleta C)
const RE = {
  navy:       C.navy,
  navyDark:   C.navyDark,
  gold:       C.gold,
  ivory:      C.ivory,
  green:      C.green,
  red:        C.red,
  amber:      C.amber,
  cardBorder: C.cardBorder,
  textMute:   C.textMute,
  text:       C.text,
};

function mesAnterior(l: LiquidezMes, mesesOrdenados: LiquidezMes[]): LiquidezMes | null {
  const idx = mesesOrdenados.findIndex(m => m.periodo === l.periodo);
  return idx > 0 ? mesesOrdenados[idx - 1] : null;
}

interface ResumenEjecutivoESFAProps {
  actual: LiquidezMes;
  previo: LiquidezMes | null;
  labelPrevio?: string;
}

function ResumenEjecutivoESFA({ actual, previo, labelPrevio }: ResumenEjecutivoESFAProps) {
  const totalActivo  = actual.total_activo ?? actual.activo_corriente;
  const totalPasivo  = actual.total_pasivo ?? actual.pasivo_corriente;
  const totalPatrim  = actual.total_patrimonio ?? (totalActivo - totalPasivo);
  const efectivo     = (actual.efectivo_caja ?? 0) + (actual.banco_operacion ?? 0) + (actual.fiducia ?? 0) + (actual.inversion_cdt ?? 0);
  const cartera      = actual.copropietarios ?? 0;
  const pasivoCorr   = actual.pasivo_corriente;
  const fondoImprev  = actual.fondo_imprevistos ?? 0;

  const razonCorr = pasivoCorr > 0 ? actual.activo_corriente / pasivoCorr : null;
  const liquidezDisp = pasivoCorr > 0 ? efectivo / pasivoCorr : null;
  const endeudPct = totalActivo > 0 ? totalPasivo / totalActivo : 0;
  const solvenciaPatr = totalActivo > 0 ? totalPatrim / totalActivo : 0;
  const pctEfectivo = totalActivo > 0 ? efectivo / totalActivo : 0;
  const pctCartera = totalActivo > 0 ? cartera / totalActivo : 0;

  let deltaPatrim: number | null = null;
  let deltaActivo: number | null = null;
  let deltaPasivo: number | null = null;
  if (previo) {
    const prevAct = previo.total_activo ?? previo.activo_corriente;
    const prevPas = previo.total_pasivo ?? previo.pasivo_corriente;
    const prevPat = previo.total_patrimonio ?? (prevAct - prevPas);
    deltaPatrim = totalPatrim - prevPat;
    deltaActivo = totalActivo - prevAct;
    deltaPasivo = totalPasivo - prevPas;
  }

  const conclusion = (() => {
    if (razonCorr === null) return { tipo: "amber" as const, texto: "Sin información suficiente para valorar la liquidez." };
    if (razonCorr >= 1.5 && solvenciaPatr >= 0.20 && endeudPct <= 0.7) {
      return { tipo: "positivo" as const, texto: "La copropiedad presenta una posición financiera sana, con liquidez suficiente para cubrir sus obligaciones corrientes." };
    }
    if (razonCorr >= 1.0) {
      return { tipo: "amber" as const, texto: "La liquidez cubre las obligaciones, pero el nivel de endeudamiento o el patrimonio requieren atención del Consejo." };
    }
    return { tipo: "rojo" as const, texto: "La liquidez es insuficiente para cubrir las obligaciones corrientes. Se requiere acción inmediata." };
  })();
  const conclusionColor = conclusion.tipo === "positivo" ? RE.green : conclusion.tipo === "amber" ? RE.amber : RE.red;
  const ConclusionIcon = conclusion.tipo === "positivo" ? CheckCircle2 : conclusion.tipo === "amber" ? Target : AlertTriangle;

  const tag = labelPrevio ?? (previo ? fmtPeriodo(previo.periodo) : "");

  return (
    <section className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: RE.cardBorder, borderLeft: `6px solid ${RE.gold}`, fontFamily: "Segoe UI, system-ui, sans-serif" }}>
      <div className="p-5 lg:p-6">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="w-1 h-5 rounded-sm" style={{ background: RE.gold }} />
          <h2 className="text-[14px] font-bold uppercase tracking-wider" style={{ color: RE.navyDark }}>Resumen ejecutivo · Situación financiera</h2>
          <span className="text-[10.5px] ml-1 px-2 py-0.5 rounded" style={{ background: RE.ivory, color: RE.textMute, border: `1px solid ${RE.cardBorder}` }}>
            Para el Consejo
          </span>
          <span className="text-[11px] ml-auto" style={{ color: RE.textMute }}>
            Corte: <strong style={{ color: RE.navyDark }}>{fmtPeriodo(actual.periodo)}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
          <CifraESFA label="Activo total"     valor={totalActivo}  delta={deltaActivo}  color={COLOR_ACTIVO} previoLabel={tag} />
          <CifraESFA label="Pasivo total"     valor={totalPasivo}  delta={deltaPasivo}  color={COLOR_PASIVO} previoLabel={tag} invertido />
          <CifraESFA label="Patrimonio total" valor={totalPatrim}  delta={deltaPatrim}  color={COLOR_PATRIM} previoLabel={tag} />
        </div>

        <div className="space-y-3 text-[13px] leading-relaxed" style={{ color: RE.text }}>
          <p>
            Al corte de <strong style={{ color: RE.navyDark }}>{fmtPeriodo(actual.periodo)}</strong>, la copropiedad cuenta con un activo total de{" "}
            <strong style={{ color: COLOR_ACTIVO }}>{fmtMoney(totalActivo)}</strong>, respaldado por un pasivo de{" "}
            <strong style={{ color: COLOR_PASIVO }}>{fmtMoney(totalPasivo)}</strong> y un patrimonio de{" "}
            <strong style={{ color: COLOR_PATRIM }}>{fmtMoney(totalPatrim)}</strong>.
            {" "}La estructura patrimonial muestra una solvencia del <strong style={{ color: solvenciaPatr >= 0.20 ? RE.green : solvenciaPatr >= 0.10 ? RE.amber : RE.red }}>{fmtPct(solvenciaPatr, 1)}</strong>
            {" "}(patrimonio sobre activos), con un nivel de endeudamiento del <strong style={{ color: endeudPct <= 0.5 ? RE.green : endeudPct <= 0.7 ? RE.amber : RE.red }}>{fmtPct(endeudPct, 1)}</strong>.
          </p>

          <p>
            <strong>Liquidez:</strong> la razón corriente se ubica en{" "}
            <strong style={{ color: razonCorr !== null && razonCorr >= 1.5 ? RE.green : razonCorr !== null && razonCorr >= 1 ? RE.amber : RE.red }}>
              {razonCorr !== null ? razonCorr.toFixed(2) : "—"}
            </strong>
            {razonCorr !== null && (
              <>
                {" "}({razonCorr >= 1.5 ? "saludable" : razonCorr >= 1 ? "ajustada" : "insuficiente"}),
                {" "}y la cobertura de efectivo equivale a{" "}
                <strong style={{ color: liquidezDisp !== null && liquidezDisp >= 1 ? RE.green : RE.amber }}>
                  {liquidezDisp !== null ? liquidezDisp.toFixed(2) : "—"}
                </strong>{" "}
                veces los pasivos corrientes de {fmtMoney(pasivoCorr, { compact: true })}.
              </>
            )}
            {" "}El efectivo disponible en bancos y fiducia asciende a <strong>{fmtMoney(efectivo, { compact: true })}</strong>,
            equivalente al <strong>{fmtPct(pctEfectivo, 1)}</strong> de los activos.
          </p>

          <p>
            <strong>Composición del activo:</strong> la cartera de copropietarios representa{" "}
            <strong style={{ color: pctCartera < 0.20 ? RE.green : pctCartera < 0.35 ? RE.amber : RE.red }}>{fmtPct(pctCartera, 1)}</strong>{" "}
            del activo total ({fmtMoney(cartera, { compact: true })}),
            {" "}{pctCartera < 0.20
              ? "manteniendo una exposición controlada de las cuentas por cobrar."
              : pctCartera < 0.35
                ? "lo que requiere monitoreo de la gestión de cobranza."
                : "lo que indica un alto riesgo en la gestión de cobranza y compromete la liquidez."}
            {(actual.gastos_prepagados ?? 0) > 0 && (
              <> Los gastos prepagados (pólizas de seguro) suman <strong>{fmtMoney(actual.gastos_prepagados ?? 0, { compact: true })}</strong>.</>
            )}
          </p>

          {previo && deltaPatrim !== null && (
            <p>
              <strong>Tendencia vs {tag}:</strong> el patrimonio{" "}
              {Math.abs(deltaPatrim) < 100_000
                ? <>se mantuvo estable</>
                : deltaPatrim > 0
                  ? <><strong style={{ color: RE.green }}>creció en {fmtMoney(deltaPatrim, { compact: true })}</strong></>
                  : <><strong style={{ color: RE.red }}>disminuyó en {fmtMoney(Math.abs(deltaPatrim), { compact: true })}</strong></>}
              {deltaActivo !== null && (
                <>, los activos {deltaActivo >= 0 ? "aumentaron" : "se redujeron"} en {fmtMoney(Math.abs(deltaActivo), { compact: true })}</>
              )}
              {deltaPasivo !== null && (
                <> y los pasivos {deltaPasivo >= 0 ? "subieron" : "bajaron"} en {fmtMoney(Math.abs(deltaPasivo), { compact: true })}</>
              )}.
            </p>
          )}

          {fondoImprev > 0 && (
            <p>
              <strong>Fondo de imprevistos:</strong> el fondo asciende a <strong>{fmtMoney(fondoImprev, { compact: true })}</strong>,
              equivalente al <strong>{fmtPct(fondoImprev / totalPatrim, 1)}</strong> del patrimonio,
              {" "}{fondoImprev > 10_000_000
                ? "lo que constituye un colchón sólido frente a contingencias mayores."
                : "lo que sugiere reforzar este fondo para cubrir eventuales gastos extraordinarios."}
            </p>
          )}
        </div>

        <div className="mt-4 p-3 rounded-lg flex items-start gap-3" style={{ background: `${conclusionColor}0F`, borderLeft: `3px solid ${conclusionColor}` }}>
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-white shrink-0" style={{ background: conclusionColor }}>
            <ConclusionIcon size={14} />
          </div>
          <div className="flex-1">
            <div className="text-[10.5px] uppercase tracking-wider font-bold" style={{ color: conclusionColor }}>Lectura para el Consejo</div>
            <div className="text-[13px] font-semibold mt-0.5" style={{ color: RE.navyDark }}>{conclusion.texto}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CifraESFA({ label, valor, delta, color, previoLabel, invertido }: { label: string; valor: number; delta: number | null; color: string; previoLabel: string; invertido?: boolean }) {
  const arrow = delta === null || Math.abs(delta) < 100
    ? null
    : delta > 0
      ? <ArrowUpRight size={11} style={{ color: invertido ? RE.red : RE.green }} />
      : <ArrowDownRight size={11} style={{ color: invertido ? RE.green : RE.red }} />;
  const isPositiva = delta !== null && Math.abs(delta) >= 100 && ((delta > 0) === !invertido);
  const isNegativa = delta !== null && Math.abs(delta) >= 100 && ((delta > 0) === !!invertido);
  const deltaColor = isPositiva ? RE.green : isNegativa ? RE.red : RE.textMute;
  return (
    <div className="rounded-lg p-3 border" style={{ borderColor: RE.cardBorder, background: RE.ivory }}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="inline-block w-2 h-2 rounded" style={{ background: color }} />
        <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: RE.textMute }}>{label}</span>
      </div>
      <div className="text-[18px] font-bold tabular-nums leading-tight" style={{ color }}>{fmtMoney(valor)}</div>
      {delta !== null && previoLabel && (
        <div className="flex items-center gap-1 mt-1">
          {arrow ?? <Minus size={11} style={{ color: RE.textMute }} />}
          <span className="text-[11px] font-bold tabular-nums" style={{ color: deltaColor }}>
            {delta > 0 ? "+" : ""}{fmtMoney(delta, { compact: true })}
          </span>
          <span className="text-[10px]" style={{ color: RE.textMute }}>vs {previoLabel}</span>
        </div>
      )}
    </div>
  );
}
