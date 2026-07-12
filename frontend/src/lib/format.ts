/** Helpers de formato para moneda colombiana, porcentajes y enteros. */

export function fmtMoney(value: number | null | undefined, opts?: { compact?: boolean }): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (opts?.compact && abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (opts?.compact && abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  }
  return `${sign}$ ${new Intl.NumberFormat("es-CO").format(Math.round(abs))}`;
}

export function fmtPct(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(decimals)}%`;
}

export function fmtInt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("es-CO").format(Math.round(value));
}

/** "2026-04" → "Abril 2026" */
export function fmtPeriodo(yyyymm: string): string {
  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                 "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const [y, m] = yyyymm.split("-");
  return `${meses[parseInt(m, 10) - 1]} ${y}`;
}

/** "2026-04" → "Abr" */
export function fmtMesCorto(yyyymm: string): string {
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const [, m] = yyyymm.split("-");
  return meses[parseInt(m, 10) - 1] ?? yyyymm;
}
