"""Utilidades de normalización de datos."""
from __future__ import annotations

import re

from config.settings import UNIDAD_MAX, UNIDAD_MIN


def normalize_unidad(raw) -> int | None:
    """Normaliza un identificador de unidad a entero 101..129.

    Acepta formatos vistos en archivos reales:
      - 'CA 0101' / 'ca 0102'  -> 101 / 102
      - '101-6' / '129-1'      -> 101 / 129
      - '108' / '0123'         -> 108 / 123
      - 88615 (probable error) -> None (fuera de rango)
    """
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or s.lower() == "nan":
        return None
    # Extraer todos los dígitos consecutivos del comienzo o tras "CA"
    # Toma el primer bloque numérico encontrado
    m = re.search(r"(\d{2,5})", s)
    if not m:
        return None
    num = int(m.group(1))
    # Si vino como '0101' con padding, recortar primeros ceros (ya hace int())
    # Si vino como '101-6', el regex agarra '101' (3 dígitos), perfecto
    # Si vino como 'CA 0101', regex agarra '0101' → 101
    # Si vino 88615 → fuera de rango, descartar
    if UNIDAD_MIN <= num <= UNIDAD_MAX:
        return num
    # Probar tomar los últimos 3 dígitos por si era padding largo
    last3 = num % 1000
    if UNIDAD_MIN <= last3 <= UNIDAD_MAX:
        return last3
    return None
