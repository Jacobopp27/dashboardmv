"""Parser de cartera anual: `Cartera 2025.xlsx`.

El archivo tiene una hoja por año con una matriz de 12 bloques (un bloque por mes,
del más reciente al más antiguo). Cada bloque ocupa 5 columnas:
  INMUEBLE | PROPIETARIO | SALDO CONTABILIDAD | FACTURACIÓN | DIFER.

Header en fila 2. La fecha del bloque está en fila 0 de la primera columna del bloque.

Devolvemos formato largo: una fila por (unidad, mes), con columnas
  periodo (Timestamp), unidad, propietario, saldo_contabilidad, facturacion, diferencia.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from ingestor.normalize import normalize_unidad


def _parse_sheet(df_raw: pd.DataFrame, year: int) -> pd.DataFrame:
    """Parsea una hoja `Cartera Cont {YEAR}` y devuelve filas largas."""
    rows: list[dict] = []
    n_cols = df_raw.shape[1]
    n_rows = df_raw.shape[0]
    # Cada bloque ocupa 5 columnas. Recorremos en pasos de 5.
    # La fecha del bloque está en fila 0, columna (block_start + 2) — encima de "SALDO CONTABILIDAD".
    for block_start in range(0, n_cols, 5):
        periodo_col = block_start + 2
        periodo_raw = df_raw.iat[0, periodo_col] if periodo_col < n_cols else None
        try:
            periodo = pd.to_datetime(periodo_raw, errors="coerce")
        except Exception:
            periodo = pd.NaT
        if pd.isna(periodo):
            continue

        # Datos: filas 3..n hasta que aparezca un total o fila vacía
        for i in range(3, n_rows):
            inmueble_raw = df_raw.iat[i, block_start] if block_start < n_cols else None
            unidad = normalize_unidad(inmueble_raw)
            if unidad is None:
                # ¿fila de totales? salir del bloque
                texto = str(inmueble_raw or "").upper()
                if "TOTAL" in texto or "CARTERA" in texto or "FACTURAC" in texto or "RECAUDO" in texto:
                    break
                continue
            try:
                propietario = str(df_raw.iat[i, block_start + 1] or "").strip()
                saldo = float(df_raw.iat[i, block_start + 2] or 0)
                facturacion = float(df_raw.iat[i, block_start + 3] or 0)
                diferencia = float(df_raw.iat[i, block_start + 4] or 0)
            except (ValueError, TypeError, IndexError):
                continue
            rows.append(
                {
                    "periodo": periodo,
                    "year": year,
                    "month": periodo.month,
                    "unidad": unidad,
                    "propietario": propietario,
                    "saldo_contabilidad": saldo,
                    "facturacion": facturacion,
                    "diferencia": diferencia,
                }
            )
    return pd.DataFrame(rows)


def parse(path: Path) -> pd.DataFrame:
    sheets = pd.read_excel(path, sheet_name=None, header=None, engine="openpyxl")
    frames: list[pd.DataFrame] = []
    import re
    for sname, df_raw in sheets.items():
        # Aceptar tanto "Cartera Cont YYYY" como "CARTERA YYYY" — ambos usan el
        # mismo layout de bloques mensuales de 5 columnas.
        name = str(sname).strip()
        m = re.match(r"(?:cartera\s+cont|cartera)\s+(20\d{2})", name, re.IGNORECASE)
        if not m:
            continue
        year_from_name = int(m.group(1))
        parsed = _parse_sheet(df_raw, year_from_name)
        # El parser ya usa `periodo.year` real de cada bloque; el `year_from_name`
        # es solo referencia. Filtramos por consistencia usando periodo.
        frames.append(parsed)
    if not frames:
        return pd.DataFrame()
    df = pd.concat(frames, ignore_index=True)
    # Sobrescribir "year" con el año real del período (para que el filter en el
    # endpoint /api/cartera-anual?year=YYYY funcione correctamente)
    if not df.empty:
        df["year"] = df["periodo"].dt.year
        df["month"] = df["periodo"].dt.month
    return df
