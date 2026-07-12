"""Configuración global del dashboard.

En tu PC no hay que configurar nada: usa D:\2026 Monteverdi por defecto.
En Railway (nube) se definen las variables de entorno:
  DATA_ROOT=/app/data        (los Excel viajan dentro del repo, carpeta ./data)
  CACHE_DIR=/tmp/.cache      (caché efímero del contenedor)
"""
import os
from pathlib import Path

# Ruta raíz donde están todos los Excels de Monteverdi
DATA_ROOT = Path(os.environ.get("DATA_ROOT", r"D:\2026 Monteverdi"))

# Caché de parquets generados por el ingestor (acelera arranques)
CACHE_DIR = Path(os.environ.get("CACHE_DIR", r"D:\DASHBOARD 2026\data\.cache"))
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Nombre del conjunto (para títulos en UI)
CONJUNTO = "Urbanización Monteverdi P.H."

# Rango canónico de unidades
UNIDAD_MIN = 101
UNIDAD_MAX = 129
