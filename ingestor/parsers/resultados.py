"""Parser del Estado Integral de Resultados.

Lee el archivo financiero más reciente con la hoja "ESTADO DE RESULTADOS" o
similar. Extrae por mes:
  - Ingresos operacionales (cuotas + fondo imprevistos)
  - Ingresos marginales (intereses, descuentos, otros)
  - Egresos por categoría: Mantenimiento, Seguridad, Convivencia, Ambiental, Administrativos
  - Total egresos
  - Resultado del mes

Devuelve un DataFrame largo: year, month, periodo, concepto, categoria, valor.
También devuelve presupuesto anual y mensual por categoría.
"""
from __future__ import annotations

import re
from pathlib import Path

import pandas as pd


# Mapeo de etiquetas (en col 1) a categoría/concepto canónico
CATEGORIAS: dict[str, str] = {
    "total mantenimiento y mejoras":    "Mantenimiento",
    "total riesgos y seguridad":        "Seguridad",
    "total seguridad":                  "Seguridad",
    "total convivencia":                "Convivencia",
    "total ambiental":                  "Ambiental",
    "total administrativos":            "Administrativos",
}

INGRESO_OPERACIONAL = "total ingreso operacional"
INGRESO_MARGINAL = "otros ingresos marginales"
TOTAL_EGRESOS = "total egresos operacionales mes"
RESULTADO = "resultado presupuestal mes"


# Columnas: el header en fila 4. Estructura típica:
#   col 0 ó 1: concepto
#   col 1 ó 2: PPTO ANUAL
#   col 2 ó 3: PTTO MES
#   col 3..14 (o 4..15): REAL ENE, REAL FEB, ..., REAL DIC
#   penúltima: EJECUTADO ACUMUL
#   última:    PPTO ACUMUL

