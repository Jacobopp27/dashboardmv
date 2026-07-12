"""
Inspector de Excels de Monteverdi P.H.

Recorre D:\\2026 Monteverdi, clasifica archivos por patrón, abre 1 representativo
de cada categoría y reporta hojas, dimensiones, columnas y primeras filas.

Salida: D:\\DASHBOARD 2026\\inspeccion_excels.md
"""
from __future__ import annotations

import re
import sys
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import pandas as pd

DATA_ROOT = Path(r"D:\2026 Monteverdi")
OUT_REPORT = Path(r"D:\DASHBOARD 2026\inspeccion_excels.md")

# ----------------------------------------------------------------------------
# Categorías y patrones (regex sobre el nombre del archivo, case-insensitive)
# El orden importa: el primer patrón que matchea gana.
# ----------------------------------------------------------------------------
CATEGORIES: list[tuple[str, str]] = [
    ("estados_financieros", r"INFORMES?\s+FINANCIEROS?.*\.xlsx?$"),
    ("modelo_graficos",     r"modelo de graficos estados financiero.*\.xlsx?$"),
    ("presupuesto",         r"(PROYECTO\s+PPTO|Proyecto ppto|Proyecci(o|ó)n de gastos).*\.xlsx?$"),
    ("cartera_facturacion", r"^391 MONTEVERDI.*\.xlsx?$"),
    ("recaudo_inmobiliaria",r"^(Recaudo )?Pagos del mes.*\.xlsx?$"),
    ("pagos_egresos",       r"^2026 PAGOS.*\.xlsx?$"),
    ("extracto_bancario",   r"(extracto|_(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\d{4}).*\.xlsx?$"),
    ("servicios_publicos",  r"Servicios publicos\.xlsx?$"),
    ("informe_admin",       r"informe Administrativo.*\.xlsx?$"),
    ("informe_gestion",     r"informes? de gestion.*\.xlsx?$"),
    ("informe_operativo",   r"informe Operativo.*\.xlsx?$"),
    ("informe_convivencia", r"informe Convivencia.*\.xlsx?$"),
    ("bitacora_piscina",    r"bitacora piscina.*\.xlsx?$"),
    ("piscina_quimicos",    r"PISCINA.*QUIMICOS.*\.xlsx?$"),
    ("seguimiento_aseo",    r"SEGUIMIENTO ASEO.*\.xlsx?$"),
    ("cartera_anual",       r"^Cartera 20\d{2}\.xlsx?$"),
    ("estado_cuenta_unidad",r"Discriminado-EstadoCuenta.*\.xlsx?$"),
    ("plantilla_kailiving", r"Plantilla parametrizaci.n KaiLiving.*\.xlsx?$"),
    ("programacion_consejo",r"Programacion reuniones.*\.xlsx?$"),
]


@dataclass
class FileEntry:
    path: Path
    category: str
    size_kb: float
    mtime: str


def is_excel(p: Path) -> bool:
    if p.name.startswith("~$"):
        return False
    return p.suffix.lower() in {".xls", ".xlsx", ".xlsm"}


def classify(name: str) -> str:
    for cat, pat in CATEGORIES:
        if re.search(pat, name, flags=re.IGNORECASE):
            return cat
    return "otros"


def scan() -> dict[str, list[FileEntry]]:
    groups: dict[str, list[FileEntry]] = {}
    for p in DATA_ROOT.rglob("*"):
        if not p.is_file() or not is_excel(p):
            continue
        cat = classify(p.name)
        entry = FileEntry(
            path=p,
            category=cat,
            size_kb=p.stat().st_size / 1024,
            mtime=pd.Timestamp(p.stat().st_mtime, unit="s").strftime("%Y-%m-%d %H:%M"),
        )
        groups.setdefault(cat, []).append(entry)
    # Ordenar cada grupo por mtime descendente (lo más nuevo primero)
    for cat in groups:
        groups[cat].sort(key=lambda e: e.mtime, reverse=True)
    return groups


def safe_read_sheets(path: Path) -> dict[str, pd.DataFrame] | str:
    """Lee todas las hojas. Devuelve dict o un string de error."""
    try:
        suffix = path.suffix.lower()
        if suffix == ".xls":
            sheets = pd.read_excel(path, sheet_name=None, engine="xlrd", header=None)
        else:
            sheets = pd.read_excel(path, sheet_name=None, engine="openpyxl", header=None)
        return sheets
    except Exception as e:
        return f"ERROR al leer: {type(e).__name__}: {e}"


