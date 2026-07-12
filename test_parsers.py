"""Smoke test de los parsers con datos reales. Imprime shape + sample."""
import sys
sys.path.insert(0, r"D:\DASHBOARD 2026")

from ingestor.loader import load_all

import pandas as pd

pd.set_option("display.max_columns", 20)
pd.set_option("display.width", 180)
pd.set_option("display.max_colwidth", 40)

data = load_all(force_reload=True)

for key, df in data.items():
    if key == "scan_result":
        print(f"\n=== scan_result ===")
        for cat, files in df.items():
            print(f"  {cat}: {len(files)} archivos")
            for f in files[:3]:
                print(f"    - {f.path.name} (year={f.year}, month={f.month})")
        continue
    print(f"\n=== {key} ===")
    print(f"shape: {df.shape}")
    if df.empty:
        print("VACÍO")
        continue
    print(f"columnas: {list(df.columns)}")
    print(f"dtypes:\n{df.dtypes}")
    print(f"head:\n{df.head(8)}")
