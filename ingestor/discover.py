"""Descubre archivos Excel relevantes recorriendo DATA_ROOT.

Devuelve listas tipadas por categoría, ya ordenadas por fecha de modificación
descendente y deduplicadas (cuando hay copias del mismo archivo en varias carpetas
o varias versiones del mismo mes, conserva la más reciente).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from config.settings import DATA_ROOT


MESES_ES = {
    "ENE": 1, "ENERO": 1,
    "FEB": 2, "FEBRERO": 2,
    "MAR": 3, "MARZO": 3,
    "ABR": 4, "ABRIL": 4,
    "MAY": 5, "MAYO": 5,
    "JUN": 6, "JUNIO": 6,
    "JUL": 7, "JULIO": 7,
    "AGO": 8, "AGOSTO": 8,
    "SEP": 9, "SEPT": 9, "SEPTIEMBRE": 9,
    "OCT": 10, "OCTUBRE": 10,
    "NOV": 11, "NOVIEMBRE": 11,
    "DIC": 12, "DICIEMBRE": 12,
}


@dataclass(frozen=True)
class ExcelFile:
    path: Path
    category: str
    year: int | None
    month: int | None  # 1..12 si aplica
    mtime: float

    @property
    def label(self) -> str:
        if self.year and self.month:
            return f"{self.year}-{self.month:02d}"
        return self.path.stem


def _is_excel(p: Path) -> bool:
    if p.name.startswith("~$"):
        return False
    return p.suffix.lower() in {".xls", ".xlsx", ".xlsm"}


def _detect_year_month(name: str) -> tuple[int | None, int | None]:
    """Extrae año y mes del nombre del archivo.

    Toma el PRIMER mes que aparece en el texto (no el primer match del dict),
    porque la convención de nombres pone el mes de cobertura antes que el de la
    siguiente facturación (ej. "DICIEMBRE 2025 Recaudo facturacion enero 2026"
    → mes=12, no mes=1).
    """
    upper = name.upper()
    year_match = re.search(r"(20\d{2})", upper)
    year = int(year_match.group(1)) if year_match else None

    # Buscar TODOS los meses y quedarse con el de menor posición.
    # Probamos primero los nombres largos (ENERO antes que ENE) para evitar
    # solapamientos donde \bENE\b matchee dentro de \bENERO\b (no debería pero por seguridad).
    earliest_pos: int | None = None
    month: int | None = None
    tokens_sorted = sorted(MESES_ES.keys(), key=lambda t: -len(t))
    for token in tokens_sorted:
        for m in re.finditer(rf"\b{token}\b", upper):
            pos = m.start()
            if earliest_pos is None or pos < earliest_pos:
                earliest_pos = pos
                month = MESES_ES[token]
                break  # solo el primer match de este token

    # Patrones tipo "01-2026", "12-2025"
    if month is None:
        m = re.search(r"\b(0[1-9]|1[0-2])[-_/](20\d{2})\b", upper)
        if m:
            month = int(m.group(1))
            year = year or int(m.group(2))

    return year, month


def _classify(name: str) -> str | None:
    """Devuelve la categoría o None si el archivo no nos interesa para el Bloque 1."""
    n = name
    if re.search(r"^391 MONTEVERDI", n, re.IGNORECASE):
        return "cartera_mensual"
    if re.search(r"Pagos del mes", n, re.IGNORECASE):
        return "recaudo"
    if re.search(r"^Cartera 20\d{2}\.xlsx?$", n, re.IGNORECASE):
        return "cartera_anual"
    if re.search(r"Plantilla parametrizaci.n KaiLiving", n, re.IGNORECASE):
        return "maestro_unidades"
    return None


def scan() -> dict[str, list[ExcelFile]]:
    """Recorre DATA_ROOT y devuelve dict {categoria: [ExcelFile,...]}."""
    from datetime import datetime
    by_cat: dict[str, list[ExcelFile]] = {}
    for p in DATA_ROOT.rglob("*"):
        if not p.is_file() or not _is_excel(p):
            continue
        cat = _classify(p.name)
        if cat is None:
            continue
        year, month = _detect_year_month(p.name)
        mtime = p.stat().st_mtime
        # Si no detectamos año pero sí mes, asumimos el año del mtime
        if year is None and month is not None:
            year = datetime.fromtimestamp(mtime).year
        entry = ExcelFile(
            path=p,
            category=cat,
            year=year,
            month=month,
            mtime=mtime,
        )
        by_cat.setdefault(cat, []).append(entry)
    for cat in by_cat:
        by_cat[cat].sort(key=lambda e: e.mtime, reverse=True)
    return by_cat


def latest_per_month(files: list[ExcelFile]) -> list[ExcelFile]:
    """De una lista, conserva solo la versión más reciente por (year, month)."""
    seen: dict[tuple[int | None, int | None], ExcelFile] = {}
    for f in files:
        key = (f.year, f.month)
        if key not in seen or f.mtime > seen[key].mtime:
            seen[key] = f
    out = list(seen.values())
    out.sort(key=lambda e: (e.year or 0, e.month or 0))
    return out
