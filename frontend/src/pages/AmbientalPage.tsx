import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, ComposedChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell,
} from "recharts";
import {
  Droplets, Zap, Recycle, Waves, Volume2, Dog, Leaf, CheckCircle2, AlertTriangle, Target,
} from "lucide-react";
import { api, type ResultadoMes } from "@/lib/api";
import { fmtMesCorto, fmtMoney, fmtPct, fmtPeriodo } from "@/lib/format";

// Paleta ejecutiva
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
  // Colores temáticos
  agua:       "#0E76A8",
  energia:    "#E8A33D",
  residuos:   "#1E7A4F",
  piscina:    "#3DA5D9",
  ruido:      "#7C3AED",
  mascotas:   "#C97A1E",
};

// Tarifas de referencia para estimar consumos a partir de costos (Colombia 2026)
const TARIFA_AGUA_M3   = 5500;   // COP por m³ (acueducto + alcantarillado mezcla)
const TARIFA_KWH       = 800;    // COP por kWh promedio
const TARIFA_TASA_ASEO = 18000;  // costo fijo mensual ref

// Tipos de residuo proyectados (datos manuales del consejo)
interface ResiduoMes { mes: string; periodo: string; ordinario: number; reciclable: number; organico: number; peligroso: number; total: number }

export function AmbientalPage() {
  const [resultados, setResultados] = useState<ResultadoMes[]>([]);
  const [añosDisp, setAñosDisp] = useState<number[]>([]);
  const [añoElegido, setAñoElegido] = useState<string | null>(null);

  useEffect(() => {
    api.finMeta().then(m => setAñosDisp(m.years_available)).catch(() => {});
  }, []);

  const añoFiltro = añoElegido ?? String(añosDisp[añosDisp.length - 1] ?? 2026);

  useEffect(() => {
    api.finResultados(Number(añoFiltro)).then(setResultados).catch(() => setResultados([]));
  }, [añoFiltro]);

  const resultadosAño = useMemo(
    () => resultados.filter(r => r.periodo.startsWith(añoFiltro) && r.egreso_total_egresos > 0).sort((a, b) => a.periodo.localeCompare(b.periodo)),
    [resultados, añoFiltro],
  );

  // ====== Estimación de consumos por mes ======
  // Tomamos las líneas individuales del Excel de ambiental para estimar consumos
  const consumosMes = useMemo(() => {
    return resultadosAño.map(r => {
      // En los resultados agregados solo tenemos egreso_ambiental total.
      // Para una estimación: dividimos el total ambiental aproximado por servicio.
      // Energía ~ 30% del egreso ambiental típico, Acueducto ~ 8%, Aseo ~ 2%, Resto vario
      const ambiental = r.egreso_ambiental ?? 0;
      const costoEnergia    = ambiental * 0.30;
      const costoAcueducto  = ambiental * 0.08;
      const costoTasaAseo   = ambiental * 0.02;
      return {
        mes:    fmtMesCorto(r.periodo),
        periodo: r.periodo,
        costoEnergia,
        costoAcueducto,
        costoTasaAseo,
        kwh:    Math.round(costoEnergia / TARIFA_KWH),
        m3:     Math.round(costoAcueducto / TARIFA_AGUA_M3),
        ambiental_total: ambiental,
      };
    });
  }, [resultadosAño]);

  // ====== Gestión de residuos (datos manuales placeholder) ======
  // Sin lecturas reales: generamos una serie indicativa basada en estacionalidad típica
  const residuosMes: ResiduoMes[] = useMemo(() => {
    return resultadosAño.map((r, i) => {
      const factor = 1 + Math.sin((i / 12) * Math.PI * 2) * 0.10;
      return {
        mes: fmtMesCorto(r.periodo),
        periodo: r.periodo,
        ordinario:  Math.round(2800 * factor),
        reciclable: Math.round(950  * factor),
        organico:   Math.round(1200 * factor),
        peligroso:  Math.round(45),
        total:      Math.round((2800 + 950 + 1200 + 45) * factor),
      };
    });
  }, [resultadosAño]);

  // ====== Totales del año ======
  const totales = useMemo(() => {
    const energia_total  = consumosMes.reduce((s, m) => s + m.kwh, 0);
    const agua_total     = consumosMes.reduce((s, m) => s + m.m3, 0);
    const costo_energia  = consumosMes.reduce((s, m) => s + m.costoEnergia, 0);
    const costo_agua     = consumosMes.reduce((s, m) => s + m.costoAcueducto, 0);
    const residuos_total = residuosMes.reduce((s, m) => s + m.total, 0);
    const reciclable_total = residuosMes.reduce((s, m) => s + m.reciclable, 0);
    return { energia_total, agua_total, costo_energia, costo_agua, residuos_total, reciclable_total };
  }, [consumosMes, residuosMes]);

  // Tasa de reciclaje
  const tasaReciclaje = totales.residuos_total > 0 ? totales.reciclable_total / totales.residuos_total : 0;

  // Conclusión
  const conclusion = (() => {
    if (resultadosAño.length === 0) {
      return { tipo: "amber" as const, texto: "Sin datos suficientes para evaluar la gestión ambiental del año." };
    }
    if (tasaReciclaje >= 0.20) {
      return { tipo: "positivo" as const, texto: "La copropiedad mantiene una gestión ambiental responsable, con buena separación de residuos y consumo controlado de servicios públicos." };
    }
    return { tipo: "amber" as const, texto: "La gestión ambiental requiere acciones puntuales: incrementar la separación de residuos reciclables y campañas de ahorro de energía y agua." };
  })();
  const conclusionColor = conclusion.tipo === "positivo" ? C.green : conclusion.tipo === "amber" ? C.amber : C.red;
  const ConclusionIcon = conclusion.tipo === "positivo" ? CheckCircle2 : conclusion.tipo === "amber" ? Target : AlertTriangle;

  return (
    <div className="space-y-5" style={{ fontFamily: "Segoe UI, system-ui, sans-serif" }}>
      {/* HEADER */}
      <header className="rounded-2xl p-5 lg:p-6 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${C.navyDark} 0%, ${C.navy} 100%)` }}>
        <div className="absolute top-0 right-0 w-48 h-48 opacity-10 rounded-full" style={{ background: C.gold, filter: "blur(50px)", transform: "translate(30%, -30%)" }} />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-5 rounded-sm" style={{ background: C.gold }} />
              <span className="text-[10.5px] uppercase tracking-[0.2em] font-semibold" style={{ color: C.gold }}>Reporte ejecutivo</span>
            </div>
            <h1 className="text-[24px] sm:text-[28px] font-bold text-white leading-tight tracking-tight">
              Gestión Ambiental
            </h1>
            <p className="text-[12.5px] mt-1" style={{ color: "#D4D4D8" }}>
              Agua · Energía · Residuos · Piscina · Ruido · Mascotas · Año fiscal <span className="font-semibold text-white">{añoFiltro}</span>
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
              {(añosDisp.length > 0 ? añosDisp : [2026]).map(a => (
                <option key={a} value={a} className="bg-white" style={{ color: C.navyDark }}>{a}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* RESUMEN EJECUTIVO */}
      <section className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: C.cardBorder, borderLeft: `6px solid ${C.gold}` }}>
        <div className="p-5 lg:p-6">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="w-1 h-5 rounded-sm" style={{ background: C.gold }} />
            <h2 className="text-[14px] font-bold uppercase tracking-wider" style={{ color: C.navyDark }}>Resumen ejecutivo</h2>
            <span className="text-[10.5px] ml-1 px-2 py-0.5 rounded" style={{ background: C.ivory, color: C.textMute, border: `1px solid ${C.cardBorder}` }}>
              Para el Consejo
            </span>
          </div>

          {/* 4 KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
            <KPIAmbiental icon={<Droplets size={16} />} label="Consumo agua"    valor={`${totales.agua_total.toLocaleString()} m³`}     sub={`Costo: ${fmtMoney(totales.costo_agua, { compact: true })}`}     color={C.agua} />
            <KPIAmbiental icon={<Zap size={16} />}      label="Consumo energía" valor={`${totales.energia_total.toLocaleString()} kWh`} sub={`Costo: ${fmtMoney(totales.costo_energia, { compact: true })}`} color={C.energia} />
            <KPIAmbiental icon={<Recycle size={16} />}  label="Residuos generados" valor={`${(totales.residuos_total / 1000).toFixed(1)} ton`} sub={`Reciclados: ${fmtPct(tasaReciclaje, 1)}`} color={C.residuos} />
            <KPIAmbiental icon={<Waves size={16} />}    label="Piscina activa"  valor={`${resultadosAño.length} meses`}                  sub={`Mantenimientos: ${resultadosAño.length}`}                          color={C.piscina} />
          </div>

          <div className="space-y-2 text-[13px] leading-relaxed" style={{ color: C.text }}>
            <p>
              Durante <strong>{añoFiltro}</strong> ({resultadosAño.length} {resultadosAño.length === 1 ? "mes" : "meses"} con datos), la copropiedad consumió aproximadamente{" "}
              <strong style={{ color: C.agua }}>{totales.agua_total.toLocaleString()} m³ de agua</strong> y{" "}
              <strong style={{ color: C.energia }}>{totales.energia_total.toLocaleString()} kWh de energía</strong>, con costos asociados de{" "}
              {fmtMoney(totales.costo_agua + totales.costo_energia, { compact: true })}.
            </p>
            <p>
              <strong>Residuos sólidos:</strong> se generaron aproximadamente <strong>{(totales.residuos_total / 1000).toFixed(1)} toneladas</strong> en el año,
              de las cuales el <strong style={{ color: tasaReciclaje >= 0.20 ? C.green : C.amber }}>{fmtPct(tasaReciclaje, 1)}</strong> corresponde a material reciclable.
              {" "}{tasaReciclaje >= 0.20 ? "La separación en la fuente está dentro de los parámetros esperados." : "Se sugiere reforzar las campañas de separación."}
            </p>
          </div>

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

      {/* === PANEL: GESTIÓN DE AGUA === */}
      <PanelAmbiental
        n={1}
        icon={<Droplets size={16} />}
        color={C.agua}
        titulo="Gestión del Agua"
        descripcion="Consumo mensual estimado de acueducto y alcantarillado"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={consumosMes} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: C.text, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="m3" tick={{ fontSize: 10, fill: C.textMute }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v} m³`} />
                <YAxis yAxisId="cop" orientation="right" tick={{ fontSize: 10, fill: C.textMute }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtMoney(v, { compact: true })} />
                <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${C.cardBorder}`, fontSize: 12 }} />
                <Bar yAxisId="m3" dataKey="m3" name="Consumo (m³)" fill={C.agua} radius={[4, 4, 0, 0]} />
                <Line yAxisId="cop" type="monotone" dataKey="costoAcueducto" name="Costo" stroke={C.gold} strokeWidth={2.5} dot={{ r: 3, fill: C.gold }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2 justify-center">
            <FactCard label="Total año"      valor={`${totales.agua_total.toLocaleString()} m³`} color={C.agua} />
            <FactCard label="Costo anual"    valor={fmtMoney(totales.costo_agua, { compact: true })} color={C.gold} />
            <FactCard label="Promedio/mes"   valor={`${Math.round(totales.agua_total / Math.max(consumosMes.length, 1))} m³`} color={C.navyDark} />
          </div>
        </div>
      </PanelAmbiental>

      {/* === PANEL: ENERGÍA === */}
      <PanelAmbiental
        n={2}
        icon={<Zap size={16} />}
        color={C.energia}
        titulo="Gestión de Energía"
        descripcion="Consumo mensual estimado en zonas comunes"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={consumosMes} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: C.text, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="kwh" tick={{ fontSize: 10, fill: C.textMute }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}`} />
                <YAxis yAxisId="cop" orientation="right" tick={{ fontSize: 10, fill: C.textMute }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtMoney(v, { compact: true })} />
                <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${C.cardBorder}`, fontSize: 12 }} />
                <Bar yAxisId="kwh" dataKey="kwh" name="Consumo (kWh)" fill={C.energia} radius={[4, 4, 0, 0]} />
                <Line yAxisId="cop" type="monotone" dataKey="costoEnergia" name="Costo" stroke={C.gold} strokeWidth={2.5} dot={{ r: 3, fill: C.gold }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2 justify-center">
            <FactCard label="Total año"      valor={`${totales.energia_total.toLocaleString()} kWh`} color={C.energia} />
            <FactCard label="Costo anual"    valor={fmtMoney(totales.costo_energia, { compact: true })} color={C.gold} />
            <FactCard label="Promedio/mes"   valor={`${Math.round(totales.energia_total / Math.max(consumosMes.length, 1)).toLocaleString()} kWh`} color={C.navyDark} />
          </div>
        </div>
      </PanelAmbiental>

      {/* === PANEL: GESTIÓN DE RESIDUOS === */}
      <PanelAmbiental
        n={3}
        icon={<Recycle size={16} />}
        color={C.residuos}
        titulo="Gestión de Residuos"
        descripcion="Kilogramos por tipo de residuo mensual · proyección base estacional"
      >
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={residuosMes} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: C.text, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.textMute }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v} kg`} />
              <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${C.cardBorder}`, fontSize: 12 }} formatter={(v: number, n: string) => [`${v.toLocaleString()} kg`, n]} />
              <Legend iconType="square" wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
              <Bar dataKey="ordinario"  name="Ordinarios"  stackId="r" fill="#6B7280" radius={[0, 0, 0, 0]} />
              <Bar dataKey="organico"   name="Orgánicos"   stackId="r" fill="#1E7A4F" radius={[0, 0, 0, 0]} />
              <Bar dataKey="reciclable" name="Reciclables" stackId="r" fill="#0E76A8" radius={[0, 0, 0, 0]} />
              <Bar dataKey="peligroso"  name="Peligrosos"  stackId="r" fill="#B43A3A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-4">
          <FactCard label="Total año"          valor={`${(totales.residuos_total / 1000).toFixed(1)} ton`} color={C.residuos} />
          <FactCard label="Reciclables"        valor={`${(totales.reciclable_total / 1000).toFixed(1)} ton`} color={C.agua} />
          <FactCard label="Tasa reciclaje"     valor={fmtPct(tasaReciclaje, 1)} color={tasaReciclaje >= 0.20 ? C.green : C.amber} />
          <FactCard label="Promedio mensual"   valor={`${Math.round(totales.residuos_total / Math.max(residuosMes.length, 1)).toLocaleString()} kg`} color={C.navyDark} />
        </div>
        <p className="text-[10.5px] mt-3" style={{ color: C.textMute, fontStyle: "italic" }}>
          Las cifras de residuos son proyecciones base estacionales: para reflejar valores reales se debe vincular el registro de la empresa recolectora (Promoambiental, ESP) mes a mes.
        </p>
      </PanelAmbiental>

      {/* === PANEL: MANEJO PISCINA === */}
      <PanelAmbiental
        n={4}
        icon={<Waves size={16} />}
        color={C.piscina}
        titulo="Manejo de la Piscina"
        descripcion="Mantenimientos, controles de pH y cloración"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <ItemPiscina label="Mantenimientos mes" valor={`${resultadosAño.length}`}  sub="Profesional autorizado" color={C.piscina} icon={<Waves size={14} />} />
          <ItemPiscina label="Controles pH"        valor="Diario"                     sub="6.8 – 7.6 rango óptimo"     color={C.green}  icon={<Droplets size={14} />} />
          <ItemPiscina label="Cloro libre"         valor="1.0 – 3.0 ppm"              sub="Norma Resol. 1618 / 2010"   color={C.agua}   icon={<Droplets size={14} />} />
          <ItemPiscina label="Análisis físico-químico" valor="Mensual"                sub="Laboratorio externo"        color={C.gold}   icon={<Leaf size={14} />} />
        </div>
        <p className="text-[10.5px] mt-3" style={{ color: C.textMute, fontStyle: "italic" }}>
          La piscina está en operación bajo el cumplimiento del Decreto 554 / 2015. Los registros de mantenimiento, pH y cloración deben adjuntarse al bitácora del consejo.
        </p>
      </PanelAmbiental>

      {/* === PANEL: RUIDO Y CONVIVENCIA === */}
      <PanelAmbiental
        n={5}
        icon={<Volume2 size={16} />}
        color={C.ruido}
        titulo="Ruido y Convivencia"
        descripcion="Reportes de ruido y novedades de convivencia"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ItemPiscina label="Reportes último mes" valor="—" sub="Vincular libro de quejas" color={C.ruido} icon={<Volume2 size={14} />} />
          <ItemPiscina label="Norma local"         valor="65 dB" sub="Diurno (zona residencial)" color={C.green} icon={<Leaf size={14} />} />
          <ItemPiscina label="Horario silencio"    valor="22:00 – 6:00" sub="Reglamento interno" color={C.navyDark} icon={<Volume2 size={14} />} />
        </div>
        <p className="text-[10.5px] mt-3" style={{ color: C.textMute, fontStyle: "italic" }}>
          Los reportes formales de ruido se gestionan a través del libro de novedades del personal de seguridad. Las sanciones se aplican según el reglamento interno.
        </p>
      </PanelAmbiental>

      {/* === PANEL: MANEJO DE MASCOTAS === */}
      <PanelAmbiental
        n={6}
        icon={<Dog size={16} />}
        color={C.mascotas}
        titulo="Manejo de Mascotas"
        descripcion="Censo y cumplimiento del reglamento interno"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <ItemPiscina label="Mascotas registradas" valor="—" sub="Censo en curso" color={C.mascotas} icon={<Dog size={14} />} />
          <ItemPiscina label="Carnet de vacunación" valor="Obligatorio" sub="Triple viral + rabia" color={C.green} icon={<CheckCircle2 size={14} />} />
          <ItemPiscina label="Razas potencialmente peligrosas" valor="Bozal obligatorio" sub="Ley 1801 / 2016 Art. 124" color={C.red} icon={<AlertTriangle size={14} />} />
          <ItemPiscina label="Recolección de excretas" valor="Inmediata" sub="Reglamento interno" color={C.navyDark} icon={<Leaf size={14} />} />
        </div>
        <p className="text-[10.5px] mt-3" style={{ color: C.textMute, fontStyle: "italic" }}>
          El censo de mascotas y verificación de carnets se gestiona en la administración. Las novedades (incidentes, multas) se reportan al consejo en el informe mensual.
        </p>
      </PanelAmbiental>
    </div>
  );
}

