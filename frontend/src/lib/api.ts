/** Cliente API tipado para el backend FastAPI. */

// En desarrollo local: cadena vacía → proxy de Vite a localhost:8000.
// En producción (Vercel): VITE_API_URL apunta al backend en Railway,
// ej. https://monteverdi-backend.up.railway.app
const BASE = import.meta.env.VITE_API_URL ?? "";

export interface Meta {
  years_available: number[];
  files_by_category: Record<string, number>;
  latest_periodo: { cartera_mensual?: string; recaudo?: string };
  n_unidades: number;
}

export interface KPIs {
  periodo: string;
  total_facturado: number;
  total_recaudado: number;
  cartera_pendiente: number;
  pct_recaudo: number;
  n_morosos: number;
  n_unidades: number;
  n_transacciones_recaudo: number;
  por_forma_pago: { forma: string; valor: number }[];
}

export interface SerieMensualPoint {
  periodo: string;
  facturado: number;
  recaudado: number;
  pendiente: number;
}

export interface CarteraUnidad {
  unidad: number;
  administracion: number;
  factura_num: string | null;
  valor_facturado: number;
  valor_pagado: number;
  cuenta_pendiente: number;
  dia_pago: number;
  year: number;
  month: number;
  periodo: string;
  observaciones?: string;
}

export interface Unidad {
  unidad: number;
  rol: "propietario" | "residente";
  nombre_completo: string;
  correo: string | null;
  celular: string | null;
}

export interface RecaudoTx {
  unidad: number;
  metodo_pago: string;
  forma_pago: string;
  valor_pagado: number;
  comision: number;
  fecha_pago: string;
  year: number;
  month: number;
}

export interface ResumenMensual {
  periodo: string;          // "YYYY-MM"
  year: number;
  month: number;
  facturado: number;
  recaudado: number;
  cartera_total: number;    // saldo pendiente al cierre del mes
  n_morosos: number;
  n_unidades: number;
  pct_recaudo: number;      // 0..1
  pct_morosa: number;       // cartera_total / facturado
}

export interface AgingUnidad {
  unidad: number;
  propietario: string;
  saldo: number;
  meses_mora: number;
  bucket: string;
}

export interface AgingBucket {
  bucket: string;
  unidades: number;
  valor: number;
}

export interface AgingReporte {
  corte: string;
  unidades: AgingUnidad[];
  buckets: AgingBucket[];
}

export interface AgingMes {
  periodo: string;
  total: number;
  vencido_60: number;
  buckets: AgingBucket[];
}

export interface AgingAnual {
  year: number;
  por_mes: Record<string, AgingMes>;
}

export interface LineaFlujo {
  label: string;
  presupuesto_anual: number;
  presupuesto_mes: number;
  meses: Record<string, number>;  // "1".."12" → valor
  categoria?: string;             // solo para gastos: MANTENIMIENTO, SEGURIDAD, etc.
}

export interface FlujoDetallado {
  year: number;
  ingresos: LineaFlujo[];
  gastos: LineaFlujo[];
}

// ----- Bloque 2: Financiero -----

export interface FinancieroMeta {
  years_available: number[];
  n_balances: number;
  fuentes: { balance: string | null; resultados: string[] };
}

export interface SaldoMes {
  periodo: string;
  year: number;
  month: number;
  efectivo_caja: number;
  banco_operacion: number;
  fiducia: number;
  inversion_cdt: number;
  disponible_total: number;
}

export interface LiquidezMes {
  periodo: string;
  year: number;
  month: number;
  activo_corriente: number;
  pasivo_corriente: number;
  razon_corriente: number | null;
  prueba_acida: number | null;
  liquidez_disponible: number | null;
  copropietarios: number;
  gastos_prepagados: number;
  // Detalle de activos
  efectivo_caja?: number;
  banco_operacion?: number;
  fiducia?: number;
  inversion_cdt?: number;
  consignaciones_pendientes?: number;
  deudores_varios?: number;
  anticipo_proveedores?: number;
  total_activo?: number;
  // Detalle de pasivos
  cuentas_por_pagar?: number;
  retencion_impuestos?: number;
  reteica?: number;
  consignaciones_por_pagar?: number;
  total_cuentas_por_pagar?: number;
  total_pasivos_diferidos?: number;
  total_otros_pasivos?: number;
  total_pasivo?: number;
  // Patrimonio
  fondo_imprevistos?: number;
  total_patrimonio?: number;
}

export interface ResultadoMes {
  periodo: string;
  year: number;
  month: number;
  ingreso_operacional: number;
  ingreso_marginal: number;
  egreso_mantenimiento: number;
  egreso_seguridad: number;
  egreso_convivencia: number;
  egreso_ambiental: number;
  egreso_administrativos: number;
  egreso_total_egresos: number;
  resultado: number;
  diferencia: number;
}

export interface EjecucionPpto {
  categoria: string;
  presupuesto_anual: number;
  ejecutado_acumulado: number;
  pct_ejecucion: number | null;
  diferencia: number;
}

export interface IndicadoresFin {
  periodo: string;
  razon_corriente: number | null;
  razon_acida: number | null;
  endeudamiento: number | null;
  cobertura_intereses: number | null;
  activo_corriente: number;
  pasivo_corriente: number;
  efectivo_total: number;
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

export const api = {
  meta:               ()                     => getJSON<Meta>("/api/meta"),
  kpis:               (y: number, m: number) => getJSON<KPIs>(`/api/kpis/${y}/${m}`),
  serieMensual:       (year?: number)        => getJSON<SerieMensualPoint[]>(`/api/serie-mensual${year ? `?year=${year}` : ""}`),
  carteraMensual:     (year?: number)        => getJSON<CarteraUnidad[]>(`/api/cartera-mensual${year ? `?year=${year}` : ""}`),
  carteraResumenMensual: (year: number)      => getJSON<ResumenMensual[]>(`/api/cartera-resumen-mensual?year=${year}`),
  carteraAging:       (y: number, m: number) => getJSON<AgingReporte>(`/api/cartera-aging?year=${y}&month=${m}`),
  carteraAgingAnual:  (y: number)            => getJSON<AgingAnual>(`/api/cartera-aging-anual?year=${y}`),
  finFlujoDetallado:  (y: number)            => getJSON<FlujoDetallado>(`/api/financiero/flujo-detallado?year=${y}`),
  recaudo:            (year?: number)        => getJSON<RecaudoTx[]>(`/api/recaudo${year ? `?year=${year}` : ""}`),
  unidades:           ()                     => getJSON<Unidad[]>("/api/unidades"),
  refresh:            ()                     => fetch("/api/refresh", { method: "POST" }).then(r => r.json()),
  // Financiero
  finMeta:            ()                     => getJSON<FinancieroMeta>("/api/financiero/meta"),
  finSaldos:          (year?: number)        => getJSON<SaldoMes[]>(`/api/financiero/saldos${year ? `?year=${year}` : ""}`),
  finLiquidez:        (year?: number)        => getJSON<LiquidezMes[]>(`/api/financiero/liquidez${year ? `?year=${year}` : ""}`),
  finResultados:      (year?: number)        => getJSON<ResultadoMes[]>(`/api/financiero/resultados${year ? `?year=${year}` : ""}`),
  finEjecucionPpto:   (year: number)         => getJSON<EjecucionPpto[]>(`/api/financiero/ejecucion-presupuesto?year=${year}`),
  finIndicadores:     (year?: number)        => getJSON<IndicadoresFin>(`/api/financiero/indicadores${year ? `?year=${year}` : ""}`),
};
