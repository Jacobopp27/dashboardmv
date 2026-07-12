"""Backend FastAPI del dashboard Monteverdi.

Sirve los datos parseados de los Excels como JSON.

Ejecutar:
    cd "D:\\DASHBOARD 2026"
    python -m uvicorn backend.api:app --reload --port 8000

Endpoints:
    GET  /api/health                       → ping
    POST /api/refresh                      → fuerza re-lectura de Excels
    GET  /api/meta                         → años disponibles + scan summary
    GET  /api/unidades                     → maestro de unidades + propietarios
    GET  /api/cartera-mensual              → todos los meses + año (?year=2026)
    GET  /api/cartera-anual                → cartera anual (?year=2025)
    GET  /api/recaudo                      → transacciones de recaudo (?year=2026)
    GET  /api/kpis/{year}/{month}          → KPIs consolidados para tarjetas
"""
from __future__ import annotations

import sys
from pathlib import Path

# Asegurar que los paquetes locales sean importables
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import json
import math

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from ingestor.financiero import load_financiero
from ingestor.loader import load_all


app = FastAPI(title="Dashboard Monteverdi API", version="0.1.0")

# CORS para que React (localhost:5173) y producción puedan llamar al backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Cache simple en memoria. Se invalida con POST /api/refresh.
_CACHE: dict = {}


def _data() -> dict:
    if "data" not in _CACHE:
        _CACHE["data"] = load_all(force_reload=False)
    return _CACHE["data"]


def _fin() -> dict:
    if "fin" not in _CACHE:
        _CACHE["fin"] = load_financiero()
    return _CACHE["fin"]


def _clean_value(v):
    """Convierte valores no JSON-safe a algo serializable."""
    if v is None:
        return None
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    if isinstance(v, (pd.Timestamp,)):
        return v.strftime("%Y-%m-%d") if not pd.isna(v) else None
    # numpy scalars: convertir a tipo Python nativo
    if hasattr(v, "item"):
        try:
            v = v.item()
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                return None
            return v
        except (ValueError, AttributeError):
            pass
    if isinstance(v, str):
        # Strings "nan"/"None" residuales
        if v.lower() in {"nan", "none", "null", "<na>"}:
            return None
        return v
    return v


def _df_records(df: pd.DataFrame) -> list[dict]:
    """Convierte DataFrame a lista de dicts JSON-safe (fechas a ISO, NaN→None)."""
    if df is None or df.empty:
        return []
    out = df.copy()
    # Convertir Timestamps a ISO string (NaT → None)
    for col in out.columns:
        if pd.api.types.is_datetime64_any_dtype(out[col]):
            out[col] = out[col].dt.strftime("%Y-%m-%d").where(out[col].notna(), None)
    # NaN → None en cada celda
    records = out.to_dict(orient="records")
    return [{k: _clean_value(v) for k, v in r.items()} for r in records]


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/refresh")
def refresh():
    """Borra cache y vuelve a leer todos los Excels."""
    _CACHE.pop("data", None)
    _CACHE.pop("fin", None)
    _CACHE["data"] = load_all(force_reload=True)
    _CACHE["fin"] = load_financiero()
    sr = _CACHE["data"]["scan_result"]
    return {
        "status": "refreshed",
        "files_by_category": {cat: len(files) for cat, files in sr.items()},
    }


@app.get("/api/meta")
def meta():
    """Información general: archivos detectados, años disponibles."""
    d = _data()
    years: set[int] = set()
    for k in ("cartera_mensual", "cartera_anual", "recaudo"):
        df = d.get(k)
        if df is not None and not df.empty and "year" in df.columns:
            years.update(int(y) for y in df["year"].dropna().unique())

    # Latest periodo by category
    latest = {}
    if not d["cartera_mensual"].empty:
        p = d["cartera_mensual"]["periodo"].max()
        latest["cartera_mensual"] = pd.Timestamp(p).strftime("%Y-%m")
    if not d["recaudo"].empty:
        # Build periodo from year+month
        ym = d["recaudo"][["year", "month"]].drop_duplicates().sort_values(["year", "month"]).iloc[-1]
        latest["recaudo"] = f"{int(ym['year'])}-{int(ym['month']):02d}"

    return {
        "years_available": sorted(years),
        "files_by_category": {cat: len(files) for cat, files in d["scan_result"].items()},
        "latest_periodo": latest,
        "n_unidades": int(d["unidades"]["unidad"].nunique()) if not d["unidades"].empty else 0,
    }