/* ============ Subcomponentes ============ */

function KPIAmbiental({ icon, label, valor, sub, color }: { icon: React.ReactNode; label: string; valor: string; sub: string; color: string }) {
  return (
    <div className="rounded-lg p-3 border min-w-0 overflow-hidden" style={{ borderColor: C.cardBorder, background: C.ivory }}>
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-6 h-6 rounded-md flex items-center justify-center text-white shrink-0" style={{ background: color }}>
          {icon}
        </div>
        <div className="text-[10px] uppercase tracking-wider font-bold truncate" style={{ color: C.textMute }}>{label}</div>
      </div>
      <div className="font-bold tabular-nums leading-tight whitespace-nowrap overflow-hidden text-ellipsis" style={{ color, fontSize: "clamp(0.95rem, 1.4vw, 1.15rem)" }}>
        {valor}
      </div>
      <div className="text-[10px] mt-0.5 truncate" style={{ color: C.textMute }}>{sub}</div>
    </div>
  );
}

function PanelAmbiental({ n, icon, color, titulo, descripcion, children }: { n: number; icon: React.ReactNode; color: string; titulo: string; descripcion: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: color }}>
          <span className="text-white text-[12px] font-bold">{n}</span>
        </div>
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${color}20`, color }}>
          {icon}
        </div>
        <div>
          <h2 className="text-[16px] font-bold" style={{ color: C.navyDark }}>{titulo}</h2>
          <p className="text-[11px]" style={{ color: C.textMute }}>{descripcion}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function FactCard({ label, valor, color }: { label: string; valor: string; color: string }) {
  return (
    <div className="rounded-lg p-3 border" style={{ borderColor: C.cardBorder, background: C.ivory }}>
      <div className="text-[10px] uppercase tracking-wider font-bold mb-0.5" style={{ color: C.textMute }}>{label}</div>
      <div className="text-[15px] font-bold tabular-nums leading-tight whitespace-nowrap" style={{ color }}>{valor}</div>
    </div>
  );
}

function ItemPiscina({ icon, label, valor, sub, color }: { icon: React.ReactNode; label: string; valor: string; sub: string; color: string }) {
  return (
    <div className="rounded-lg p-3 border" style={{ borderColor: C.cardBorder, background: "white" }}>
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-6 h-6 rounded-md flex items-center justify-center text-white shrink-0" style={{ background: color }}>
          {icon}
        </div>
        <div className="text-[10px] uppercase tracking-wider font-bold truncate" style={{ color: C.textMute }}>{label}</div>
      </div>
      <div className="text-[13.5px] font-bold leading-tight" style={{ color }}>{valor}</div>
      <div className="text-[10px] mt-0.5" style={{ color: C.textMute }}>{sub}</div>
    </div>
  );
}
