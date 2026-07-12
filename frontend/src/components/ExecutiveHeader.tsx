import type { ReactNode } from "react";

interface Props {
  /** Pequeña etiqueta en dorado encima del título (ej. "Reporte ejecutivo") */
  eyebrow?: string;
  /** Título principal en blanco */
  titulo: string;
  /** Línea descriptiva debajo del título */
  subtitulo?: ReactNode;
  /** Contenido a la derecha (selectores, badges, etc.) */
  right?: ReactNode;
  /** Tamaño compacto vs estándar */
  compact?: boolean;
}

/** Header ejecutivo unificado para todos los reportes del dashboard.
 *  Paleta navy + dorado, fuente Segoe UI, gradiente con blob dorado difuminado.
 *  Coincide con el patrón de Estado de Resultados y Tablero Ejecutivo Financiero. */
export function ExecutiveHeader({ eyebrow, titulo, subtitulo, right, compact = false }: Props) {
  return (
    <header
      className={`rounded-2xl relative overflow-hidden ${compact ? "p-4 lg:p-5" : "p-5 lg:p-6"}`}
      style={{
        background: "linear-gradient(135deg, #091A2C 0%, #0F2438 100%)",
        fontFamily: "Segoe UI, system-ui, sans-serif",
      }}
    >
      {/* Blob dorado decorativo */}
      <div
        className="absolute top-0 right-0 w-48 h-48 opacity-10 rounded-full"
        style={{ background: "#C9A55C", filter: "blur(50px)", transform: "translate(30%, -30%)" }}
      />
      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          {eyebrow && (
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-5 rounded-sm" style={{ background: "#C9A55C" }} />
              <span
                className="text-[10.5px] uppercase tracking-[0.2em] font-semibold"
                style={{ color: "#C9A55C" }}
              >
                {eyebrow}
              </span>
            </div>
          )}
          <h1
            className={`${compact ? "text-[22px] sm:text-[24px]" : "text-[24px] sm:text-[28px]"} font-bold text-white leading-tight tracking-tight`}
          >
            {titulo}
          </h1>
          {subtitulo && (
            <div className="text-[12.5px] mt-1.5" style={{ color: "#D4D4D8" }}>
              {subtitulo}
            </div>
          )}
        </div>
        {right && <div className="flex items-stretch gap-2 flex-wrap">{right}</div>}
      </div>
    </header>
  );
}

/** Caja translúcida para selectores dentro del header (Año, Mes, etc.) */
export function ExecutiveSelector({
  label,
  children,
  minWidth = 100,
}: {
  label: string;
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{
        background: "rgba(255,255,255,0.10)",
        border: "1px solid rgba(201,165,92,0.35)",
      }}
    >
      <label
        className="block text-[9px] uppercase tracking-[0.18em] font-bold mb-1"
        style={{ color: "#C9A55C" }}
      >
        {label}
      </label>
      <div style={{ minWidth }} className="text-[14px] font-bold text-white">
        {children}
      </div>
    </div>
  );
}
