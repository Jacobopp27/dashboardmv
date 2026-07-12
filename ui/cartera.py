"""Página de análisis de Cartera."""
from __future__ import annotations

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from ui.formatting import fmt_money, fmt_pct


COLOR_VERDE = "#16a34a"
COLOR_AMARILLO = "#eab308"
COLOR_NARANJA = "#f97316"
COLOR_ROJO = "#dc2626"
COLOR_ROJO_OSC = "#991b1b"


def _rango_mora(cuenta_pendiente: float, administracion: float) -> str:
    """Clasifica el saldo en rangos según múltiplos de la cuota mensual.

    Aproximación: si la cuota mensual es C, asumimos que:
      pendiente <= 0       -> Al día
      0 < pendiente <= C   -> 1-30 días (1 mes de mora)
      C < pendiente <= 2C  -> 31-60 días
      2C < pendiente <= 3C -> 61-90 días
      pendiente > 3C       -> +90 días
    """
    if cuenta_pendiente <= 0 or administracion <= 0:
        return "Al día"
    if cuenta_pendiente <= administracion:
        return "1-30 días"
    if cuenta_pendiente <= 2 * administracion:
        return "31-60 días"
    if cuenta_pendiente <= 3 * administracion:
        return "61-90 días"
    return "+90 días"


RANGO_COLOR = {
    "Al día": COLOR_VERDE,
    "1-30 días": COLOR_AMARILLO,
    "31-60 días": COLOR_NARANJA,
    "61-90 días": COLOR_ROJO,
    "+90 días": COLOR_ROJO_OSC,
}
RANGO_ORDEN = ["Al día", "1-30 días", "31-60 días", "61-90 días", "+90 días"]