@app.get("/api/unidades")
def unidades():
    return _df_records(_data()["unidades"])


@app.get("/api/cartera-mensual")
def cartera_mensual(year: int | None = Query(None)):
    df = _data()["cartera_mensual"]
    if year is not None and not df.empty:
        df = df[df["year"] == year]
    return _df_records(df)


@app.get("/api/cartera-anual")
def cartera_anual(year: int | None = Query(None)):
    df = _data()["cartera_anual"]
    if year is not None and not df.empty:
        df = df[df["year"] == year]
    return _df_records(df)


@app.get("/api/recaudo")
def recaudo(year: int | None = Query(None)):
    df = _data()["recaudo"]
    if year is not None and not df.empty:
        df = df[df["year"] == year]
    return _df_records(df)


@app.get("/api/kpis/{year}/{month}")
def kpis(year: int, month: int):
    """KPIs consolidados para un periodo específico."""
    d = _data()
    cm = d["cartera_mensual"]
    if cm.empty:
        raise HTTPException(404, "Sin datos de cartera mensual")
    df = cm[(cm["year"] == year) & (cm["month"] == month)]
    if df.empty:
        raise HTTPException(404, f"Sin datos para {year}-{month:02d}")

    total_facturado = float(df["valor_facturado"].sum())
    total_recaudado = float(df["valor_pagado"].sum())
    cartera_pendiente = float(df["cuenta_pendiente"].clip(lower=0).sum())
    n_morosos = int((df["cuenta_pendiente"] > 0).sum())
    n_unidades = int(len(df))
    pct_recaudo = total_recaudado / total_facturado if total_facturado > 0 else 0

    # Transacciones de recaudo del mismo mes
    rec = d["recaudo"]
    n_transacciones = 0
    por_forma_pago = []
    if not rec.empty:
        rec_m = rec[(rec["year"] == year) & (rec["month"] == month)]
        n_transacciones = len(rec_m)
        if n_transacciones > 0:
            agg = (
                rec_m.groupby("forma_pago")["valor_pagado"]
                .sum()
                .reset_index()
                .sort_values("valor_pagado", ascending=False)
            )
            por_forma_pago = [
                {"forma": r["forma_pago"] or "—", "valor": float(r["valor_pagado"])}
                for _, r in agg.iterrows()
            ]

    return {
        "periodo": f"{year}-{month:02d}",
        "total_facturado": total_facturado,
        "total_recaudado": total_recaudado,
        "cartera_pendiente": cartera_pendiente,
        "pct_recaudo": pct_recaudo,
        "n_morosos": n_morosos,
        "n_unidades": n_unidades,
        "n_transacciones_recaudo": n_transacciones,
        "por_forma_pago": por_forma_pago,
    }


def _serie_unificada(d: dict, year: int | None = None) -> pd.DataFrame:
    """Combina cartera_mensual (preferida) + cartera_anual (fallback) en una serie
    unificada con columnas: unidad, periodo, year, month, valor_facturado, valor_pagado, cuenta_pendiente.

    Cuando un (year, month) está disponible en cartera_mensual, esa fuente gana porque
    incluye recaudo del mes; cartera_anual solo aporta saldo histórico.
    """
    cm = d["cartera_mensual"].copy()
    ca = d["cartera_anual"].copy()
    if year is not None:
        if not cm.empty:
            cm = cm[cm["year"] == year]
        if not ca.empty:
            ca = ca[ca["year"] == year]

    frames = []
    if not cm.empty:
        cmx = cm[["unidad", "periodo", "year", "month", "valor_facturado", "valor_pagado", "cuenta_pendiente"]].copy()
        cmx["fuente"] = "mensual"
        frames.append(cmx)

    if not ca.empty:
        # Construir periodo desde year+month si no existe
        cax = ca.copy()
        cax = cax.rename(columns={"facturacion": "valor_facturado", "saldo_contabilidad": "cuenta_pendiente"})
        cax["valor_pagado"] = (cax["valor_facturado"] - cax["cuenta_pendiente"]).clip(lower=0)
        cax["fuente"] = "anual"
        cax = cax[["unidad", "periodo", "year", "month", "valor_facturado", "valor_pagado", "cuenta_pendiente", "fuente"]]
        # Quitar (year, month, unidad) que ya están en cm para no duplicar
        if frames:
            existentes = set(zip(cmx["year"], cmx["month"], cmx["unidad"]))
            cax = cax[~cax.apply(lambda r: (r["year"], r["month"], r["unidad"]) in existentes, axis=1)]
        frames.append(cax)

    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True).sort_values(["periodo", "unidad"])


