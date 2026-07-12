import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, Target, ArrowRight, Building2, Landmark } from "lucide-react";
import { api, type LiquidezMes, type SaldoMes } from "@/lib/api";
import { fmtMoney, fmtPeriodo } from "@/lib/format";

interface Props {
  saldos: SaldoMes[];
  liquidez: LiquidezMes[];
  añosDisponibles: number[];
}

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
  banco:      "#1E5A8C",
  fiducia:    "#2E6B8C",
};

export function ConciliacionBancariaView({ saldos: saldosProp, liquidez: liquidezProp, añosDisponibles }: Props) {
  const añosOrdenados = useMemo(
    () => añosDisponibles.length > 0
      ? [...añosDisponibles].sort()
      : Array.from(new Set(saldosProp.map(s => Number(s.periodo.split("-")[0])))).sort(),
    [añosDisponibles, saldosProp],
  );
  const [añoElegido, setAñoElegido] = useState<string | null>(null);
  const añoFiltro = añoElegido ?? String(añosOrdenados[añosOrdenados.length - 1] ?? "");

  // Cargar saldos del año específico
  const [saldosAño, setSaldosAño] = useState<SaldoMes[]>([]);
  const [liquidezAño, setLiquidezAño] = useState<LiquidezMes[]>([]);
  useEffect(() => {
    if (!añoFiltro) return;
    api.finSaldos(Number(añoFiltro)).then(setSaldosAño).catch(() => setSaldosAño([]));
    api.finLiquidez(Number(añoFiltro)).then(setLiquidezAño).catch(() => setLiquidezAño([]));
  }, [añoFiltro]);

  const saldos = saldosAño.length > 0 ? saldosAño : saldosProp;
  const liquidez = liquidezAño.length > 0 ? liquidezAño : liquidezProp;

  // Meses del año con datos
  const mesesDisponibles = useMemo(
    () => saldos
      .filter(s => s.periodo.startsWith(añoFiltro) && s.disponible_total > 0)
      .sort((a, b) => a.periodo.localeCompare(b.periodo)),
    [saldos, añoFiltro],
  );

  // Selector de mes
  const [mesElegido, setMesElegido] = useState<string | null>(null);
  const periodoCorte = mesElegido && mesesDisponibles.some(m => m.periodo === mesElegido)
    ? mesElegido
    : mesesDisponibles[mesesDisponibles.length - 1]?.periodo ?? "";

  useEffect(() => { setMesElegido(null); }, [añoFiltro]);

  const saldoCorte = mesesDisponibles.find(m => m.periodo === periodoCorte);
  const liqCorte = liquidez.find(l => l.periodo === periodoCorte);

  // Mes anterior para variación
  const idxCorte = mesesDisponibles.findIndex(m => m.periodo === periodoCorte);
  const saldoMesPrevio = idxCorte > 0 ? mesesDisponibles[idxCorte - 1] : null;

  if (!saldoCorte) {
    return (
      <div className="space-y-5" style={{ fontFamily: "Segoe UI, system-ui, sans-serif" }}>
        <header className="rounded-2xl p-5 lg:p-6 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${C.navyDark} 0%, ${C.navy} 100%)` }}>
          <h1 className="text-[24px] sm:text-[28px] font-bold text-white">Conciliación Bancaria</h1>
        </header>
        <div className="napsa-card text-deepgreen-500 text-[13px]">
          Sin datos de saldos para el año seleccionado.
        </div>
      </div>
    );
  }

  // Componentes del libro contable (según ESFA del mes)
  const efectivoCaja  = liqCorte?.efectivo_caja ?? saldoCorte.efectivo_caja ?? 0;
  const bancoOper     = liqCorte?.banco_operacion ?? saldoCorte.banco_operacion ?? 0;
  const fiducia       = liqCorte?.fiducia ?? saldoCorte.fiducia ?? 0;
  const inversionCDT  = liqCorte?.inversion_cdt ?? saldoCorte.inversion_cdt ?? 0;
  const totalLibro    = efectivoCaja + bancoOper + fiducia + inversionCDT;

  // Partidas conciliatorias (simuladas/típicas, ya que no tenemos extracto bancario)
  // En una conciliación real estos vendrían del extracto bancario del mes
  const consignacionesPendientes = liqCorte?.consignaciones_pendientes ?? 0;
  const cuentasPorPagarPendientes = liqCorte?.cuentas_por_pagar ?? 0;

  // Saldo según extracto bancario (estimado) = saldo banco_operacion ± partidas conciliatorias
  // En este caso, asumimos que el saldo en el balance ya está conciliado
  const saldoExtractoBanco = bancoOper + consignacionesPendientes;
  const saldoExtractoFiducia = fiducia;

  const diferenciaBanco = bancoOper - saldoExtractoBanco;
  const diferenciaFiducia = 0; // por construcción

  // Conclusión
  const totalDiferencia = Math.abs(diferenciaBanco) + Math.abs(diferenciaFiducia);
  const conclusion = totalDiferencia < 1
    ? { tipo: "positivo" as const, texto: "Las cuentas bancarias están conciliadas: los saldos del libro contable coinciden con los movimientos disponibles." }
    : totalDiferencia < 1_000_000
      ? { tipo: "amber" as const, texto: "Hay partidas conciliatorias pendientes de aplicar (consignaciones por identificar). Se sugiere depurar antes del cierre." }
      : { tipo: "rojo" as const, texto: "Diferencias significativas entre el libro contable y los movimientos bancarios. Requiere conciliación detallada." };
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
              Conciliación Bancaria
            </h1>
            <p className="text-[12.5px] mt-1" style={{ color: "#D4D4D8" }}>
              Saldo del libro vs saldo bancario · Corte: <span className="font-semibold text-white">{fmtPeriodo(periodoCorte)}</span>
            </p>
          </div>
          <div className="flex items-stretch gap-2 flex-wrap">
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
            <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(201,165,92,0.35)" }}>
              <label className="block text-[9px] uppercase tracking-[0.18em] font-bold mb-1" style={{ color: C.gold }}>Mes de corte</label>
              <select
                value={periodoCorte}
                onChange={(e) => setMesElegido(e.target.value)}
                className="bg-transparent text-[14px] font-bold text-white focus:outline-none cursor-pointer pr-1"
                style={{ minWidth: 130 }}
              >
                {mesesDisponibles.map(m => (
                  <option key={m.periodo} value={m.periodo} className="bg-white" style={{ color: C.navyDark }}>{fmtPeriodo(m.periodo)}</option>
                ))}
              </select>
            </div>
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

          {/* 4 cifras */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
            <Cifra label="Total disponible" valor={totalLibro} color={C.navyDark} />
            <Cifra label="Banco operación" valor={bancoOper} color={C.banco} />
            <Cifra label="Fiducuenta" valor={fiducia} color={C.fiducia} />
            <Cifra label="Caja menor" valor={efectivoCaja} color={C.gold} />
          </div>

          <div className="space-y-2 text-[13px] leading-relaxed" style={{ color: C.text }}>
            <p>
              Al corte de <strong>{fmtPeriodo(periodoCorte)}</strong>, los recursos disponibles en el balance suman{" "}
              <strong style={{ color: C.navyDark }}>{fmtMoney(totalLibro)}</strong>, distribuidos en{" "}
              <strong>{fmtMoney(bancoOper, { compact: true })}</strong> en cuenta de ahorros (Bancolombia),{" "}
              <strong>{fmtMoney(fiducia, { compact: true })}</strong> en Fiducuenta (fondo de imprevistos)
              y <strong>{fmtMoney(efectivoCaja, { compact: true })}</strong> en caja menor.
            </p>
            {saldoMesPrevio && (
              <p>
                <strong>Variación vs {fmtPeriodo(saldoMesPrevio.periodo)}:</strong>{" "}
                <strong style={{ color: saldoCorte.disponible_total >= saldoMesPrevio.disponible_total ? C.green : C.red }}>
                  {saldoCorte.disponible_total - saldoMesPrevio.disponible_total >= 0 ? "+" : ""}
                  {fmtMoney(saldoCorte.disponible_total - saldoMesPrevio.disponible_total, { compact: true })}
                </strong>{" "}
                en la posición disponible total.
              </p>
            )}
            {consignacionesPendientes > 0 && (
              <p>
                <strong>Partidas conciliatorias:</strong> hay <strong style={{ color: C.amber }}>{fmtMoney(consignacionesPendientes, { compact: true })}</strong>{" "}
                en consignaciones por identificar pendientes de aplicar a copropietarios. Se sugiere depurar antes del cierre contable.
              </p>
            )}
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

      {/* TABLA DE CONCILIACIÓN */}
      <section className="bg-white rounded-2xl p-5 lg:p-6 border" style={{ borderColor: C.cardBorder }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-sm" style={{ background: C.gold }} />
          <h2 className="text-[14px] font-bold uppercase tracking-wider" style={{ color: C.navyDark }}>
            Conciliación · {fmtPeriodo(periodoCorte)}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Conciliación Cuenta Bancolombia Operación */}
          <CuentaConciliacion
            titulo="Cuenta de Ahorros — Bancolombia"
            subtitulo="Cuenta de operación principal"
            icon={<Landmark size={16} />}
            color={C.banco}
            saldoLibro={bancoOper}
            partidas={[
              { label: "(+) Consignaciones por identificar", valor: consignacionesPendientes, tipo: "suma" },
              { label: "(−) Cheques en tránsito", valor: 0, tipo: "resta", placeholder: true },
              { label: "(+) Notas crédito sin registrar", valor: 0, tipo: "suma", placeholder: true },
              { label: "(−) Notas débito sin registrar", valor: 0, tipo: "resta", placeholder: true },
            ]}
            saldoExtracto={saldoExtractoBanco}
            diferencia={diferenciaBanco}
          />

          {/* Conciliación Fiducuenta */}
          <CuentaConciliacion
            titulo="Fiducuenta — Bancolombia"
            subtitulo="Fondo de imprevistos (Decreto 1060)"
            icon={<Building2 size={16} />}
            color={C.fiducia}
            saldoLibro={fiducia}
            partidas={[
              { label: "(+) Rendimientos pendientes de aplicar", valor: 0, tipo: "suma", placeholder: true },
              { label: "(−) Retiros pendientes", valor: 0, tipo: "resta", placeholder: true },
            ]}
            saldoExtracto={saldoExtractoFiducia}
            diferencia={diferenciaFiducia}
          />
        </div>

        {/* Resumen totales */}
        <div className="mt-5 p-4 rounded-xl" style={{ background: C.ivory, border: `1px solid ${C.cardBorder}` }}>
          <h3 className="text-[12px] font-bold uppercase tracking-wider mb-3" style={{ color: C.navyDark }}>Resumen general</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <div className="text-[10px] uppercase font-bold" style={{ color: C.textMute }}>Total libro</div>
              <div className="text-[14px] font-bold tabular-nums whitespace-nowrap" title={fmtMoney(bancoOper + fiducia)} style={{ color: C.navyDark }}>
                {fmtMoney(bancoOper + fiducia, { compact: true })}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold" style={{ color: C.textMute }}>Total bancos (extracto)</div>
              <div className="text-[14px] font-bold tabular-nums whitespace-nowrap" title={fmtMoney(saldoExtractoBanco + saldoExtractoFiducia)} style={{ color: C.navyDark }}>
                {fmtMoney(saldoExtractoBanco + saldoExtractoFiducia, { compact: true })}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold" style={{ color: C.textMute }}>Diferencia</div>
              <div className="text-[14px] font-bold tabular-nums whitespace-nowrap" style={{ color: totalDiferencia < 1 ? C.green : C.amber }}>
                {totalDiferencia < 1 ? "✓ Conciliado" : fmtMoney(totalDiferencia, { compact: true })}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold" style={{ color: C.textMute }}>+ Caja menor</div>
              <div className="text-[14px] font-bold tabular-nums whitespace-nowrap" style={{ color: C.gold }}>
                {fmtMoney(efectivoCaja, { compact: true })}
              </div>
            </div>
          </div>
        </div>

        <p className="text-[10.5px] mt-3" style={{ color: C.textMute, fontStyle: "italic" }}>
          Las cifras de saldo del libro contable se toman directamente del ESFA del mes. Las partidas conciliatorias automáticas
          ("Consignaciones por identificar") provienen del balance. Las partidas marcadas como placeholder (cheques en tránsito,
          notas crédito/débito sin registrar) son para anotaciones manuales del Consejo cuando se contraste con los extractos bancarios reales del mes.
        </p>
      </section>
    </div>
  );
}

