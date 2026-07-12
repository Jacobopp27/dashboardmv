"""Helpers de formato (números, moneda, porcentajes) para la UI."""
from __future__ import annotations


def fmt_money(x: float | int | None) -> str:
    if x is None:
        return "—"
    try:
        x = float(x)
    except (ValueError, TypeError):
        return "—"
    sign = "-" if x < 0 else ""
    return f"{sign}$ {abs(x):,.0f}".replace(",", ".")


def fmt_pct(x: float | None, decimals: int = 1) -> str:
    if x is None:
        return "—"
    try:
        return f"{x * 100:.{decimals}f}%"
    except (ValueError, TypeError):
        return "—"


def fmt_int(x: float | int | None) -> str:
    if x is None:
        return "—"
    try:
        return f"{int(x):,}".replace(",", ".")
    except (ValueError, TypeError):
        return "—"