@app.get("/api/cartera-resumen-mensual")
def cartera_resumen_mensual(year: int = Query(...)):
    """Por cada mes del año, devuelve facturado, recaudado, cartera_total al cierre,
    n_morosos, % cartera morosa.
    """
    d = _data()
    serie = _serie_unificada(d, year=year)
    if serie.empty:
        return []

    out = []
    for periodo, grupo in serie.groupby("periodo"):
        facturado = float(grupo["valor_facturado"].sum())
        recaudado = float(grupo["valor_pagado"].sum())
        cartera_total = float(grupo["cuenta_pendiente"].clip(lower=0).sum())
        morosos = grupo[grupo["cuenta_pendiente"] > 0]
        n_morosos = int(len(morosos))
        n_unidades = int(len(grupo))
        # % cartera morosa = cartera_total / facturado (qué proporción del facturado quedó pendiente)
        pct_morosa = cartera_total / facturado if facturado > 0 else 0
        pct_recaudo = recaudado / facturado if facturado > 0 else 0
        ts = pd.Timestamp(periodo)
        out.append({
            "periodo": ts.strftime("%Y-%m"),
            "year": int(ts.year),
            "month": int(ts.month),
            "facturado": facturado,
            "recaudado": recaudado,
            "cartera_total": cartera_total,
            "n_morosos": n_morosos,
            "n_unidades": n_unidades,
            "pct_recaudo": pct_recaudo,
            "pct_morosa": pct_morosa,
        })
    out.sort(key=lambda r: r["periodo"])
    return out


@app.get("/api/cartera-aging")
def cartera_aging(year: int = Query(...), month: int = Query(...)):
    """Para el período de corte dado, calcula el aging real por unidad:
    cuántos meses consecutivos viene debiendo, contando desde el período de corte
    hacia atrás. Devuelve por unidad y por bucket de aging.

    Buckets:
      - 1 mes        → 1-30 días
      - 2 a 3 meses  → 31-90 días
      - 4 a 6 meses  → 91-180 días
      - 7 a 12 meses → 181-365 días
      - +12 meses    → +365 días
    """
    d = _data()
    serie = _serie_unificada(d)  # toda la serie disponible
    if serie.empty:
        return {"corte": f"{year}-{month:02d}", "unidades": [], "buckets": []}

    corte = pd.Timestamp(year=year, month=month, day=1)
    serie = serie[serie["periodo"] <= corte].copy()
    if serie.empty:
        return {"corte": f"{year}-{month:02d}", "unidades": [], "buckets": []}

    # Mapa unidad → propietario
    unidades_df = d["unidades"]
    propietario = {}
    if not unidades_df.empty:
        for u, name in unidades_df[unidades_df["rol"] == "propietario"].groupby("unidad")["nombre_completo"].first().items():
            propietario[int(u)] = name

    rows = []
    for unidad, grupo in serie.groupby("unidad"):
        g = grupo.sort_values("periodo", ascending=False)
        saldo_actual = float(g.iloc[0]["cuenta_pendiente"])
        if saldo_actual <= 0:
            continue
        # Contar meses consecutivos hacia atrás con saldo > 0
        meses_mora = 0
        for _, r in g.iterrows():
            if r["cuenta_pendiente"] > 0:
                meses_mora += 1
            else:
                break
        rows.append({
            "unidad": int(unidad),
            "propietario": propietario.get(int(unidad), "—"),
            "saldo": saldo_actual,
            "meses_mora": int(meses_mora),
        })

    # Buckets
    def bucket_of(m: int) -> str:
        if m <= 1:  return "1-30 días"
        if m <= 3:  return "31-90 días"
        if m <= 6:  return "91-180 días"
        if m <= 12: return "181-365 días"
        return "+365 días"

    bucket_orden = ["1-30 días", "31-90 días", "91-180 días", "181-365 días", "+365 días"]
    buckets_dict = {b: {"bucket": b, "unidades": 0, "valor": 0.0} for b in bucket_orden}
    for r in rows:
        b = bucket_of(r["meses_mora"])
        r["bucket"] = b
        buckets_dict[b]["unidades"] += 1
        buckets_dict[b]["valor"] += r["saldo"]

    return {
        "corte": f"{year}-{month:02d}",
        "unidades": sorted(rows, key=lambda r: r["saldo"], reverse=True),
        "buckets": [buckets_dict[b] for b in bucket_orden],
    }


