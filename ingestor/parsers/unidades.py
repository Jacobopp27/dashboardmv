"""Parser del maestro de unidades (Plantilla KaiLiving).

Devuelve un DataFrame con una fila por residente/propietario, columnas:
  unidad, rol (propietario|residente), nombre_completo, correo, celular
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from ingestor.normalize import normalize_unidad


# Datos de ejemplo en la plantilla KaiLiving (filas 6-7) que hay que descartar
NOMBRES_EJEMPLO = {"juan", "carlos rodríguez", "carlos rodriguez", "maría", "maria"}


def _clean(v) -> str:
    """Convierte celda a string limpio. 'nan'/'none'/vacío -> ''."""
    if v is None:
        return ""
    s = str(v).strip()
    if s.lower() in {"nan", "none", "null"}:
        return ""
    return s


def parse(path: Path) -> pd.DataFrame:
    df_raw = pd.read_excel(path, sheet_name="Worksheet", header=None, engine="openpyxl")
    rows: list[dict] = []
    # Header está en fila 5 (índice 5); datos desde fila 6
    # Columnas relevantes (índice):
    #   2: Casa
    #   4: Nombres propietario
    #   5: Apellidos propietario
    #   6: Correo propietario
    #   7: Celular propietario
    #   8: Nombres residente
    #   9: Apellidos residente
    #  10: Correo residente
    #  11: Celular residente
    for i in range(6, len(df_raw)):
        row = df_raw.iloc[i]
        unidad = normalize_unidad(row.get(2))
        if unidad is None:
            continue

        # Propietario
        nombres_p = _clean(row.get(4))
        apellidos_p = _clean(row.get(5))
        if nombres_p and nombres_p.lower() not in NOMBRES_EJEMPLO:
            rows.append(
                {
                    "unidad": unidad,
                    "rol": "propietario",
                    "nombre_completo": f"{nombres_p} {apellidos_p}".strip(),
                    "correo": _clean(row.get(6)) or None,
                    "celular": _clean(row.get(7)) or None,
                }
            )

        # Residente
        nombres_r = _clean(row.get(8))
        apellidos_r = _clean(row.get(9))
        if nombres_r and nombres_r.lower() not in NOMBRES_EJEMPLO:
            rows.append(
                {
                    "unidad": unidad,
                    "rol": "residente",
                    "nombre_completo": f"{nombres_r} {apellidos_r}".strip(),
                    "correo": _clean(row.get(10)) or None,
                    "celular": _clean(row.get(11)) or None,
                }
            )

    df = pd.DataFrame(rows)
    return df
