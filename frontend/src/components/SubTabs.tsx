export type SubTabKey = "principales" | "mensuales" | "presupuesto" | "cartera" | "avanzado";

const TABS: { key: SubTabKey; label: string }[] = [
  { key: "principales",  label: "Informes Principales" },
  { key: "mensuales",    label: "Estados Mensuales" },
  { key: "presupuesto",  label: "Presupuesto" },
  { key: "cartera",      label: "Cartera" },
  { key: "avanzado",     label: "Análisis Avanzado" },
];

interface Props {
  active: SubTabKey;
  onChange: (k: SubTabKey) => void;
}

export function SubTabs({ active, onChange }: Props) {
  return (
    <div className="border-b border-ink-200 -mx-5 px-5 overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors whitespace-nowrap ${
              active === t.key
                ? "border-sand-400 text-navy-700"
                : "border-transparent text-ink-500 hover:text-navy-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