@app.get("/api/cartera-aging-anual")
def cartera_aging_anual(year: int = Query(...)):
    """Aging por TODOS los meses del año dado en una sola respuesta.

    Devuelve mapa { 'YYYY-MM': { buckets: [...], total: float, vencido_60: float } }
    para todos los meses con datos. Útil para indicadores KPI mensuales
    (índice de morosidad, evolución).

    "vencido_60" = cartera vencida más de 60 días (suma de buckets 91+).
    """
    d = _data()
    serie = _serie_unificada(d)
    if serie.empty:
        return {"year": year, "por_mes": {}}

    # Identificar meses con datos
    periodos = sorted(
        p for p in serie["periodo"].dropna().unique()
        if pd.Timestamp(p).year == year
    )
    salida: dict[str, dict] = {}
    unidades_df = d["unidades"]
    propietario: dict[int, str] = {}
    if not unidades_df.empty:
        for u, name in unidades_df[unidades_df["rol"] == "propietario"].groupby("unidad")["nombre_completo"].first().items():
            propietario[int(u)] = name

    bucket_orden = ["1-30 días", "31-90 días", "91-180 días", "181-365 días", "+365 días"]

    def bucket_of(m: int) -> str:
        if m <= 1:  return "1-30 días"
        if m <= 3:  return "31-90 días"
        if m <= 6:  return "91-180 días"
        if m <= 12: return "181-365 días"
        return "+365 días"

    for corte in periodos:
        cut = pd.Timestamp(corte)
        sub = serie[serie["periodo"] <= cut].copy()
        if sub.empty:
            continue
        buckets_dict = {b: {"bucket": b, "unidades": 0, "valor": 0.0} for b in bucket_orden}
        total = 0.0
        for unidad, grupo in sub.groupby("unidad"):
            g = grupo.sort_values("periodo", ascending=False)
            saldo_actual = float(g.iloc[0]["cuenta_pendiente"])
            if saldo_actual <= 0:
                continue
            meses_mora = 0
            for _, r in g.iterrows():
                if r["cuenta_pendiente"] > 0:
                    meses_mora += 1
                else:
                    break
            b = bucket_of(meses_mora)
            buckets_dict[b]["unidades"] += 1
            buckets_dict[b]["valor"] += saldo_actual
            total += saldo_actual

        vencido_60 = sum(buckets_dict[b]["valor"] for b in ("91-180 días", "181-365 días", "+365 días"))
        clave = cut.strftime("%Y-%m")
        salida[clave] = {
            "periodo": clave,
            "total": total,
            "vencido_60": vencido_60,
            "buckets": [buckets_dict[b] for b in bucket_orden],
        }

    return {"year": year, "por_mes": salida}