def render(data: dict[str, pd.DataFrame], year_filter: int | None = None):
    st.markdown("## 💰 Análisis de Cartera")
    cartera_m = data["cartera_mensual"]
    unidades = data["unidades"]

    if cartera_m.empty:
        st.warning("No hay datos de cartera mensual.")
        return

    # Filtro de año global
    if year_filter is not None:
        cartera_m = cartera_m[cartera_m["year"] == year_filter].copy()
        if cartera_m.empty:
            st.warning(f"No hay archivos de cartera mensual para el año {year_filter}.")
            return

    # Selector de período (mes)
    periodos = sorted(cartera_m["periodo"].unique(), reverse=True)
    nombres_periodo = [pd.Timestamp(p).strftime("%B %Y").capitalize() for p in periodos]
    label_periodo = f"Período de corte ({year_filter})" if year_filter else "Período de corte"
    idx = st.selectbox(
        label_periodo,
        options=range(len(periodos)),
        format_func=lambda i: nombres_periodo[i],
        index=0,
    )
    periodo_sel = periodos[idx]
    df = cartera_m[cartera_m["periodo"] == periodo_sel].copy()

    # Agregar propietario desde maestro (un propietario por unidad - el primero)
    if not unidades.empty:
        prop_map = (
            unidades[unidades["rol"] == "propietario"]
            .groupby("unidad")["nombre_completo"]
            .first()
            .to_dict()
        )
        df["propietario"] = df["unidad"].map(prop_map).fillna("—")
    else:
        df["propietario"] = "—"

    # Clasificar mora
    df["rango_mora"] = df.apply(lambda r: _rango_mora(r["cuenta_pendiente"], r["administracion"]), axis=1)

    # KPIs cartera
    total_facturado = df["valor_facturado"].sum()
    total_recaudado = df["valor_pagado"].sum()
    cartera_pendiente = df["cuenta_pendiente"].clip(lower=0).sum()
    unidades_morosas = int((df["cuenta_pendiente"] > 0).sum())
    unidades_total = len(df)

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Facturado", fmt_money(total_facturado))
    c2.metric("Recaudado", fmt_money(total_recaudado), delta=fmt_pct(total_recaudado / total_facturado if total_facturado else 0))
    c3.metric("Pendiente", fmt_money(cartera_pendiente))
    c4.metric("Unidades en mora", f"{unidades_morosas} de {unidades_total}", delta=fmt_pct(unidades_morosas / unidades_total if unidades_total else 0))

    st.markdown("---")

    col_a, col_b = st.columns([1, 1])

    # Distribución por rango de mora
    with col_a:
        st.markdown("### 📊 Distribución por rango de mora")
        por_rango = (
            df.groupby("rango_mora")
            .agg(unidades=("unidad", "count"), valor=("cuenta_pendiente", lambda s: s.clip(lower=0).sum()))
            .reindex(RANGO_ORDEN, fill_value=0)
            .reset_index()
        )
        fig_b = go.Figure()
        fig_b.add_trace(
            go.Bar(
                x=por_rango["rango_mora"],
                y=por_rango["unidades"],
                text=por_rango["unidades"],
                textposition="outside",
                marker_color=[RANGO_COLOR[r] for r in por_rango["rango_mora"]],
                hovertemplate="<b>%{x}</b><br>Unidades: %{y}<br>Valor: %{customdata}<extra></extra>",
                customdata=[fmt_money(v) for v in por_rango["valor"]],
            )
        )
        fig_b.update_layout(
            height=340,
            margin=dict(l=10, r=10, t=20, b=10),
            yaxis=dict(title="Unidades"),
            xaxis=dict(title=None),
            showlegend=False,
        )
        st.plotly_chart(fig_b, use_container_width=True)

    # Cartera al día vs en mora (donut)
    with col_b:
        st.markdown("### 🎯 Estado general")
        al_dia = unidades_total - unidades_morosas
        donut_df = pd.DataFrame({"estado": ["Al día", "En mora"], "valor": [al_dia, unidades_morosas]})
        fig_d = px.pie(donut_df, names="estado", values="valor", hole=0.6,
                       color="estado",
                       color_discrete_map={"Al día": COLOR_VERDE, "En mora": COLOR_ROJO})
        fig_d.update_traces(textinfo="label+value+percent", textfont_size=14)
        fig_d.update_layout(height=340, margin=dict(l=10, r=10, t=20, b=10), showlegend=False)
        st.plotly_chart(fig_d, use_container_width=True)

    st.markdown("---")

    # Top deudores
    st.markdown("### 🚨 Top 10 unidades con mayor saldo pendiente")
    morosos = (
        df[df["cuenta_pendiente"] > 0]
        .sort_values("cuenta_pendiente", ascending=False)
        .head(10)
        .copy()
    )
    if morosos.empty:
        st.success("¡No hay unidades en mora en este período!")
    else:
        morosos["unidad_str"] = "Casa " + morosos["unidad"].astype(str)
        fig_top = px.bar(
            morosos,
            x="cuenta_pendiente",
            y="unidad_str",
            orientation="h",
            color="rango_mora",
            color_discrete_map=RANGO_COLOR,
            hover_data={"propietario": True, "unidad_str": False, "cuenta_pendiente": ":,.0f", "rango_mora": True},
            text=morosos["cuenta_pendiente"].map(fmt_money),
        )
        fig_top.update_traces(textposition="outside")
        fig_top.update_layout(
            height=440,
            yaxis=dict(title=None, autorange="reversed"),
            xaxis=dict(title="Saldo pendiente ($)", tickformat=",.0f"),
            margin=dict(l=10, r=30, t=20, b=10),
            legend=dict(orientation="h", y=-0.15, title=None),
        )
        st.plotly_chart(fig_top, use_container_width=True)

    st.markdown("---")
    st.markdown("### 📋 Detalle completo del período")
    df_show = df.sort_values("cuenta_pendiente", ascending=False)[
        ["unidad", "propietario", "administracion", "valor_facturado", "valor_pagado", "cuenta_pendiente", "rango_mora", "factura_num"]
    ].copy()
    # Formato visual
    df_show = df_show.assign(
        administracion=df_show["administracion"].map(fmt_money),
        valor_facturado=df_show["valor_facturado"].map(fmt_money),
        valor_pagado=df_show["valor_pagado"].map(fmt_money),
        cuenta_pendiente=df_show["cuenta_pendiente"].map(fmt_money),
    )
    df_show.columns = ["Casa", "Propietario", "Cuota Admón.", "Facturado", "Pagado", "Pendiente", "Rango Mora", "Factura"]
    st.dataframe(df_show, hide_index=True, use_container_width=True, height=500)
