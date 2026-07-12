"""Parser del Balance General (ESFA) — Estado de la Situación Financiera.

Lee el archivo `2026 modelo de graficos estados financiero- 00.xlsx` que contiene
una hoja "ESFA {MES} {AÑO}" por cada mes histórico. De cada hoja extrae los
saldos clave para análisis de liquidez:
  - efectivo_caja, banco_operacion, fiducia, inversion_cdt
  - cuentas_por_cobrar, gastos_prepagados
  - cuentas_por_pagar, retenciones
  - total_activo_corriente, total_pasivo_corriente
  - fondo_imprevistos

Devuelve un DataFrame con una fila por periodo (year, month).
"""
from __future__ import annotations

import re
from pathlib import Path

import pandas as pd


# Mapa concepto → bucket. El parser busca estas etiquetas en columna 0 (case-insensitive).
ETIQUETAS_ACTIVO = {
    "caja menor": "efectivo_caja",
    "bancolombia cuenta de operación": "banco_operacion",
    "bancolombia cuenta operacion": "banco_operacion",
    "fiducuenta bancolombia": "fiducia",
    "inversion cdt": "inversion_cdt",
    "copropietarios": "copropietarios",
    "consignaciones por identificar": "consignaciones_pendientes",
    "deudores varios": "deudores_varios",
    "anticipo proveedores": "anticipo_proveedores",
    "poliza seguro": "gastos_prepagados",
    "total activo": "total_activo",
}
ETIQUETAS_PASIVO = {
    "costos y gastos por pagar": "cuentas_por_pagar",
    "retencion impuestos": "retencion_impuestos",
    "reteica": "reteica",
    "consignaciones por identificar": "consignaciones_por_pagar",  # versión pasivo
    "total cuentas por pagar": "total_cuentas_por_pagar",
    "total pasivos diferidos": "total_pasivos_diferidos",
    # Provisión vigilancia — varios formatos visto en archivos reales:
    "provisión gasto vigilancia": "provision_vigilancia",
    "provision gasto vigilancia": "provision_vigilancia",
    "provision viligalncia": "provision_vigilancia",  # typo presente en archivos 2026
    "provision vigilancia": "provision_vigilancia",
    "total otros pasivos": "total_otros_pasivos",
    "total pasivo": "total_pasivo",
    "fondo de imprevistos": "fondo_imprevistos",
    "total patrimonio": "total_patrimonio",
}
# Marcadores que indican el inicio de cada sección del ESFA
SECCION_ACTIVO = ("activo",)
SECCION_PASIVO = ("pasivo", "cuentas por pagar")
SECCION_PATRIMONIO = ("patrimonio",)


# Hoja → periodo. Mapeo de meses en abreviatura ESPAÑOLA.
MES_ABR = {
    "ENE": 1, "FEB": 2, "MAR": 3, "MARZ": 3, "ABR": 4, "ABRIL": 4,
    "MAY": 5, "JUN": 6, "JUL": 7, "AGO": 8, "AGOST": 8,
    "SEP": 9, "OCT": 10, "NOV": 11, "DIC": 12, "DICI": 12,
}


def _detect_period_from_sheet(name: str) -> tuple[int, int] | None:
    """Extrae (year, month) de un nombre de hoja como 'ESFA DICI 2025' o 'ESFA FEB 2026'."""
    n = name.upper()
    m_year = re.search(r"(20\d{2})", n)
    if not m_year:
        return None
    year = int(m_year.group(1))
    # buscar abreviatura de mes
    for token, num in sorted(MES_ABR.items(), key=lambda x: -len(x[0])):
        if re.search(rf"\b{token}\b", n):
            return year, num
    return None


def _to_num(v) -> float:
    if v is None:
        return 0.0
    try:
        if isinstance(v, str) and v.strip() == "":
            return 0.0
        return float(v)
    except (ValueError, TypeError):
        return 0.0


