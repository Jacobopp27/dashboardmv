"""Exporta datos parseados de los Excels a un JSON consumible por nexurbis.

Reutiliza los parsers existentes (ingestor.loader / ingestor.financiero) y emite
un JSON con el contrato acordado para el importador TypeScript de nexurbis.

Uso:
    DATA_ROOT="/ruta/a/data" python -m scripts.export_para_nexurbis \
        --year 2026 --month 5 --out /tmp/mayo2026.json

Si se omiten --year/--month, exporta TODO el histórico disponible.

Contrato de salida (JSON):
{
  "meta": {"year": 2026, "month": 5, "generado": "..."},
  "viviendas":   [{"numero":"101","propietario":{...},"residente":{...}}],
  "personas":    [{"unidad":101,"rol":"propietario|residente","nombre_completo":"..",
                   "correo":"..","celular":".."}],
                  # SIN agrupar (una fila por persona real tal como la ve
                  # /api/unidades en Python). A diferencia de "viviendas" —que
                  # solo trae el PRIMER propietario/residente por unidad—, esta
                  # lista sí incluye copropietarios adicionales. F3a la usa para
                  # reconciliar el maestro de residentes en Postgres.
  "cartera":     [{"unidad":101,"year":..,"month":..,"valor_facturado":..,
                   "valor_pagado":..,"cuenta_pendiente":..}],
  "cartera_anual": [{"unidad":101,"year":..,"month":..,"facturacion":..,
                     "saldo_contabilidad":..,"diferencia":..,"propietario":".."}],
                    # Histórico 2024-2025 (Cartera 2025.xlsx). Complementa
                    # "cartera" para períodos que cartera_mensual no cubre.
  "recaudo":     [{"unidad":101,"forma_pago":"..","metodo_pago":"..",
                   "valor_pagado":..,"fecha_pago":"YYYY-MM-DD"}],
  "balance":     [{"year":..,"month":..,"efectivo_caja":..,...}],
  "resultado":   [{"year":..,"month":..,"tipo":"ingreso|egreso",
                   "categoria":"..","valor":..}],
  "presupuesto": [{"year":..,"categoria":"..","presupuesto_anual":..}],
  "flujo_detallado": [{"year":2026,
                       "ingresos": [{"label":"..","presupuesto_anual":..,
                                     "presupuesto_mes":..,"meses":{"1":..,...,"12":..}}],
                       "gastos":   [{"categoria":"MANTENIMIENTO","label":"..",
                                     "presupuesto_anual":..,"presupuesto_mes":..,
                                     "meses":{"1":..,...,"12":..}}]}],
                    # F3b: líneas individuales del estado de resultados (subcategorías),
                    # una entrada por año detectado en los informes financieros. Misma
                    # selección de archivo y semántica que
                    # backend/api.py::financiero_flujo_detallado (ver
                    # ingestor/parsers/resultados.py::parse_subcategorias).
}
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

# Paquetes locales importables
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd

from ingestor.financiero import load_financiero
from ingestor.loader import load_all
from ingestor.parsers import resultados as resultados_parser


def _num(v):
    """float JSON-safe (NaN/Inf -> None)."""
    if v is None:
        return None
    try:
        f = float(v)
    except (ValueError, TypeError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f


def _str(v):
    """String limpio JSON-safe; NaN/None/vacío/'nan' -> None."""
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    s = str(v).strip()
    if s == "" or s.lower() in {"nan", "none", "null", "<na>"}:
        return None
    return s


def _date(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    try:
        ts = pd.Timestamp(v)
        return None if pd.isna(ts) else ts.strftime("%Y-%m-%d")
    except Exception:
        return None


def _filtra(df: pd.DataFrame, year: int | None, month: int | None) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame() if df is None else df
    out = df
    if year is not None and "year" in out.columns:
        out = out[out["year"] == year]
    if month is not None and "month" in out.columns:
        out = out[out["month"] == month]
    return out


def build_viviendas(unidades: pd.DataFrame) -> list[dict]:
    """Una vivienda por unidad, con propietario y residente (si existen)."""
    if unidades is None or unidades.empty:
        return []
    out: list[dict] = []
    for unidad, grupo in unidades.groupby("unidad"):
        prop = grupo[grupo["rol"] == "propietario"].head(1)
        resi = grupo[grupo["rol"] == "residente"].head(1)

        def persona(sub):
            if sub.empty:
                return None
            r = sub.iloc[0]
            return {
                "nombre": _str(r.get("nombre_completo")),
                "correo": _str(r.get("correo")),
                "celular": _str(r.get("celular")),
            }

        out.append({
            "numero": str(int(unidad)),
            "propietario": persona(prop),
            "residente": persona(resi),
        })
    out.sort(key=lambda v: int(v["numero"]))
    return out


def build_personas(unidades: pd.DataFrame) -> list[dict]:
    """Una fila por persona real (sin agrupar). Espeja /api/unidades del backend
    Python; a diferencia de build_viviendas, no descarta copropietarios."""
    if unidades is None or unidades.empty:
        return []
    out = [
        {
            "unidad": int(r["unidad"]),
            "rol": _str(r.get("rol")),
            "nombre_completo": _str(r.get("nombre_completo")),
            "correo": _str(r.get("correo")),
            "celular": _str(r.get("celular")),
        }
        for _, r in unidades.iterrows()
    ]
    out.sort(key=lambda p: (p["unidad"], p["rol"] or ""))
    return out


def build_cartera_anual(df: pd.DataFrame, year: int | None, month: int | None) -> list[dict]:
    """Histórico 2024-2025 de ingestor/parsers/cartera_anual.py, ya en formato
    largo (unidad, year, month). Usa los mismos helpers _num/_str para dejar el
    JSON limpio (sin NaN)."""
    out = _filtra(df, year, month)
    if out is None or out.empty:
        return []
    return [
        {
            "unidad": int(r["unidad"]),
            "year": int(r["year"]),
            "month": int(r["month"]),
            "facturacion": _num(r.get("facturacion")),
            "saldo_contabilidad": _num(r.get("saldo_contabilidad")),
            "diferencia": _num(r.get("diferencia")),
            "propietario": _str(r.get("propietario")),
        }
        for _, r in out.iterrows()
    ]


def _find_flujo_file(year: int) -> Path | None:
    """Replica EXACTO la selección de archivo de backend/api.py::financiero_flujo_detallado:
    busca *INFORMES FINANCIEROS*.xls* / *ESTADOS FINANCIEROS*.xls* cuyo nombre
    tenga el patrón MM-YYYY con YYYY == year, y se queda con el de MAYOR mes
    (desempatando por mtime más reciente)."""
    import re as _re
    from config.settings import DATA_ROOT

    pats = ["*INFORMES FINANCIEROS*.xls*", "*ESTADOS FINANCIEROS*.xls*"]
    archivos: list[tuple[int, float, Path]] = []
    for pat in pats:
        for p in DATA_ROOT.rglob(pat):
            if p.name.startswith("~$"):
                continue
            m = _re.search(r"(\d{2})-(\d{4})", p.name)
            if not m:
                continue
            month_archivo = int(m.group(1))
            year_data = int(m.group(2))
            if year_data != year:
                continue
            archivos.append((month_archivo, p.stat().st_mtime, p))
    if not archivos:
        return None
    archivos.sort(reverse=True)
    _, _, path = archivos[0]
    return path


def _discover_flujo_years() -> list[int]:
    """Años distintos detectables en los nombres de archivo de informes
    financieros (patrón MM-YYYY), para saber qué años exportar."""
    import re as _re
    from config.settings import DATA_ROOT

    pats = ["*INFORMES FINANCIEROS*.xls*", "*ESTADOS FINANCIEROS*.xls*"]
    years: set[int] = set()
    for pat in pats:
        for p in DATA_ROOT.rglob(pat):
            if p.name.startswith("~$"):
                continue
            m = _re.search(r"(\d{2})-(\d{4})", p.name)
            if m:
                years.add(int(m.group(2)))
    return sorted(years)


def build_flujo_detallado(year: int) -> dict:
    """Subcategorías línea a línea del estado de resultados del año dado.
    Reusa ingestor.parsers.resultados.parse_subcategorias con la MISMA lógica
    de selección de archivo que api.py::financiero_flujo_detallado, para que
    el JSON exportado sea idéntico al que devolvería el endpoint Python."""
    path = _find_flujo_file(year)
    if path is None:
        return {"year": year, "ingresos": [], "gastos": []}
    data = resultados_parser.parse_subcategorias(path, year=year)

    def clean_rows(rows):
        out = []
        for r in rows:
            row = {
                "label": _str(r.get("label")),
                "presupuesto_anual": _num(r.get("presupuesto_anual")) or 0.0,
                "presupuesto_mes": _num(r.get("presupuesto_mes")) or 0.0,
                "meses": {str(k): (_num(v) or 0.0) for k, v in (r.get("meses") or {}).items()},
            }
            if "categoria" in r:
                row["categoria"] = _str(r.get("categoria"))
            out.append(row)
        return out

    return {
        "year": year,
        "ingresos": clean_rows(data.get("ingresos", [])),
        "gastos": clean_rows(data.get("gastos", [])),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=None)
    ap.add_argument("--month", type=int, default=None)
    ap.add_argument("--out", type=str, required=True)
    args = ap.parse_args()

    data = load_all(force_reload=False)
    fin = load_financiero()

    cartera = _filtra(data["cartera_mensual"], args.year, args.month)
    recaudo = _filtra(data["recaudo"], args.year, args.month)
    balance = _filtra(fin["balance"], args.year, args.month)
    ingresos = _filtra(fin["ingresos"], args.year, args.month)
    egresos = _filtra(fin["egresos"], args.year, args.month)
    presup = fin["presupuesto"]
    if args.year is not None and not presup.empty and "year" in presup.columns:
        presup = presup[presup["year"] == args.year]

    out = {
        "meta": {"year": args.year, "month": args.month},
        "viviendas": build_viviendas(data["unidades"]),
        "personas": build_personas(data["unidades"]),
        "cartera_anual": build_cartera_anual(data["cartera_anual"], args.year, args.month),
        "cartera": [
            {
                "unidad": int(r["unidad"]),
                "year": int(r["year"]),
                "month": int(r["month"]),
                "valor_facturado": _num(r.get("valor_facturado")),
                "valor_pagado": _num(r.get("valor_pagado")),
                "cuenta_pendiente": _num(r.get("cuenta_pendiente")),
            }
            for _, r in cartera.iterrows()
        ] if not cartera.empty else [],
        "recaudo": [
            {
                "unidad": int(r["unidad"]),
                "year": int(r["year"]),
                "month": int(r["month"]),
                "forma_pago": _str(r.get("forma_pago")),
                "metodo_pago": _str(r.get("metodo_pago")),
                "valor_pagado": _num(r.get("valor_pagado")),
                "fecha_pago": _date(r.get("fecha_pago")),
            }
            for _, r in recaudo.iterrows()
        ] if not recaudo.empty else [],
        "balance": [
            {
                "year": int(r["year"]),
                "month": int(r["month"]),
                "efectivo_caja": _num(r.get("efectivo_caja")),
                "banco_operacion": _num(r.get("banco_operacion")),
                "fiducia": _num(r.get("fiducia")),
                "inversion_cdt": _num(r.get("inversion_cdt")),
                "total_activo": _num(r.get("total_activo")),
                "total_pasivo": _num(r.get("total_pasivo")),
                "total_patrimonio": _num(r.get("total_patrimonio")),
                "fondo_imprevistos": _num(r.get("fondo_imprevistos")),
                "gastos_prepagados": _num(r.get("gastos_prepagados")),
                "total_cuentas_por_pagar": _num(r.get("total_cuentas_por_pagar")),
                "activo_corriente": _num(r.get("activo_corriente")),
                "pasivo_corriente": _num(r.get("pasivo_corriente")),
            }
            for _, r in balance.iterrows()
        ] if not balance.empty else [],
        "resultado": (
            [
                {"year": int(r["year"]), "month": int(r["month"]),
                 "tipo": "ingreso", "categoria": str(r["concepto"]),
                 "valor": _num(r.get("valor"))}
                for _, r in ingresos.iterrows()
            ] if not ingresos.empty else []
        ) + (
            [
                {"year": int(r["year"]), "month": int(r["month"]),
                 "tipo": "egreso", "categoria": str(r["categoria"]),
                 "valor": _num(r.get("valor"))}
                for _, r in egresos.iterrows()
            ] if not egresos.empty else []
        ),
        "presupuesto": [
            {"year": int(r["year"]) if "year" in r else args.year,
             "categoria": str(r["categoria"]),
             "presupuesto_anual": _num(r.get("presupuesto_anual"))}
            for _, r in presup.iterrows()
        ] if not presup.empty else [],
    }

    # Subcategorías del flujo de caja (F3b): un bloque {year, ingresos, gastos}
    # por cada año detectado en los nombres de archivo de informes financieros
    # (o solo el --year pedido, si se filtró).
    flujo_years = [args.year] if args.year is not None else _discover_flujo_years()
    out["flujo_detallado"] = [build_flujo_detallado(y) for y in flujo_years]

    Path(args.out).write_text(
        json.dumps(out, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8"
    )
    m = out["meta"]
    print(f"Exportado -> {args.out}")
    print(f"  periodo:     {m['year']}-{m['month']}")
    print(f"  viviendas:   {len(out['viviendas'])}")
    print(f"  personas:    {len(out['personas'])}")
    print(f"  cartera:     {len(out['cartera'])}")
    print(f"  cartera_anual: {len(out['cartera_anual'])}")
    print(f"  recaudo:     {len(out['recaudo'])}")
    print(f"  balance:     {len(out['balance'])}")
    print(f"  resultado:   {len(out['resultado'])}")
    print(f"  presupuesto: {len(out['presupuesto'])}")
    for fd in out["flujo_detallado"]:
        print(f"  flujo_detallado {fd['year']}: {len(fd['ingresos'])} ingresos, {len(fd['gastos'])} gastos")


if __name__ == "__main__":
    main()