def describe_sheet(df: pd.DataFrame, max_preview_rows: int = 8, max_preview_cols: int = 12) -> str:
    """Devuelve un bloque markdown describiendo la hoja."""
    rows, cols = df.shape
    lines = [f"- **Shape:** {rows} filas × {cols} columnas"]
    if rows == 0 or cols == 0:
        return "\n".join(lines + ["- _(hoja vacía)_"])
    # Mostrar primeras filas como tabla
    preview = df.iloc[: max_preview_rows, : max_preview_cols].copy()
    preview = preview.fillna("").astype(str)
    # Truncar valores largos
    preview = preview.apply(lambda col: col.map(lambda v: (v[:40] + "…") if len(v) > 40 else v))
    lines.append(f"- **Primeras {min(max_preview_rows, rows)} filas (cols 0..{min(max_preview_cols, cols)-1}):**\n")
    lines.append("```")
    lines.append(preview.to_string(index=True, header=False))
    lines.append("```")
    return "\n".join(lines)


def inspect_file(entry: FileEntry, max_sheets: int = 6) -> list[str]:
    out: list[str] = []
    out.append(f"### 📄 `{entry.path.name}`")
    out.append(f"- **Ruta:** `{entry.path}`")
    out.append(f"- **Tamaño:** {entry.size_kb:,.1f} KB · **Modificado:** {entry.mtime}")
    result = safe_read_sheets(entry.path)
    if isinstance(result, str):
        out.append(f"- ⚠️ {result}")
        return out
    sheets = result
    out.append(f"- **Hojas ({len(sheets)}):** {', '.join(repr(s) for s in list(sheets.keys())[:20])}")
    for i, (name, df) in enumerate(sheets.items()):
        if i >= max_sheets:
            out.append(f"\n_(... {len(sheets) - max_sheets} hojas adicionales omitidas)_")
            break
        out.append(f"\n#### Hoja: `{name}`")
        out.append(describe_sheet(df))
    return out


def main():
    print(f"Escaneando {DATA_ROOT} ...")
    if not DATA_ROOT.exists():
        sys.exit(f"No existe la ruta: {DATA_ROOT}")

    groups = scan()
    total = sum(len(v) for v in groups.values())
    print(f"Archivos Excel encontrados: {total}")
    for cat, items in sorted(groups.items()):
        print(f"  - {cat}: {len(items)}")

    md: list[str] = []
    md.append("# Inspección de Excels — Monteverdi P.H.")
    md.append(f"\nRuta base: `{DATA_ROOT}`\n")
    md.append(f"Total archivos Excel detectados: **{total}**\n")
    md.append("## Resumen por categoría\n")
    md.append("| Categoría | # archivos | Más reciente |")
    md.append("|---|---:|---|")
    for cat in sorted(groups.keys()):
        items = groups[cat]
        latest = items[0]
        md.append(f"| `{cat}` | {len(items)} | {latest.path.name} ({latest.mtime}) |")
    md.append("")

    md.append("## Listado completo por categoría\n")
    for cat in sorted(groups.keys()):
        items = groups[cat]
        md.append(f"### Categoría: `{cat}` ({len(items)} archivos)")
        for e in items:
            md.append(f"- `{e.path.relative_to(DATA_ROOT)}` · {e.size_kb:,.1f} KB · {e.mtime}")
        md.append("")

    md.append("---\n\n## Inspección detallada (1 archivo representativo por categoría)\n")
    # Para cada categoría, abrimos el más reciente
    for cat in sorted(groups.keys()):
        if cat == "otros":
            continue
        items = groups[cat]
        if not items:
            continue
        md.append(f"## 🗂️ Categoría: `{cat}`\n")
        rep = items[0]
        try:
            md.extend(inspect_file(rep))
        except Exception:
            md.append("```\n" + traceback.format_exc() + "\n```")
        md.append("\n---\n")

    # Categoría "otros" — solo listado
    if "otros" in groups:
        md.append("## 🗂️ Categoría: `otros` (sin patrón conocido)\n")
        for e in groups["otros"]:
            md.append(f"- `{e.path.relative_to(DATA_ROOT)}`")

    OUT_REPORT.parent.mkdir(parents=True, exist_ok=True)
    OUT_REPORT.write_text("\n".join(md), encoding="utf-8")
    print(f"\nReporte escrito: {OUT_REPORT}")


if __name__ == "__main__":
    main()
