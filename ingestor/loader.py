"""Carga centralizada para la app: usa cache en parquet para arrancar rápido."""
from __future__ import annotations

import hashlib
from pathlib import Path

import pandas as pd

from config.settings import CACHE_DIR
from ingestor.discover import ExcelFile, latest_per_month, scan
from ingestor.parsers import cartera_anual, cartera_mensual, recaudo, unidades


def _cache_key(files: list[ExcelFile], prefix: str) -> Path:
    """Hash determinístico de (ruta, mtime) para invalidar cache."""
    sig = "|".join(f"{f.path}:{f.mtime:.0f}" for f in sorted(files, key=lambda x: str(x.path)))
    h = hashlib.md5(sig.encode("utf-8")).hexdigest()[:12]
    return CACHE_DIR / f"{prefix}_{h}.parquet"


def load_unidades(scan_result: dict[str, list[ExcelFile]]) -> pd.DataFrame:
    files = scan_result.get("maestro_unidades", [])
    if not files:
        return pd.DataFrame(columns=["unidad", "rol", "nombre_completo", "correo", "celular"])
    file = files[0]  # más reciente
    cache = _cache_key([file], "unidades")
    if cache.exists():
        return pd.read_parquet(cache)
    df = unidades.parse(file.path)
    df.to_parquet(cache, index=False)
    return df


def load_cartera_mensual(scan_result: dict[str, list[ExcelFile]]) -> pd.DataFrame:
    files = latest_per_month(scan_result.get("cartera_mensual", []))
    if not files:
        return pd.DataFrame()
    cache = _cache_key(files, "cartera_mensual")
    if cache.exists():
        return pd.read_parquet(cache)
    frames = [cartera_mensual.parse(f) for f in files]
    df = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    if not df.empty:
        df.to_parquet(cache, index=False)
    return df


def load_recaudo(scan_result: dict[str, list[ExcelFile]]) -> pd.DataFrame:
    files = latest_per_month(scan_result.get("recaudo", []))
    if not files:
        return pd.DataFrame()
    cache = _cache_key(files, "recaudo")
    if cache.exists():
        return pd.read_parquet(cache)
    frames = [recaudo.parse(f) for f in files]
    df = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    if not df.empty:
        df.to_parquet(cache, index=False)
    return df


def load_cartera_anual(scan_result: dict[str, list[ExcelFile]]) -> pd.DataFrame:
    files = scan_result.get("cartera_anual", [])
    if not files:
        return pd.DataFrame()
    file = files[0]  # más reciente
    cache = _cache_key([file], "cartera_anual")
    if cache.exists():
        return pd.read_parquet(cache)
    df = cartera_anual.parse(file.path)
    if not df.empty:
        df.to_parquet(cache, index=False)
    return df


def load_all(force_reload: bool = False) -> dict[str, pd.DataFrame]:
    """Punto de entrada principal para la UI."""
    if force_reload:
        for p in CACHE_DIR.glob("*.parquet"):
            p.unlink()
    sr = scan()
    return {
        "unidades": load_unidades(sr),
        "cartera_mensual": load_cartera_mensual(sr),
        "recaudo": load_recaudo(sr),
        "cartera_anual": load_cartera_anual(sr),
        "scan_result": sr,
    }
