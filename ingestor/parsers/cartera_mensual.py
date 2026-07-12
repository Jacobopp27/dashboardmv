"""Parser de cartera mensual: archivos `391 MONTEVERDI {MES}...`.

Cada archivo cubre un mes y trae el detalle por unidad de:
  - cuota de administración
  - número de factura
  - valor facturado del mes
  - valor pagado
  - cuenta pendiente (saldo)
  - fecha (día del mes en que se pagó)
  - NC / ND (notas crédito/débito)
  - cobros adicionales
  - observaciones

Una unidad puede aparecer en varias filas (pagos parciales). En ese caso,
agregamos: el valor facturado se toma de la primera fila (la única que lo trae),
y vr.pagado y cuenta pendiente se toman de la ÚLTIMA fila (refleja saldo actual).
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from ingestor.discover import ExcelFile
from ingestor.normalize import normalize_unidad


def _to_num(v) -> float:
    if v is None:
        return 0.0
    try:
        s = str(v).strip()
        if s == "" or s.lower() == "nan":
            return 0.0
        return float(s.replace(",", ""))
    except (ValueError, TypeError):
        return 0.0


def parse(file: ExcelFile) -> pd.DataFrame:
    df_raw = pd.read_excel(file.path, sheet_name=0, header=None, engine="xlrd")
    # Header en fila 2, datos desde fila 3
    rows: list[dict] = []
    for i in range(3, len(df_raw)):
        row = df_raw.iloc[i]
        # Si la primera celda dice "TOTALES" o está vacía, salir
        primera = str(row.get(0) or "").strip().upper()
        if "TOTAL" in primera:
            break
        unidad = normalize_unidad(row.get(0))
        if unidad is None:
            continue
        rows.append(
            {
                "unidad": unidad,
                "administracion": _to_num(row.get(2)),
                "factura_num": str(row.get(3) or "").strip(),
                "valor_facturado": _to_num(row.get(4)),
                "valor_pagado": _to_num(row.get(5)),
                "cuenta_pendiente": _to_num(row.get(6)),
                "dia_pago": _to_num(row.get(7)),
                "nc": _to_num(row.get(8)),
                "nd": _to_num(row.get(9)),
                "cobros_adicionales": _to_num(row.get(10)),
                "observaciones": str(row.get(11) or "").strip(),
            }
        )
    df = pd.DataFrame(rows)
    if df.empty:
        return df

    # Una unidad puede tener varias filas (pagos parciales).
    # Agregamos por unidad:
    #   - administracion, valor_facturado, factura_num: primer registro no-cero
    #   - valor_pagado: suma de todas
    #   - cuenta_pendiente: último valor (el más actual)
    #   - dia_pago: el último día reportado
    def first_nonzero(s: pd.Series):
        for v in s:
            if v not in (None, 0, 0.0, "", "nan"):
                return v
        return s.iloc[0] if len(s) else None

    agg = df.groupby("unidad", as_index=False).agg(
        administracion=("administracion", first_nonzero),
        factura_num=("factura_num", first_nonzero),
        valor_facturado=("valor_facturado", first_nonzero),
        valor_pagado=("valor_pagado", "sum"),
        cuenta_pendiente=("cuenta_pendiente", "last"),
        dia_pago=("dia_pago", "max"),
        nc=("nc", "sum"),
        nd=("nd", "sum"),
        cobros_adicionales=("cobros_adicionales", "sum"),
        observaciones=("observaciones", first_nonzero),
    )
    # Para que las sumas no queden como Decimal/None
    for c in ["administracion", "valor_facturado", "valor_pagado", "cuenta_pendiente", "nc", "nd", "cobros_adicionales"]:
        agg[c] = agg[c].astype(float)

    agg["year"] = file.year
    agg["month"] = file.month
    agg["periodo"] = pd.to_datetime(
        {"year": [file.year or 2026] * len(agg), "month": [file.month or 1] * len(agg), "day": 1}
    )
    return agg