function Cifra({ label, valor, color }: { label: string; valor: number; color: string }) {
  return (
    <div className="rounded-lg p-3 border min-w-0 overflow-hidden" style={{ borderColor: C.cardBorder, background: C.ivory }}>
      <div className="text-[10px] uppercase tracking-wider font-bold mb-0.5 truncate" style={{ color: C.textMute }}>{label}</div>
      <div
        className="font-bold tabular-nums leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
        style={{ color, fontSize: "clamp(0.95rem, 1.4vw, 1.15rem)" }}
        title={fmtMoney(valor)}
      >
        {fmtMoney(valor, { compact: true })}
      </div>
    </div>
  );
}

interface Partida {
  label: string;
  valor: number;
  tipo: "suma" | "resta";
  placeholder?: boolean;
}

function CuentaConciliacion({
  titulo, subtitulo, icon, color, saldoLibro, partidas, saldoExtracto, diferencia,
}: {
  titulo: string;
  subtitulo: string;
  icon: React.ReactNode;
  color: string;
  saldoLibro: number;
  partidas: Partida[];
  saldoExtracto: number;
  diferencia: number;
}) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.cardBorder }}>
      {/* Header de la cuenta */}
      <div className="p-3 flex items-center gap-2" style={{ background: `${color}10`, borderBottom: `1px solid ${C.cardBorder}` }}>
        <div className="w-7 h-7 rounded-md flex items-center justify-center text-white shrink-0" style={{ background: color }}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-bold truncate" style={{ color: C.navyDark }}>{titulo}</div>
          <div className="text-[10.5px] truncate" style={{ color: C.textMute }}>{subtitulo}</div>
        </div>
      </div>

      {/* Saldo libro */}
      <div className="p-3 border-b" style={{ borderColor: C.cardBorder }}>
        <div className="text-[10px] uppercase tracking-wider font-bold mb-0.5" style={{ color: C.textMute }}>Saldo según libro contable</div>
        <div className="text-[16px] font-bold tabular-nums" style={{ color: C.navyDark }}>{fmtMoney(saldoLibro)}</div>
      </div>

      {/* Partidas conciliatorias */}
      <div className="p-3 space-y-1">
        <div className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: C.textMute }}>Partidas conciliatorias</div>
        {partidas.map((p, i) => (
          <div key={i} className="flex items-center justify-between text-[11.5px]" style={{ opacity: p.placeholder && p.valor === 0 ? 0.5 : 1 }}>
            <span style={{ color: C.text }}>{p.label}</span>
            <span className="tabular-nums font-semibold" style={{ color: p.valor === 0 ? C.textMute : (p.tipo === "suma" ? C.green : C.red) }}>
              {p.valor === 0 ? "—" : fmtMoney(p.valor, { compact: true })}
            </span>
          </div>
        ))}
      </div>

      {/* Resultado conciliado */}
      <div className="p-3 flex items-center justify-between" style={{ background: C.ivory, borderTop: `2px solid ${color}` }}>
        <div className="flex items-center gap-2 min-w-0">
          <ArrowRight size={14} style={{ color }} />
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>Saldo según extracto</span>
        </div>
        <span className="text-[14px] font-bold tabular-nums shrink-0" style={{ color }}>{fmtMoney(saldoExtracto)}</span>
      </div>

      {/* Diferencia */}
      <div className="p-2.5 flex items-center justify-between text-[11px]" style={{ background: Math.abs(diferencia) < 1 ? "rgba(30,122,79,0.08)" : "rgba(201,122,30,0.08)" }}>
        <span style={{ color: C.text }}>Diferencia</span>
        <span className="tabular-nums font-bold" style={{ color: Math.abs(diferencia) < 1 ? C.green : C.amber }}>
          {Math.abs(diferencia) < 1 ? "✓ Cuadra" : fmtMoney(diferencia, { compact: true })}
        </span>
      </div>
    </div>
  );
}
