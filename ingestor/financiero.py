"""Carga centralizada de datos financieros para la API."""
from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from config.settings import DATA_ROOT
from ingestor.parsers import balance as balance_parser
from ingestor.parsers import resultados as resultados_parser


def _find_modelo_graficos() -> Path | None:
    """Busca el modelo de gráficos más reciente."""
    candidates: list[tuple[float, Path]] = []
    for p in DATA_ROOT.rglob("*modelo de graficos estados financiero*.xlsx"):
        if p.name.startswith("~$"):
            continue
        candidates.append((p.stat().st_mtime, p))
    if not candidates:
        return None
    candidates.sort(reverse=True)
    return candidates[0][1]


def _find_estado_resultados() -> tuple[Path, int] | None:
    """Devuelve (path, year) del archivo de estado de resultados más reciente."""
    candidates: list[tuple[float, Path, int]] = []
    pats = ["*INFORMES FINANCIEROS*.xls*", "*ESTADOS FINANCIEROS*.xls*"]
    archivos: list[Path] = []
    for pat in pats:
        archivos.extend(DATA_ROOT.rglob(pat))
    for p in archivos:
        if p.name.startswith("~$"):
            continue
        # Detectar año del nombre: MM-YYYY o YYYY suelto
        m = re.search(r"(\d{2})-(\d{4})", p.name)
        if m:
            year_data = int(m.group(2))
        else:
            ym = re.search(r"(20\d{2})", p.name)
            year_data = int(ym.group(1)) if ym else 2026
        # ⚠️ El archivo "12-2025 ESTADOS FINANCIEROS" reporta datos del año 2025 completo
        candidates.append((p.stat().st_mtime, p, year_data))
    if not candidates:
        return None
    candidates.sort(reverse=True)
    mtime, path, year = candidates[0]
    return path, year


