"""Página de Resumen Ejecutivo."""
from __future__ import annotations

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from ui.formatting import fmt_money, fmt_pct


COLOR_VERDE = "#16a34a"
COLOR_AMARILLO = "#eab308"
COLOR_ROJO = "#dc2626"
COLOR_AZUL = "#2563eb"


def _semaforo(valor: float, verde_min: float, amarillo_min: float) -> str:
    """Devuelve un color según umbrales."""
    if valor >= verde_min:
        return COLOR_VERDE
    if valor >= amarillo_min:
        return COLOR_AMARILLO
    return COLOR_ROJO


def _kpi_card(col, label: str, value: str, delta: str | None = None, color: str = COLOR_AZUL):
    """Tarjeta KPI con color a la izquierda."""
    with col:
        st.markdown(
            f"""
            <div style="
                border-left: 6px solid {color};
                background: rgba(255,255,255,0.04);
                padding: 14px 18px;
                border-radius: 8px;
                margin-bottom: 8px;
            ">
              <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">{label}</div>
              <div style="font-size: 26px; font-weight: 700; margin-top: 4px;">{value}</div>
              {f'<div style="font-size: 13px; color: {color}; margin-top: 4px;">{delta}</div>' if delta else ''}
            </div>
            """,
            unsafe_allow_html=True,
        )


