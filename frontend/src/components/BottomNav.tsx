import { Home, BarChart3, Briefcase, Leaf, Users, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export type NavKey = "home" | "financiero" | "administrativos" | "ambientales" | "convivencia" | "seguridad";

interface Item { key: NavKey; label: string; icon: ReactNode; disabled?: boolean }

const ITEMS: Item[] = [
  { key: "home",            label: "Inicio",          icon: <Home size={20} /> },
  { key: "financiero",      label: "Financieros",     icon: <BarChart3 size={20} /> },
  { key: "administrativos", label: "Admin.",          icon: <Briefcase size={20} />,   disabled: true },
  { key: "ambientales",     label: "Ambiental",       icon: <Leaf size={20} /> },
  { key: "convivencia",     label: "Convivencia",     icon: <Users size={20} />,       disabled: true },
  { key: "seguridad",       label: "Seguridad",       icon: <ShieldCheck size={20} />, disabled: true },
];

interface Props {
  active: NavKey;
  onChange: (k: NavKey) => void;
}

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-ink-200 z-20">
      <div className="grid grid-cols-6 max-w-3xl mx-auto">
        {ITEMS.map((it) => {
          const isActive = active === it.key;
          return (
            <button
              key={it.key}
              onClick={() => !it.disabled && onChange(it.key)}
              disabled={it.disabled}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
                isActive ? "text-brand" : it.disabled ? "text-ink-300" : "text-ink-500 hover:text-ink-700"
              }`}
            >
              {it.icon}
              <span className="text-[10.5px] font-medium">{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Sidebar para desktop (lg+) */
export function SideNav({ active, onChange }: Props) {
  return (
    <aside className="hidden lg:flex flex-col w-56 border-r border-ink-200 bg-white">
      <div className="p-4">
        <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold px-3 mb-2">Secciones</div>
        <div className="space-y-1">
          {ITEMS.map((it) => {
            const isActive = active === it.key;
            return (
              <button
                key={it.key}
                onClick={() => !it.disabled && onChange(it.key)}
                disabled={it.disabled}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                  isActive
                    ? "bg-brand-50 text-brand-600 font-semibold"
                    : it.disabled
                      ? "text-ink-300 cursor-not-allowed"
                      : "text-ink-700 hover:bg-ink-50"
                }`}
              >
                {it.icon}
                <span className="text-[14px]">{it.label}</span>
                {it.disabled && <span className="ml-auto text-[10px] uppercase text-ink-300">Próx.</span>}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
