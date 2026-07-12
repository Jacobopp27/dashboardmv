"""Sincroniza los Excel relevantes desde D:\\2026 Monteverdi hacia ./data.

Copia SOLO los archivos que el dashboard realmente lee (informes financieros,
cartera, recaudo, maestro de unidades), preservando la estructura de carpetas.
Así el repositorio se mantiene liviano (sin PDFs, actas ni documentos) y
Railway recibe exactamente lo que necesita.

Uso:  python sync_data.py
"""
from __future__ import annotations

import re
import shutil
from pathlib import Path

ORIGEN = Path(r"D:\2026 Monteverdi")
DESTINO = Path(__file__).parent / "data"

# Patrones de archivos que el dashboard lee (ver ingestor/discover.py y financiero.py)
PATRONES = [
    re.compile(r"modelo de graficos estados financiero.*\.xlsx$", re.IGNORECASE),
    re.compile(r"INFORMES FINANCIEROS.*\.xlsx?$", re.IGNORECASE),
    re.compile(r"ESTADOS FINANCIEROS.*\.xlsx?$", re.IGNORECASE),
    re.compile(r"^391 MONTEVERDI.*\.xlsx?$", re.IGNORECASE),
    re.compile(r"^Pagos del mes.*\.xlsx?$", re.IGNORECASE),
    re.compile(r"^Cartera 20\d{2}\.xlsx?$", re.IGNORECASE),
    re.compile(r"Plantilla parametrizaci.n KaiLiving.*\.xlsx?$", re.IGNORECASE),
]


def es_relevante(nombre: str) -> bool:
    if nombre.startswith("~$"):  # temporales de Excel abiertos
        return False
    return any(p.search(nombre) for p in PATRONES)


def main() -> None:
    copiados = 0
    omitidos = 0
    for archivo in ORIGEN.rglob("*.xls*"):
        if not es_relevante(archivo.name):
            omitidos += 1
            continue
        rel = archivo.relative_to(ORIGEN)
        destino = DESTINO / rel
        destino.parent.mkdir(parents=True, exist_ok=True)
        # Copiar solo si es nuevo o cambió (compara fecha de modificación y tamaño)
        if destino.exists():
            src, dst = archivo.stat(), destino.stat()
            if src.st_mtime <= dst.st_mtime and src.st_size == dst.st_size:
                continue
        shutil.copy2(archivo, destino)
        copiados += 1
        print(f"  + {rel}")

    print(f"\nSincronizado: {copiados} archivo(s) copiados/actualizados a {DESTINO}")
    print(f"(Se ignoraron {omitidos} Excel no relevantes: actas, notificaciones, etc.)")


if __name__ == "__main__":
    main()
