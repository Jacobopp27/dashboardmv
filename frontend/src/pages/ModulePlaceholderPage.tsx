import type { ReactNode } from "react";
import { Briefcase, Leaf, Users, ShieldCheck, Clock } from "lucide-react";

type ModuleKey = "administrativos" | "ambientales" | "convivencia" | "seguridad";

const META: Record<ModuleKey, { title: string; icon: ReactNode; tone: string; description: string; planned: string[] }> = {
  administrativos: {
    title: "Módulo Administrativo",
    icon: <Briefcase size={28} />,
    tone: "text-icon-blue bg-soft-blue",
    description: "Gestión de contratos, pólizas, novedades, libros oficiales y trabajos administrativos ejecutados.",
    planned: [
      "Cobertura de pólizas y estado de seguros",
      "Trabajos ejecutados vs programados",
      "Estado del fondo de imprevistos",
      "Registro de novedades del mes",
      "Libros oficiales y contables",
    ],
  },
  ambientales: {
    title: "Módulo Ambiental",
    icon: <Leaf size={28} />,
    tone: "text-icon-green bg-soft-green",
    description: "Consumo y costo de servicios públicos, manejo de residuos, fumigación y mantenimiento de jardines.",
    planned: [
      "Consumo y costo de servicios públicos por mes",
      "Comparativo histórico (2024 / 2025 / 2026)",
      "Tasa de aseo y manejo de basuras",
      "Programa SGIRS / PMIRS",
      "Mantenimiento de zonas verdes",
    ],
  },
  convivencia: {
    title: "Módulo Convivencia",
    icon: <Users size={28} />,
    tone: "text-icon-yellow bg-soft-yellow",
    description: "Afectaciones de convivencia, sanciones ejecutadas, comunicados y eventos del consejo.",
    planned: [
      "Afectaciones reportadas por mes",
      "Sanciones y llamados de atención",
      "Comunicados emitidos",
      "Acta de comité de convivencia",
      "Celebraciones y asambleas",
    ],
  },
  seguridad: {
    title: "Módulo Seguridad",
    icon: <ShieldCheck size={28} />,
    tone: "text-icon-red bg-soft-red",
    description: "Vigilancia, sistema de seguridad, SG-SST, planes de emergencia y registros de eventos.",
    planned: [
      "Indicadores de vigilancia privada",
      "Mantenimiento del sistema de seguridad",
      "Estudios de seguridad",
      "SG-SST y protocolos",
      "Incidentes y reportes",
    ],
  },
};

interface Props { moduleKey: ModuleKey }

export function ModulePlaceholderPage({ moduleKey }: Props) {
  const m = META[moduleKey];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${m.tone}`}>{m.icon}</div>
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold text-ink-900">{m.title}</h1>
          <p className="text-[13px] text-ink-500 mt-0.5">{m.description}</p>
        </div>
      </div>

      <div className="napsa-card">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={16} className="text-icon-yellow" />
          <h2 className="text-[15px] font-bold text-ink-900">Próximamente</h2>
          <span className="text-[11px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-soft-yellow text-icon-yellow">
            En construcción
          </span>
        </div>
        <p className="text-[13px] text-ink-700 mb-4">
          Este módulo será implementado en una próxima iteración. Estos son los reportes que se van a incluir:
        </p>
        <ul className="space-y-2">
          {m.planned.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-ink-700">
              <span className="w-1.5 h-1.5 rounded-full bg-brand mt-2 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