@app.get("/api/serie-mensual")
def serie_mensual(year: int | None = Query(None)):
    """Serie temporal de facturado/recaudado/pendiente para gráfico de tendencia.

    Combina cartera_mensual (preferido) + cartera_anual (fallback para histórico).
    """
    d = _data()
    cm = d["cartera_mensual"]
    ca = d["cartera_anual"]

    if year is not None and not cm.empty:
        cm = cm[cm["year"] == year]
    if year is not None and not ca.empty:
        ca = ca[ca["year"] == year]

    serie_m = pd.DataFrame()
    if not cm.empty:
        serie_m = (
            cm.groupby("periodo")
            .agg(
                facturado=("valor_facturado", "sum"),
                recaudado=("valor_pagado", "sum"),
                pendiente=("cuenta_pendiente", lambda s: float(s.clip(lower=0).sum())),
            )
            .reset_index()
            .sort_values("periodo")
        )

    if not ca.empty:
        meses_m = set(serie_m["periodo"].dt.strftime("%Y-%m")) if not serie_m.empty else set()
        ca_x = ca.copy()
        ca_x["periodo_key"] = ca_x["periodo"].dt.strftime("%Y-%m")
        ca_x = ca_x[~ca_x["periodo_key"].isin(meses_m)]
        serie_a = (
            ca_x.groupby("periodo")
            .agg(
                facturado=("facturacion", "sum"),
                pendiente=("saldo_contabilidad", lambda s: float(s.clip(lower=0).sum())),
            )
            .reset_index()
        )
        serie_a["recaudado"] = 0
        if not serie_m.empty or not serie_a.empty:
            serie = pd.concat([serie_m, serie_a], ignore_index=True).sort_values("periodo")
        else:
            serie = serie_m
    else:
        serie = serie_m

    if serie.empty:
        return []

    # Si no hay year filter, limita a últimos 14 meses
    if year is None:
        serie = serie.tail(14)

    serie["periodo"] = pd.to_datetime(serie["periodo"]).dt.strftime("%Y-%m")
    return serie.to_dict(orient="records")


# ----------------------------------------------------------------------------
# BLOQUE 2 — FINANCIERO
# ----------------------------------------------------------------------------

@app.get("/api/financiero/saldos")
def financiero_saldos(year: int | None = Query(None)):
    """Serie temporal de saldos: caja menor, banco operación, fiducia, total."""
    bal = _fin()["balance"]
    if bal.empty:
        return []
    df = bal.copy()
    if year is not None:
        df = df[df["periodo"].dt.year == year]
    cols = ["periodo", "year", "month", "efectivo_caja", "banco_operacion", "fiducia", "inversion_cdt"]
    df = df[cols].copy()
    df["disponible_total"] = df["efectivo_caja"] + df["banco_operacion"] + df["fiducia"] + df["inversion_cdt"]
    df["periodo"] = df["periodo"].dt.strftime("%Y-%m")
    return _df_records(df)


@app.get("/api/financiero/liquidez")
def financiero_liquidez(year: int | None = Query(None)):
    """Análisis de liquidez por mes: activo corriente, pasivo corriente, razón corriente, prueba ácida,
    liquidez disponible.
    """
    bal = _fin()["balance"]
    if bal.empty:
        return []
    df = bal.copy()
    if year is not None:
        df = df[df["periodo"].dt.year == year]
    cols = [
        "periodo", "year", "month",
        "activo_corriente", "pasivo_corriente",
        "razon_corriente", "prueba_acida", "liquidez_disponible",
        "copropietarios", "gastos_prepagados",
        # Detalle de activos
        "efectivo_caja", "banco_operacion", "fiducia", "inversion_cdt",
        "consignaciones_pendientes", "deudores_varios", "anticipo_proveedores",
        "total_activo",
        # Detalle de pasivos
        "cuentas_por_pagar", "retencion_impuestos", "reteica",
        "consignaciones_por_pagar",
        "total_cuentas_por_pagar", "total_pasivos_diferidos",
        "total_otros_pasivos", "total_pasivo",
        # Patrimonio
        "fondo_imprevistos", "total_patrimonio",
    ]
    keep = [c for c in cols if c in df.columns]
    df = df[keep].copy()
    df["periodo"] = df["periodo"].dt.strftime("%Y-%m")
    return _df_records(df)


