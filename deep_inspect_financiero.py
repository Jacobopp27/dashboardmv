"""Inspección profunda de los archivos financieros para el Bloque 2."""
from pathlib import Path
import pandas as pd

pd.set_option("display.max_columns", 30)
pd.set_option("display.width", 230)
pd.set_option("display.max_colwidth", 60)

ARCHIVOS = {
    "ESTADO_FIN_MARZO_2026": r"D:\2026 Monteverdi\2026 FINANICIEROS\03-2026-INFORMES FINANCIEROS MARZO  DE 2026 VERSION 3                ADMON (1).xls",
    "ESTADO_FIN_ENERO_2026": r"D:\2026 Monteverdi\ESTADOS FINANCIEROS 2026\01-2026-INFORMES FINANCIEROS ENERO DE 2026.xls",
    "ESTADO_FIN_DIC_2025":   r"D:\2026 Monteverdi\12-2025--URBANIZACION MONTEVERDI P.H.-ESTADOS FINANCIEROS  12-ADMON  VERSION 3 FEBRERO 27-2026.xls",
    "MODELO_GRAFICOS":       r"D:\2026 Monteverdi\2026 modelo de graficos estados financiero- 00.xlsx",
    "PRESUPUESTO_2026":      r"D:\2026 Monteverdi\Proyección de gastos version 01 . Proyecto ppto 2026   Version 02,.xlsx",
    "INFORME_ADMIN":         r"D:\2026 Monteverdi\2026 ADMINISTRATIVOS\informe Administrativo  2026.xlsx",
}

OUT = Path(r"D:\DASHBOARD 2026\deep_inspect_financiero.md")
# Hojas que queremos analizar profundamente (las financieras tabulares)
HOJAS_INTERES = {
    "ESTADO_FIN_MARZO_2026": ["ESTADO DE RESULTADOS 02-26", "ESFA", "NOTAS BALANCE", "GASTOS MES", "CONCILIACION BANCO", "INFORME ESPECIAL GASTO MENSUAL"],
    "ESTADO_FIN_ENERO_2026": ["ESTADO DE RESULTADOS", "ESFA", "GASTOS MES", "CONCILIACION BANCO"],
    "ESTADO_FIN_DIC_2025":   ["ESTADO DE RESULTADOS", "ESFA", "GASTOS MES", "CONCILIACION BANCO"],
    "PRESUPUESTO_2026":      ["PPTAPPTO2026 VERION02 NOTAadmon", "PPTA PPTO 2026 Version 02"],
    "INFORME_ADMIN":         ["Estado fondo Imprevistos"],
}


def dump(label: str, path: Path, hojas_filtro: list[str] | None = None) -> list[str]:
    out: list[str] = []
    out.append(f"\n# {label}")
    out.append(f"`{path}`\n")
    try:
        engine = "xlrd" if path.suffix.lower() == ".xls" else "openpyxl"
        sheets = pd.read_excel(path, sheet_name=None, engine=engine, header=None)
    except Exception as e:
        out.append(f"ERROR: {e}")
        return out
    out.append(f"**Hojas totales:** {len(sheets)} — {', '.join(repr(s) for s in list(sheets.keys())[:30])}")
    for sname, df in sheets.items():
        if hojas_filtro and not any(h.lower() in sname.lower() for h in hojas_filtro):
            continue
        out.append(f"\n## Hoja: `{sname}` ({df.shape[0]} filas × {df.shape[1]} cols)")
        if df.empty:
            out.append("_(vacía)_")
            continue
        # Para hojas grandes, mostrar primeras 30 filas y primeras 18 cols
        preview = df.iloc[: 30, : 18].copy()
        preview = preview.fillna("").astype(str)
        preview = preview.apply(lambda c: c.map(lambda v: (v[:42] + "…") if len(v) > 42 else v))
        out.append("```")
        out.append(preview.to_string(index=True, header=False))
        out.append("```")
    return out


def main():
    lines: list[str] = ["# Inspección profunda — archivos financieros (Bloque 2)\n"]
    for label, p in ARCHIVOS.items():
        hojas = HOJAS_INTERES.get(label)
        lines.extend(dump(label, Path(p), hojas))
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Escrito: {OUT}")


if __name__ == "__main__":
    main()