def render(data: dict[str, pd.DataFrame], year_filter: int | None = None):
    st.markdown("## 📊 Resumen Ejecutivo")
    cartera_m_full = data["cartera_mensual"]
    cartera_a_full = data["cartera_anual"]
    recaudo_full = data["recaudo"]

    if cartera_m_full.empty:
        st.warning("No se encontraron archivos de cartera mensual. Revisa la carpeta de datos.")
        return

    # Aplicar filtro de año si corresponde
    if year_filter is not None:
        cartera_m = cartera_m_full[cartera_m_full["year"] == year_filter].copy()
        cartera_a = cartera_a_full[cartera_a_full["year"] == year_filter].copy() if not cartera_a_full.empty else cartera_a_full
        recaudo = recaudo_full[recaudo_full["year"] == year_filter].copy() if not recaudo_full.empty else recaudo_full
        if cartera_m.empty and not cartera_a.empty:
            # Si no hay cartera mensual del año pero sí anual, usamos esa
            st.info(f"No hay archivos `391 MONTEVERDI` para {year_filter}. Mostrando histórico de `Cartera {year_filter}.xlsx`.")
    else:
        cartera_m = cartera_m_full
        cartera_a = cartera_a_full
        recaudo = recaudo_full

    if cartera_m.empty and cartera_a.empty:
        st.warning(f"No hay datos para el año seleccionado ({year_filter}).")
        return

    # Período más reciente de cartera mensual (o anual como fallback)
    if not cartera_m.empty:
        last_periodo = cartera_m["periodo"].max()
        df_actual = cartera_m[cartera_m["periodo"] == last_periodo]
    else:
        last_periodo = cartera_a["periodo"].max()
        df_actual = cartera_a[cartera_a["periodo"] == last_periodo].copy()
        # Adaptar columnas para que las tarjetas funcionen
        df_actual = df_actual.rename(columns={"facturacion": "valor_facturado", "saldo_contabilidad": "cuenta_pendiente"})
        df_actual["valor_pagado"] = df_actual["valor_facturado"] - df_actual["cuenta_pendiente"].clip(lower=0)

    total_facturado = df_actual["valor_facturado"].sum()
    total_recaudado = df_actual["valor_pagado"].sum()
    total_pendiente = df_actual["cuenta_pendiente"].clip(lower=0).sum()  # solo positivos
    pct_recaudo = (total_recaudado / total_facturado) if total_facturado else 0

    # Tarjetas
    st.markdown(f"**Período de corte:** {last_periodo.strftime('%B %Y').capitalize()}")
    c1, c2, c3, c4 = st.columns(4)
    _kpi_card(c1, "Total Facturado", fmt_money(total_facturado), color=COLOR_AZUL)
    _kpi_card(
        c2,
        "Total Recaudado",
        fmt_money(total_recaudado),
        delta=f"{fmt_pct(pct_recaudo)} de lo facturado",
        color=_semaforo(pct_recaudo, 0.85, 0.70),
    )
    _kpi_card(c3, "Cartera Pendiente", fmt_money(total_pendiente), color=COLOR_ROJO if total_pendiente > 0 else COLOR_VERDE)
    n_morosos = int((df_actual["cuenta_pendiente"] > 0).sum())
    _kpi_card(c4, "Unidades en Mora", str(n_morosos), delta=f"de {len(df_actual)} unidades", color=COLOR_AMARILLO if n_morosos > 0 else COLOR_VERDE)

    st.markdown("---")

    # Tendencia mensual
    titulo_periodo = f"Año {year_filter}" if year_filter else "Últimos 14 meses"
    st.markdown(f"### 📈 Tendencia mensual — Facturación vs Recaudo ({titulo_periodo})")

    # Construimos serie mensual: usamos cartera_mensual (más confiable para 2026)
    # y cartera_anual para histórico.
    if not cartera_m.empty:
        serie_m = (
            cartera_m.groupby("periodo")
            .agg(facturado=("valor_facturado", "sum"), recaudado=("valor_pagado", "sum"), pendiente=("cuenta_pendiente", lambda s: s.clip(lower=0).sum()))
            .reset_index()
            .sort_values("periodo")
        )
    else:
        serie_m = pd.DataFrame(columns=["periodo", "facturado", "recaudado", "pendiente"])

    if not cartera_a.empty:
        # Tomar de cartera_anual los meses que NO estén en cartera_m
        meses_m = set(serie_m["periodo"].dt.strftime("%Y-%m")) if not serie_m.empty else set()
        ca = cartera_a.copy()
        ca["periodo_key"] = ca["periodo"].dt.strftime("%Y-%m")
        ca_filtrada = ca[~ca["periodo_key"].isin(meses_m)]
        serie_a = (
            ca_filtrada.groupby("periodo")
            .agg(facturado=("facturacion", "sum"), pendiente=("saldo_contabilidad", lambda s: s.clip(lower=0).sum()))
            .reset_index()
        )
        serie_a["recaudado"] = 0  # no tenemos recaudo en cartera_anual
        serie_combinada = pd.concat([serie_m, serie_a], ignore_index=True).sort_values("periodo")
    else:
        serie_combinada = serie_m

    # Si hay filtro de año: solo ese año. Si no: últimos 14 meses.
    if year_filter is not None:
        serie_combinada = serie_combinada[serie_combinada["periodo"].dt.year == year_filter]
    else:
        serie_combinada = serie_combinada.tail(14)

    fig = go.Figure()
    fig.add_trace(
        go.Bar(
            x=serie_combinada["periodo"],
            y=serie_combinada["facturado"],
            name="Facturado",
            marker_color=COLOR_AZUL,
            opacity=0.75,
        )
    )
    fig.add_trace(
        go.Bar(
            x=serie_combinada["periodo"],
            y=serie_combinada["recaudado"],
            name="Recaudado",
            marker_color=COLOR_VERDE,
            opacity=0.85,
        )
    )
    fig.add_trace(
        go.Scatter(
            x=serie_combinada["periodo"],
            y=serie_combinada["pendiente"],
            name="Cartera Pendiente",
            mode="lines+markers",
            line=dict(color=COLOR_ROJO, width=3),
            yaxis="y2",
        )
    )
    # Si filtramos por año, en el eje X mostramos solo el mes (no el año, que es redundante)
    tick_format = "%b" if year_filter is not None else "%b %Y"
    fig.update_layout(
        barmode="group",
        height=420,
        margin=dict(l=10, r=10, t=20, b=10),
        legend=dict(orientation="h", y=-0.15),
        xaxis=dict(title=None, tickformat=tick_format, dtick="M1"),
        yaxis=dict(title="Facturado / Recaudado ($)", tickformat=",.0f"),
        yaxis2=dict(title="Cartera Pendiente ($)", overlaying="y", side="right", tickformat=",.0f"),
        hovermode="x unified",
    )
    st.plotly_chart(fig, use_container_width=True)

    st.markdown("---")

    # Composición de recaudo por método de pago (último mes con datos de recaudo)
    if not recaudo.empty:
        st.markdown("### 💳 Recaudo por forma de pago")
        last_recaudo_periodo = recaudo[["year", "month"]].drop_duplicates().sort_values(["year", "month"]).iloc[-1]
        r_actual = recaudo[(recaudo["year"] == last_recaudo_periodo["year"]) & (recaudo["month"] == last_recaudo_periodo["month"])]
        nombre_mes = pd.Timestamp(year=int(last_recaudo_periodo["year"]), month=int(last_recaudo_periodo["month"]), day=1).strftime("%B %Y").capitalize()
        st.caption(f"Datos de recaudo de: **{nombre_mes}** ({len(r_actual)} transacciones)")

        col_a, col_b = st.columns([1, 1])
        with col_a:
            por_forma = r_actual.groupby("forma_pago")["valor_pagado"].sum().reset_index().sort_values("valor_pagado", ascending=False)
            fig_p = px.pie(por_forma, names="forma_pago", values="valor_pagado", hole=0.5)
            fig_p.update_traces(textinfo="label+percent")
            fig_p.update_layout(height=320, margin=dict(l=10, r=10, t=10, b=10), showlegend=False)
            st.plotly_chart(fig_p, use_container_width=True)
        with col_b:
            st.dataframe(
                por_forma.assign(valor_pagado=por_forma["valor_pagado"].map(fmt_money)),
                hide_index=True,
                use_container_width=True,
            )