def _parse_sheet(df: pd.DataFrame, year: int, month: int) -> dict:
    """Parsea una hoja ESFA con detección dinámica de la sección actual.

    Estructura real:
      - col 1: label (ej. 'CAJA MENOR', 'BANCOLOMBIA CUENTA DE OPERACIÓN')
      - col 2: valor del mes actual
      - col 3: valor del mes anterior (comparativo)

    El parser rastrea en qué sección está (ACTIVO/PASIVO/PATRIMONIO) para diferenciar
    etiquetas que pueden aparecer en ambos lados (ej. CONSIGNACIONES POR IDENTIFICAR
    aparece como menor valor de cartera en ACTIVO Y como cuenta por pagar en PASIVO).
    """
    row = {"year": year, "month": month, "periodo": pd.Timestamp(year=year, month=month, day=1)}
    seccion = "ACTIVO"  # default — el archivo empieza por activos
    for i in range(len(df)):
        label = ""
        for col in range(min(3, df.shape[1])):
            v = df.iat[i, col]
            if isinstance(v, str) and v.strip():
                label = v.strip().lower()
                break
        if not label:
            continue

        # Detectar cambio de sección por etiqueta clave standalone
        # (ej. fila que sólo dice "PASIVO" o "PATRIMONIO")
        if label == "pasivo" or label.startswith("pasivo "):
            seccion = "PASIVO"
        elif "cuentas por pagar" in label and "total" not in label:
            seccion = "PASIVO"
        elif label == "patrimonio" or label.startswith("patrimonio "):
            seccion = "PATRIMONIO"

        # Tomar el primer valor numérico tras el label (cols 2, 1, 3 en ese orden)
        valor = 0.0
        for col in [2, 1, 3]:
            if col >= df.shape[1]:
                continue
            cell = df.iat[i, col]
            if isinstance(cell, (int, float)) and not pd.isna(cell):
                valor = float(cell)
                break

        # Mapear según la sección actual
        mapa = ETIQUETAS_ACTIVO if seccion == "ACTIVO" else ETIQUETAS_PASIVO
        for etq, key in mapa.items():
            if etq in label:
                if row.get(key) not in (0, 0.0, None):
                    continue
                row[key] = valor
                break

        # Total patrimonio y total pasivo pueden aparecer en zona patrimonio también
        if seccion == "PATRIMONIO":
            for etq, key in ETIQUETAS_PASIVO.items():
                if etq in label and key in ("fondo_imprevistos", "total_patrimonio"):
                    if row.get(key) not in (0, 0.0, None):
                        continue
                    row[key] = valor
                    break

    # Las "Consignaciones por identificar" se registran SOLO donde el archivo Excel
    # las haya clasificado contablemente:
    #   - En ACTIVO (negativo): cuando son consignaciones pendientes de aplicar a
    #     copropietarios (menor valor de cartera).
    #   - En PASIVO: cuando ya fueron identificadas y corresponden a terceros
    #     externos a la copropiedad (ej. abril 2026 — autorización administrativa).
    # No se reflejan automáticamente al otro lado: respetar la decisión del Excel.

    return row


def parse_informe_mensual(path: Path) -> dict | None:
    """Parsea la hoja 'ESFA' de un archivo de informe financiero mensual
    (ej. '04-2026-INFORMES FINANCIEROS ABRIL DE 2026...xls').

    La columna 2 contiene el balance del mes más reciente (mes del informe).
    Detecta el período desde la fecha en fila 5, col 2.
    """
    try:
        engine = "xlrd" if path.suffix.lower() == ".xls" else "openpyxl"
        sheets = pd.read_excel(path, sheet_name=None, header=None, engine=engine)
    except Exception:
        return None
    df = None
    # Buscar hoja ESFA — puede llamarse "ESFA", "ESFA FEBRERO 2026", "ESFA MARZO 26", etc.
    EXCLUDE_TOKENS = ("GRAF", "TABLA", "AÑO", "ANO")
    candidates = []
    for sname, s in sheets.items():
        up = sname.upper().strip()
        if not up.startswith("ESFA"):
            continue
        if any(tok in up for tok in EXCLUDE_TOKENS):
            continue
        if s.empty or s.shape[0] < 10:
            continue
        candidates.append((sname, s))
    if not candidates:
        return None
    # Si hay varios, preferir el que tenga fecha más reciente en col 2 fila 5
    df = candidates[0][1]
    if df is None or df.empty or df.shape[0] < 10:
        return None
    # Detectar fecha de corte: el layout varía entre informes (algunos en fila 5,
    # otros en fila 4). Probamos varias filas y columnas hasta encontrar una fecha válida.
    fecha = None
    for row in range(3, 7):
        if row >= df.shape[0]:
            continue
        for col in range(2, min(5, df.shape[1])):
            raw = df.iat[row, col]
            try:
                f = pd.to_datetime(raw, errors="coerce", dayfirst=False)
                if f is not None and not pd.isna(f) and 2020 <= f.year <= 2030:
                    fecha = f
                    break
            except Exception:
                continue
        if fecha is not None:
            break

    # Fallback: extraer mes y año del nombre de la hoja (ej. "ESFAmay 2026")
    if fecha is None or pd.isna(fecha):
        for sname, _ in candidates:
            period = _detect_period_from_sheet(sname)
            if period is not None:
                y, m = period
                fecha = pd.Timestamp(year=y, month=m, day=1)
                break
    if fecha is None or pd.isna(fecha):
        return None
    return _parse_sheet(df, fecha.year, fecha.month)