@app.get("/api/financiero/resultados")
def financiero_resultados(year: int | None = Query(None)):
    """Estado integral de resultados por mes: ingresos operacionales, marginales,
    egresos por categoría, total y diferencia.
    """
    fin = _fin()
    ing = fin["ingresos"]
    egr = fin["egresos"]
    res = fin["resultado"]
    if ing.empty and egr.empty:
        return []
    if year is not None:
        if not ing.empty: ing = ing[ing["year"] == year]
        if not egr.empty: egr = egr[egr["year"] == year]
        if not res.empty: res = res[res["year"] == year]

    # Pivot ingresos: una columna por concepto (Operacional, Marginal)
    out_rows = {}
    if not ing.empty:
        for _, r in ing.iterrows():
            key = (int(r["year"]), int(r["month"]))
            row = out_rows.setdefault(key, {"year": key[0], "month": key[1]})
            row[f"ingreso_{str(r['concepto']).lower()}"] = float(r["valor"])

    # Pivot egresos: columna por categoría + total
    if not egr.empty:
        for _, r in egr.iterrows():
            key = (int(r["year"]), int(r["month"]))
            row = out_rows.setdefault(key, {"year": key[0], "month": key[1]})
            cat = str(r["categoria"]).lower().replace("total_egresos", "total_egresos")
            row[f"egreso_{cat}"] = float(r["valor"])

    # Resultado del mes
    if not res.empty:
        for _, r in res.iterrows():
            key = (int(r["year"]), int(r["month"]))
            row = out_rows.setdefault(key, {"year": key[0], "month": key[1]})
            row["resultado"] = float(r["resultado"])

    out = sorted(out_rows.values(), key=lambda r: (r["year"], r["month"]))
    for row in out:
        row["periodo"] = f"{row['year']}-{row['month']:02d}"
        # Recalcular diferencia = ingresos op + marginales - total egresos
        ing_op = row.get("ingreso_operacional", 0.0)
        ing_mg = row.get("ingreso_marginal", 0.0)
        egr_total = row.get("egreso_total_egresos", 0.0)
        row["diferencia"] = ing_op + ing_mg - egr_total
    return out


@app.get("/api/financiero/ejecucion-presupuesto")
def financiero_ejecucion(year: int = Query(...)):
    """Por categoría: presupuesto anual, presupuesto acumulado a la fecha,
    ejecutado real acumulado, % ejecución.
    """
    fin = _fin()
    p = fin["presupuesto"]
    egr = fin["egresos"]
    if p.empty:
        return []

    p = p[p["year"] == year].copy() if "year" in p.columns else p.copy()
    if p.empty:
        return []

    # Si EJECUTADO_ACUM viene del Excel, úsalo; si no, calcula desde egresos
    if not egr.empty:
        egr_year = egr[egr["year"] == year]
        ejec_calc = egr_year.groupby("categoria")["valor"].sum().to_dict()
    else:
        ejec_calc = {}

    out = []
    for _, r in p.iterrows():
        cat = r["categoria"]
        ppto_anual = float(r.get("presupuesto_anual", 0) or 0)
        ejec_excel = float(r.get("ejecutado_acum", 0) or 0)
        ejec_real  = float(ejec_calc.get(cat, ejec_excel))
        pct = ejec_real / ppto_anual if ppto_anual > 0 else None
        out.append({
            "categoria": cat,
            "presupuesto_anual": ppto_anual,
            "ejecutado_acumulado": ejec_real,
            "pct_ejecucion": pct,
            "diferencia": ppto_anual - ejec_real,
        })
    out.sort(key=lambda x: x["presupuesto_anual"], reverse=True)
    return out


