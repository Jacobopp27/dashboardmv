"""Dashboard administrativo Urbanización Monteverdi P.H.

Entry point Streamlit. Ejecutar con:
    streamlit run app.py
"""
from __future__ import annotations

import sys
from pathlib import Path

# Asegurar que los paquetes locales sean importables
sys.path.insert(0, str(Path(__file__).parent))

import streamlit as st

from config.settings import CONJUNTO
from ingestor.loader import load_all
from ui import cartera, home


st.set_page_config(
    page_title=f"Dashboard {CONJUNTO}",
    page_icon="🏘️",
    layout="wide",
    initial_sidebar_state="expanded",
)


# Cache de los datos para no releer Excels en cada interacción del usuario.
# El cache se invalida si se hace click en "Refrescar".
@st.cache_data(show_spinner="Leyendo Excels...")
def _load(force: bool):
    return load_all(force_reload=force)


def _available_years(data: dict) -> list[int]:
    """Años disponibles en los datasets (unión de cartera mensual + anual + recaudo)."""
    years: set[int] = set()
    for key in ("cartera_mensual", "cartera_anual", "recaudo"):
        df = data.get(key)
        if df is not None and not df.empty and "year" in df.columns:
            years.update(int(y) for y in df["year"].dropna().unique())
    return sorted(years)


def main():
    # ----- Cargar datos primero (para poblar el selector de año)
    data = _load(force=False)

    # ----- Sidebar
    with st.sidebar:
        st.markdown(f"### 🏘️ {CONJUNTO}")
        st.markdown("Dashboard administrativo")
        st.markdown("---")
        page = st.radio(
            "Sección",
            ["📊 Resumen Ejecutivo", "💰 Cartera"],
            label_visibility="collapsed",
        )
        st.markdown("---")

        # Filtro global de año
        st.markdown("**🗓️ Filtro de año**")
        years = _available_years(data)
        opciones = ["Todos los años"] + [str(y) for y in reversed(years)]
        seleccion = st.selectbox(
            "Año",
            options=opciones,
            index=0,
            label_visibility="collapsed",
            help="Filtra los gráficos mensuales por año. 'Todos' muestra el histórico completo.",
        )
        year_filter: int | None = None if seleccion == "Todos los años" else int(seleccion)

        st.markdown("---")
        if st.button("🔄 Refrescar datos", use_container_width=True, help="Vuelve a leer los Excels (ignora cache)"):
            _load.clear()
            st.cache_data.clear()
            st.rerun()
        st.caption("Lee automáticamente todos los Excels de `D:\\2026 Monteverdi`. Cuando agregues archivos nuevos al folder, presiona Refrescar.")

        st.markdown("---")
        st.caption("**Datos detectados**")
        sr = data["scan_result"]
        for cat, files in sr.items():
            st.caption(f"• {cat}: **{len(files)}**")

    # ----- Render página seleccionada
    if page.startswith("📊"):
        home.render(data, year_filter=year_filter)
    elif page.startswith("💰"):
        cartera.render(data, year_filter=year_filter)


if __name__ == "__main__":
    main()