def parse(modelo_graficos_path: Path) -> pd.DataFrame:
    """Devuelve DataFrame con una fila por (year, month) extrayendo todos los ESFA
    individuales del archivo modelo de gráficos.
    """
    sheets = pd.read_excel(modelo_graficos_path, sheet_name=None, header=None, engine="openpyxl")
    rows = []
    seen_periods: set[tuple[int, int]] = set()
    EXCLUDE = ("GRAF", "FINAL", "AÑO", "AÑO", "ANO", "TABLA")
    for sname, df in sheets.items():
        up = sname.upper().strip()
        if not up.startswith("ESFA "):
            continue
        if any(tok in up for tok in EXCLUDE):
            continue
        if df.empty or df.shape[0] < 10:
            continue
        period = _detect_period_from_sheet(sname)
        if period is None:
            continue
        if period in seen_periods:
            continue
        seen_periods.add(period)
        year, month = period
        rows.append(_parse_sheet(df, year, month))

    out = pd.DataFrame(rows)
    if out.empty:
        return out

    # Calculados:
    # Activo corriente = efectivo + fiducia + inversiones + cuentas por cobrar netas + anticipos + prepagados
    cols_activo = ["efectivo_caja", "banco_operacion", "fiducia", "inversion_cdt",
                   "copropietarios", "consignaciones_pendientes", "deudores_varios",
                   "anticipo_proveedores", "gastos_prepagados"]
    for c in cols_activo:
        if c not in out.columns:
            out[c] = 0.0
    out["activo_corriente"] = sum(out[c].fillna(0) for c in cols_activo)

    # Si el archivo trae "total_activo" directo, ese también lo guardamos como referencia.
    if "total_activo" not in out.columns:
        out["total_activo"] = out["activo_corriente"]

    # Pasivo corriente = cuentas por pagar + retenciones + otros pasivos (NO pasivos diferidos)
    for c in ["cuentas_por_pagar", "retencion_impuestos", "reteica", "total_otros_pasivos"]:
        if c not in out.columns:
            out[c] = 0.0
    out["pasivo_corriente"] = (
        out["cuentas_por_pagar"].fillna(0)
        + out["retencion_impuestos"].fillna(0)
        + out["reteica"].fillna(0)
        + out["total_otros_pasivos"].fillna(0)
    )

    # Indicadores
    # Razón corriente (índice base 1) = activo corriente / pasivo corriente
    out["razon_corriente"] = out.apply(
        lambda r: (r["activo_corriente"] / r["pasivo_corriente"]) if r["pasivo_corriente"] > 0 else None,
        axis=1,
    )
    # Liquidez disponible (efectivo) = (caja + banco + fiducia) / pasivo corriente
    out["liquidez_disponible"] = out.apply(
        lambda r: ((r["efectivo_caja"] + r["banco_operacion"] + r["fiducia"]) / r["pasivo_corriente"])
                  if r["pasivo_corriente"] > 0 else None,
        axis=1,
    )
    # Prueba ácida = (activo corriente - gastos prepagados) / pasivo corriente
    out["prueba_acida"] = out.apply(
        lambda r: ((r["activo_corriente"] - r["gastos_prepagados"]) / r["pasivo_corriente"])
                  if r["pasivo_corriente"] > 0 else None,
        axis=1,
    )

    out = out.sort_values("periodo").reset_index(drop=True)
    return out