@app.get("/api/financiero/indicadores")
def financiero_indicadores(year: int | None = Query(None)):
    """Devuelve los 4 indicadores clave para el donut de solvencia, basados en
    el último balance disponible (o el último del año filtrado).

    Calcula:
      - razon_corriente = activo_corriente / pasivo_corriente
      - razon_acida = (activo_corriente - gastos_prepagados) / pasivo_corriente
      - endeudamiento = pasivo_corriente / activo_corriente  (% del activo financiado)
      - cobertura_intereses = aproximada como (efectivo + fiducia) / pasivo_corriente
        (proxy razonable: la PH no reporta interés financiero pagado)
    """
    fin = _fin()
    bal = fin["balance"]
    if bal.empty:
        raise HTTPException(404, "Sin datos de balance")
    df = bal.copy()
    if year is not None:
        df = df[df["periodo"].dt.year == year]
    if df.empty:
        raise HTTPException(404, f"Sin balance para {year}")
    last = df.sort_values("periodo").iloc[-1]
    ac = float(last["activo_corriente"])
    pc = float(last["pasivo_corriente"])
    prep = float(last["gastos_prepagados"])
    efectivo_total = float(last["efectivo_caja"]) + float(last["banco_operacion"]) + float(last["fiducia"])

    razon_corriente = (ac / pc) if pc > 0 else None
    razon_acida     = ((ac - prep) / pc) if pc > 0 else None
    endeudamiento   = (pc / ac) if ac > 0 else None
    cobertura       = (efectivo_total / pc) if pc > 0 else None

    return {
        "periodo": pd.Timestamp(last["periodo"]).strftime("%Y-%m"),
        "razon_corriente":     razon_corriente,
        "razon_acida":         razon_acida,
        "endeudamiento":       endeudamiento,
        "cobertura_intereses": cobertura,
        "activo_corriente":    ac,
        "pasivo_corriente":    pc,
        "efectivo_total":      efectivo_total,
    }


@app.get("/api/financiero/flujo-detallado")
def financiero_flujo_detallado(year: int = Query(...)):
    """Devuelve TODAS las líneas individuales (sub-categorías) del estado de
    resultados del año dado, con su presupuesto mensual y los valores reales
    de cada uno de los 12 meses. Útil para la tabla dinámica de flujo de caja
    proyectado al estilo Excel.

    Estructura:
      {
        "year": 2026,
        "ingresos": [
          {"label": "Cuota de administración", "presupuesto_anual": ..., "presupuesto_mes": ..., "meses": {1: v, ..., 12: v}},
          ...
        ],
        "gastos": [
          {"categoria": "MANTENIMIENTO", "label": "Aseo y piscina (Operario)", "presupuesto_anual": ..., "presupuesto_mes": ..., "meses": {...}},
          ...
        ]
      }
    """
    from ingestor.parsers import resultados as resultados_parser
    from ingestor.financiero import _find_estado_resultados  # type: ignore[attr-defined]
    import re as _re

    # Buscar el archivo de informe financiero del año (el del mes más reciente)
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
        return {"year": year, "ingresos": [], "gastos": []}
    # El archivo con MAYOR mes del nombre gana (cubre más meses), desempata mtime
    archivos.sort(reverse=True)
    _, _, path = archivos[0]

    data = resultados_parser.parse_subcategorias(path, year=year)
    # Limpiar NaN/Inf para JSON
    def clean(rows):
        out = []
        for r in rows:
            r2 = dict(r)
            r2["meses"] = {int(k): _clean_value(v) or 0.0 for k, v in (r.get("meses") or {}).items()}
            r2["presupuesto_anual"] = _clean_value(r.get("presupuesto_anual")) or 0.0
            r2["presupuesto_mes"] = _clean_value(r.get("presupuesto_mes")) or 0.0
            out.append(r2)
        return out
    return {
        "year": year,
        "ingresos": clean(data.get("ingresos", [])),
        "gastos":   clean(data.get("gastos", [])),
    }


@app.get("/api/financiero/meta")
def financiero_meta():
    fin = _fin()
    bal = fin["balance"]
    res = fin["resultado"]
    years: set[int] = set()
    if not bal.empty:
        years.update(int(y) for y in bal["periodo"].dt.year.unique())
    if not res.empty:
        years.update(int(y) for y in res["year"].unique())
    return {
        "years_available": sorted(years),
        "n_balances": int(len(bal)) if not bal.empty else 0,
        "fuentes": fin["fuentes"],
    }
