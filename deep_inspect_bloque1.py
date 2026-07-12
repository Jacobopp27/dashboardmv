"""
Exploración profunda de las 4 fuentes del Bloque 1: cartera, recaudo, cartera anual, maestro de unidades.
Muestra todas las filas + tipos de datos para escribir parsers correctos.
"""
from pathlib import Path
import pandas as pd

pd.set_option("display.max_columns", 30)
pd.set_option("display.width", 220)
pd.set_option("display.max_colwidth", 50)

ARCHIVOS = {
    "CARTERA_MENSUAL_ABRIL": r"D:\2026 Monteverdi\2026 ADMINISTRATIVOS\391 MONTEVERDI ABRILCcorregido recaudo abril facturacion mayo 2026 vers ultima.xls",
    "RECAUDO_FEBRERO":       r"D:\2026 Monteverdi\Recaudo planilla para facturaciòn\Pagos del mes Febrero 2026-1772662820368.xlsx",
    "CARTERA_ANUAL_2025":    r"D:\2026 Monteverdi\Asamblea 2026\Cartera 2025.xlsx",
    "MAESTRO_KAILIVING":     r"D:\2026 Monteverdi\2026 ADMINISTRATIVOS\Plantilla parametrización KaiLiving_Propiedad Horizontal.xlsx",
}

OUT = Path(r"D:\DASHBOARD 2026\deep_inspect_bloque1.md")

def dump(file_label: str, path: Path) -> list[str]:
    out: list[str] = []
    out.append(f"\n# {file_label}")
    out.append(f"`{path}`\n")
    try:
        engine = "xlrd" if path.suffix.lower() == ".xls" else "openpyxl"
        sheets = pd.read_excel(path, sheet_name=None, engine=engine, header=None)
    except Exception as e:
        out.append(f"ERROR: {e}")
        return out
    for sname, df in sheets.items():
        out.append(f"\n## Hoja: `{sname}`  ({df.shape[0]} filas × {df.shape[1]} cols)\n")
        if df.empty:
            out.append("_(vacía)_\n")
            continue
        # Mostrar todas las filas, hasta 30 columnas
        preview = df.iloc[:, : min(df.shape[1], 30)].copy()
        preview = preview.fillna("").astype(str)
        preview = preview.apply(lambda c: c.map(lambda v: (v[:35] + "…") if len(v) > 35 else v))
        out.append("```")
        out.append(preview.to_string(index=True, header=True, max_rows=None))
        out.append("```")
    return out


def main():
    lines: list[str] = ["# Exploración profunda — Bloque 1\n"]
    for label, p in ARCHIVOS.items():
        lines.extend(dump(label, Path(p)))
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Escrito: {OUT}")


if __name__ == "__main__":
    main()