MESES_REAL_RE = re.compile(r"REAL\s+(ENE|FEB|MAR|MARZO|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)", re.IGNORECASE)
MES_NUM = {"ENE": 1, "FEB": 2, "MAR": 3, "MARZO": 3, "ABR": 4, "MAY": 5, "JUN": 6,
           "JUL": 7, "AGO": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DIC": 12}


def _to_num(v) -> float:
    if v is None:
        return 0.0
    try:
        if isinstance(v, str):
            s = v.strip().replace(",", "")
            if s == "" or s.lower() in {"nan", "none"}:
                return 0.0
            return float(s)
        if isinstance(v, (int, float)) and not pd.isna(v):
            return float(v)
    except (ValueError, TypeError):
        pass
    return 0.0


def _find_header_row(df: pd.DataFrame) -> int | None:
    """Encuentra la fila con los headers (busca 'REAL ENE' o 'PPTO ANUAL')."""
    for i in range(min(15, len(df))):
        row_txt = " ".join(str(v) for v in df.iloc[i].tolist() if isinstance(v, str))
        if MESES_REAL_RE.search(row_txt):
            return i
    return None


def _detect_columns(df: pd.DataFrame, header_row: int) -> dict:
    """Encuentra qué columna corresponde a cada concepto (ppto_anual, ppto_mes, real_ene..dic, ejec_acum, ppto_acum)."""
    cols: dict = {}
    for c in range(df.shape[1]):
        v = df.iat[header_row, c]
        if not isinstance(v, str):
            continue
        up = v.upper().strip()
        if "PPTO" in up and "ANUAL" in up:
            cols["ppto_anual"] = c
        elif (up.startswith("PTTO.") or up.startswith("PPTO.")) and "ANUAL" not in up and "ACUM" not in up:
            cols.setdefault("ppto_mes", c)
        elif up == "PTTO" or up == "PPTO":
            cols.setdefault("ppto_mes", c)
        elif up.startswith("REAL "):
            m = MESES_REAL_RE.search(up)
            if m:
                num = MES_NUM[m.group(1).upper()]
                cols[f"real_{num:02d}"] = c
        elif "EJECUTADO" in up and "ACUM" in up:
            cols["ejec_acum"] = c
        elif "PTTO" in up and "ACUM" in up:
            cols["ppto_acum"] = c
        elif "PPTO" in up and "ACUM" in up:
            cols["ppto_acum"] = c
    return cols


def _label(df: pd.DataFrame, row: int) -> str:
    """El label suele estar en col 0 o col 1."""
    for c in range(min(3, df.shape[1])):
        v = df.iat[row, c]
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def parse(path: Path, year: int) -> dict:
    """Lee el archivo financiero más reciente y devuelve:
      - df_egresos: long DataFrame con (year, month, categoria, valor)
      - df_ingresos: long DataFrame con (year, month, concepto, valor)
      - df_presupuesto: DataFrame con (categoria, presupuesto_anual)
      - df_resultado_mes: DataFrame con (year, month, resultado)
    """
    engine = "xlrd" if path.suffix.lower() == ".xls" else "openpyxl"
    sheets = pd.read_excel(path, sheet_name=None, header=None, engine=engine)
    # Buscar la hoja que comience con 'ESTADO DE RESULTADOS'
    hoja = None
    for sname in sheets:
        if sname.upper().startswith("ESTADO DE RESULTADOS"):
            hoja = sname
            break
    if hoja is None:
        return {"egresos": pd.DataFrame(), "ingresos": pd.DataFrame(),
                "presupuesto": pd.DataFrame(), "resultado": pd.DataFrame()}
    df = sheets[hoja]
    header_row = _find_header_row(df)
    if header_row is None:
        return {"egresos": pd.DataFrame(), "ingresos": pd.DataFrame(),
                "presupuesto": pd.DataFrame(), "resultado": pd.DataFrame()}
    cols = _detect_columns(df, header_row)
    real_cols = {int(k.split("_")[1]): v for k, v in cols.items() if k.startswith("real_")}

    egresos_rows = []
    ingresos_rows = []
    presup_rows = []
    resultado_rows: list[dict] = []

    for i in range(header_row + 1, len(df)):
        label = _label(df, i).lower()
        if not label:
            continue

        # Ingreso operacional
        if INGRESO_OPERACIONAL in label:
            for mes, col in real_cols.items():
                v = _to_num(df.iat[i, col])
                ingresos_rows.append({"year": year, "month": mes, "concepto": "Operacional", "valor": v})
            continue
        # Ingresos marginales
        if INGRESO_MARGINAL in label:
            for mes, col in real_cols.items():
                v = _to_num(df.iat[i, col])
                ingresos_rows.append({"year": year, "month": mes, "concepto": "Marginal", "valor": v})
            continue
        # Total egresos
        if TOTAL_EGRESOS in label or "total egresos operacional" in label:
            for mes, col in real_cols.items():
                v = _to_num(df.iat[i, col])
                egresos_rows.append({"year": year, "month": mes, "categoria": "TOTAL_EGRESOS", "valor": v})
            continue
        # Resultado
        if RESULTADO in label:
            for mes, col in real_cols.items():
                v = _to_num(df.iat[i, col])
                resultado_rows.append({"year": year, "month": mes, "resultado": v})
            continue
        # Categorías de egresos
        cat = None
        for etq, c in CATEGORIAS.items():
            if etq in label:
                cat = c
                break
        if cat is not None:
            # Presupuesto anual + mensual
            ppto_anual = _to_num(df.iat[i, cols["ppto_anual"]]) if "ppto_anual" in cols else 0.0
            ppto_mes = _to_num(df.iat[i, cols["ppto_mes"]]) if "ppto_mes" in cols else 0.0
            ppto_acum = _to_num(df.iat[i, cols["ppto_acum"]]) if "ppto_acum" in cols else 0.0
            ejec_acum = _to_num(df.iat[i, cols["ejec_acum"]]) if "ejec_acum" in cols else 0.0
            presup_rows.append({
                "categoria": cat,
                "presupuesto_anual": ppto_anual,
                "presupuesto_mes": ppto_mes,
                "ppto_acum": ppto_acum,
                "ejecutado_acum": ejec_acum,
            })
            # Reales por mes
            for mes, col in real_cols.items():
                v = _to_num(df.iat[i, col])
                egresos_rows.append({"year": year, "month": mes, "categoria": cat, "valor": v})

    df_egresos = pd.DataFrame(egresos_rows)
    df_ingresos = pd.DataFrame(ingresos_rows)
    df_presupuesto = pd.DataFrame(presup_rows)
    df_resultado = pd.DataFrame(resultado_rows)

    return {
        "egresos": df_egresos,
        "ingresos": df_ingresos,
        "presupuesto": df_presupuesto,
        "resultado": df_resultado,
    }


# ============== Sub-categorías individuales (líneas detalladas) ==============
# Etiquetas que marcan el cambio de sección de gastos
SECCIONES_GASTO = {
    "mantenimiento (infraestructura)":         "MANTENIMIENTO",
    "mantenimento (infraestructura)":          "MANTENIMIENTO",  # typo común
    "mantenimiento":                            "MANTENIMIENTO",
    "seguridad":                                "SEGURIDAD",
    "convivencia":                              "CONVIVENCIA",
    "ambiental":                                "AMBIENTAL",
    "administrativos":                          "ADMINISTRATIVOS",
}

# Filas que son sub-totales o headers (no se incluyen como subcategoría)
EXCLUIR_LINEA = (
    "total ", "gastos operacionales", "estado de resultados", "ingresos",
    "operacionales", "resultado", "fecha", "concepto", "ppto",
)


def parse_subcategorias(path: Path, year: int) -> dict:
    """Extrae TODAS las líneas individuales del estado de resultados, con su
    presupuesto y valor por cada mes. Devuelve:

    {
      "ingresos":  [{label, presupuesto_anual, presupuesto_mes, meses: {1: v, ..., 12: v}}, ...],
      "gastos":    [{categoria, label, presupuesto_anual, presupuesto_mes, meses: {...}}, ...]
    }
    """
    engine = "xlrd" if path.suffix.lower() == ".xls" else "openpyxl"
    sheets = pd.read_excel(path, sheet_name=None, header=None, engine=engine)
    hoja = None
    for sname in sheets:
        if sname.upper().startswith("ESTADO DE RESULTADOS"):
            hoja = sname
            break
    if hoja is None:
        return {"ingresos": [], "gastos": []}
    df = sheets[hoja]
    header_row = _find_header_row(df)
    if header_row is None:
        return {"ingresos": [], "gastos": []}
    cols = _detect_columns(df, header_row)
    real_cols = {int(k.split("_")[1]): v for k, v in cols.items() if k.startswith("real_")}

    ingresos = []
    gastos = []
    seccion_actual = "INGRESOS"  # arranca en la sección de ingresos
    seccion_padre = None  # sección de gasto vigente

    for i in range(header_row + 1, len(df)):
        label = _label(df, i)
        if not label:
            continue
        ll = label.lower().strip()

        # Detectar cambio de sección
        if "gastos operacionales" in ll or "egresos operacionales" in ll:
            seccion_actual = "GASTOS"
            continue
        # Header de sección de gasto (mantenimiento, seguridad, etc.)
        for marker, nombre_sec in SECCIONES_GASTO.items():
            if ll.startswith(marker) and "total" not in ll:
                seccion_padre = nombre_sec
                # No agregar el header como fila
                break
        else:
            # No es un header de sección, procesar como línea de detalle
            # Excluir totales y filas auxiliares
            if any(ll.startswith(x) for x in EXCLUIR_LINEA):
                continue
            # Excluir el ingreso operacional total y el ingreso marginal total (ya están en `parse`)
            if "total ingreso operacional" in ll or "otros ingresos marginales" in ll:
                continue

            # Leer presupuesto y valores mensuales
            ppto_anual = _to_num(df.iat[i, cols["ppto_anual"]]) if "ppto_anual" in cols else 0.0
            ppto_mes   = _to_num(df.iat[i, cols["ppto_mes"]]) if "ppto_mes" in cols else 0.0
            meses_v: dict[int, float] = {}
            for m, c in real_cols.items():
                meses_v[m] = _to_num(df.iat[i, c])

            # Solo agregar si la fila tiene algún valor (ppto o real > 0)
            tiene_valor = ppto_anual > 0 or ppto_mes > 0 or any(v > 0 for v in meses_v.values())
            if not tiene_valor:
                continue

            row = {
                "label": label.strip(),
                "presupuesto_anual": ppto_anual,
                "presupuesto_mes": ppto_mes,
                "meses": meses_v,
            }
            if seccion_actual == "INGRESOS":
                ingresos.append(row)
            else:
                # En sección de gastos: heredar la categoría padre (Mantenimiento, etc.)
                row["categoria"] = seccion_padre or "OTROS"
                gastos.append(row)

    return {"ingresos": ingresos, "gastos": gastos, "year": year}
