"""Parser de recaudo del operador inmobiliario: `Pagos del mes {MES} {AÑO}.xlsx`.

Cada archivo lista las transacciones recibidas en el mes:
  inmueble, método_pago, forma_pago, valor_pagado, comision, fecha_pago, hora_pago
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from ingestor.discover import ExcelFile
from ingestor.normalize import normalize_unidad


def _to_num(v) -> float:
    try:
        s = str(v).strip()
        if s == "" or s.lower() == "nan":
            return 0.0
        return float(s.replace(",", ""))
    except (ValueError, TypeError):
        return 0.0


def parse(file: ExcelFile) -> pd.DataFrame:
    df_raw = pd.read_excel(file.path, sheet_name=0, header=None, engine="openpyxl")
    rows: list[dict] = []
    # Header en fila 2, descripción en fila 3, datos desde fila 4
    for i in range(4, len(df_raw)):
        row = df_raw.iloc[i]
        unidad = normalize_unidad(row.get(0))
        if unidad is None:
            continue
        try:
            fecha = pd.to_datetime(row.get(10), dayfirst=True, errors="coerce")
        except Exception:
            fecha = pd.NaT
        rows.append(
            {
                "unidad": unidad,
                "cuenta_recaudo": str(row.get(1) or "").strip(),
                "metodo_pago": str(row.get(2) or "").strip(),
                "forma_pago": str(row.get(3) or "").strip(),
                "valor_pagado": _to_num(row.get(4)),
                "comision": _to_num(row.get(5)),
                "fecha_pago": fecha,
                "hora_pago": str(row.get(11) or "").strip(),
            }
        )
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df["year"] = file.year
    df["month"] = file.month
    return df