def load_financiero() -> dict:
    """Carga todos los datos financieros disponibles."""
    out: dict = {
        "balance": pd.DataFrame(),
        "egresos": pd.DataFrame(),
        "ingresos": pd.DataFrame(),
        "presupuesto": pd.DataFrame(),
        "resultado": pd.DataFrame(),
        "fuentes": {"balance": None, "resultados": None},
    }

    # Balance histórico (ESFA mensual) — de archivo "modelo de gráficos"
    mg = _find_modelo_graficos()
    balance_df = pd.DataFrame()
    if mg:
        try:
            balance_df = balance_parser.parse(mg)
            out["fuentes"]["balance"] = str(mg)
        except Exception as e:
            out["error_balance"] = str(e)

    # Balance adicional — de los archivos de informe financiero mensual
    # Cada uno tiene una hoja ESFA con el corte del mes específico (ej. abril 2026)
    raw_extras: list[tuple[float, Path, dict]] = []
    for pat in ("*INFORMES FINANCIEROS*.xls*", "*ESTADOS FINANCIEROS*.xls*"):
        for p in DATA_ROOT.rglob(pat):
            if p.name.startswith("~$"):
                continue
            try:
                row = balance_parser.parse_informe_mensual(p)
                if row:
                    raw_extras.append((p.stat().st_mtime, p, row))
            except Exception:
                continue
    # Ordenar por mtime descendente (más reciente primero) y deduplicar por (year, month)
    raw_extras.sort(key=lambda x: x[0], reverse=True)
    extras_balance: list[dict] = []
    extras_fuentes: list[str] = []
    seen_ym: set[tuple[int, int]] = set()
    for _, p, row in raw_extras:
        key = (int(row["year"]), int(row["month"]))
        if key in seen_ym:
            continue
        seen_ym.add(key)
        extras_balance.append(row)
        extras_fuentes.append(str(p))
    if extras_balance:
        df_extras = pd.DataFrame(extras_balance)
        if not balance_df.empty:
            # Combinar evitando duplicados por (year, month). Si hay duplicado, prefiero el del informe mensual
            # (más fresco que el modelo de gráficos).
            balance_df = balance_df[~balance_df.apply(
                lambda r: any(
                    (int(r["year"]) == int(e["year"]) and int(r["month"]) == int(e["month"]))
                    for e in extras_balance
                ),
                axis=1,
            )]
            balance_df = pd.concat([balance_df, df_extras], ignore_index=True)
        else:
            balance_df = df_extras

        # Asegurar que todas las columnas existan (fallback 0 para cuando alguna no aparezca)
        cols_activo = ["efectivo_caja", "banco_operacion", "fiducia", "inversion_cdt",
                       "copropietarios", "consignaciones_pendientes", "deudores_varios",
                       "anticipo_proveedores", "gastos_prepagados"]
        for c in cols_activo:
            if c not in balance_df.columns:
                balance_df[c] = 0.0
        for c in ["cuentas_por_pagar", "retencion_impuestos", "reteica",
                  "consignaciones_por_pagar", "provision_vigilancia",
                  "total_cuentas_por_pagar",
                  "total_pasivos_diferidos", "total_otros_pasivos",
                  "total_pasivo", "total_activo", "total_patrimonio", "fondo_imprevistos"]:
            if c not in balance_df.columns:
                balance_df[c] = 0.0

        # === REGLA: las cifras coinciden EXACTAMENTE con el archivo ===
        # total_activo, total_pasivo, total_patrimonio vienen literales del Excel.
        # activo_corriente = total_activo (en PH típicamente todo el activo es corriente).
        # pasivo_corriente = total_cuentas_por_pagar + otros_pasivos (todo lo del archivo
        #                    que NO sea pasivo diferido).
        balance_df["activo_corriente"] = balance_df["total_activo"].fillna(0).where(
            balance_df["total_activo"].fillna(0) > 0,
            sum(balance_df[c].fillna(0) for c in cols_activo),  # fallback si no viene
        )
        balance_df["pasivo_corriente"] = balance_df["total_cuentas_por_pagar"].fillna(0) + balance_df["total_otros_pasivos"].fillna(0)
        # Si total_cuentas_por_pagar no estaba (archivos antiguos), suma componentes:
        # Costos y gastos por pagar + Retención impuestos + ReteICA + Provisión vigilancia +
        # Consignaciones por identificar + Otros pasivos
        mask_no_total = balance_df["total_cuentas_por_pagar"].fillna(0) == 0
        balance_df.loc[mask_no_total, "pasivo_corriente"] = (
            balance_df.loc[mask_no_total, "cuentas_por_pagar"].fillna(0)
            + balance_df.loc[mask_no_total, "retencion_impuestos"].fillna(0)
            + balance_df.loc[mask_no_total, "reteica"].fillna(0)
            + balance_df.loc[mask_no_total, "provision_vigilancia"].fillna(0)
            + balance_df.loc[mask_no_total, "consignaciones_por_pagar"].fillna(0)
            + balance_df.loc[mask_no_total, "total_otros_pasivos"].fillna(0)
        )

        balance_df["razon_corriente"] = balance_df.apply(
            lambda r: (r["activo_corriente"] / r["pasivo_corriente"]) if r["pasivo_corriente"] > 0 else None,
            axis=1,
        )
        balance_df["liquidez_disponible"] = balance_df.apply(
            lambda r: ((r["efectivo_caja"] + r["banco_operacion"] + r["fiducia"]) / r["pasivo_corriente"])
                      if r["pasivo_corriente"] > 0 else None,
            axis=1,
        )
        balance_df["prueba_acida"] = balance_df.apply(
            lambda r: ((r["activo_corriente"] - r["gastos_prepagados"]) / r["pasivo_corriente"])
                      if r["pasivo_corriente"] > 0 else None,
            axis=1,
        )
        balance_df = balance_df.sort_values("periodo").reset_index(drop=True)
        out["fuentes"]["balance_extras"] = extras_fuentes

    out["balance"] = balance_df

    # Estado de resultados: cargar TODOS los archivos de informe disponibles
    # para tener datos de 2025 (archivo dic 2025) y 2026 (archivo más reciente)
    # Tupla: (month_del_archivo, mtime, path, year) — ordenamos para que el archivo
    # del MES MÁS RECIENTE cubierto gane, y si hay varios con el mismo mes, el
    # de mtime mayor. Esto es importante porque el archivo "05-2026" debe ganar
    # al "04-2026" aunque el de abril haya sido tocado después.
    archivos_resultado: list[tuple[int, float, Path, int]] = []
    pats = ["*INFORMES FINANCIEROS*.xls*", "*ESTADOS FINANCIEROS*.xls*"]
    archivos: list[Path] = []
    for pat in pats:
        archivos.extend(DATA_ROOT.rglob(pat))
    for p in archivos:
        if p.name.startswith("~$"):
            continue
        m = re.search(r"(\d{2})-(\d{4})", p.name)
        if m:
            month_archivo = int(m.group(1))
            year_data = int(m.group(2))
        else:
            month_archivo = 12  # sin patrón MM-YYYY: asumir cierre anual
            ym = re.search(r"(20\d{2})", p.name)
            year_data = int(ym.group(1)) if ym else 2026
        archivos_resultado.append((month_archivo, p.stat().st_mtime, p, year_data))

    archivos_resultado.sort(reverse=True)

    egresos_frames, ingresos_frames, resultado_frames, presup_frames = [], [], [], []
    sources = []
    seen_years: set[int] = set()
    for _month, _mtime, path, year in archivos_resultado:
        if year in seen_years:
            continue
        seen_years.add(year)
        try:
            r = resultados_parser.parse(path, year=year)
            if not r["egresos"].empty:
                egresos_frames.append(r["egresos"])
            if not r["ingresos"].empty:
                ingresos_frames.append(r["ingresos"])
            if not r["resultado"].empty:
                resultado_frames.append(r["resultado"])
            if not r["presupuesto"].empty:
                pres = r["presupuesto"].copy()
                pres["year"] = year
                presup_frames.append(pres)
            sources.append(str(path))
        except Exception:
            continue

    if egresos_frames:    out["egresos"]   = pd.concat(egresos_frames, ignore_index=True)
    if ingresos_frames:   out["ingresos"]  = pd.concat(ingresos_frames, ignore_index=True)
    if resultado_frames:  out["resultado"] = pd.concat(resultado_frames, ignore_index=True)
    if presup_frames:     out["presupuesto"] = pd.concat(presup_frames, ignore_index=True)
    out["fuentes"]["resultados"] = sources

    return out
