/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0D9488",
          50:  "#F0FDFA",
          100: "#CCFBF1",
          200: "#99F6E4",
          300: "#5EEAD4",
          400: "#2DD4BF",
          500: "#14B8A6",
          600: "#0D9488",
          700: "#0F766E",
          900: "#134E4A",
        },
        soft: {
          red:    "#FEE2E2",
          orange: "#FFEDD5",
          yellow: "#FEF9C3",
          green:  "#CCFBF1",
          blue:   "#CFFAFE",
          teal:   "#CCFBF1",
          gray:   "#F3F4F6",
        },
        icon: {
          red:    "#DC2626",
          orange: "#EA580C",
          yellow: "#CA8A04",
          green:  "#0D9488",
          blue:   "#0891B2",
          teal:   "#0D9488",
          gray:   "#6B7280",
        },
        ink: {
          900: "#111827",
          700: "#374151",
          500: "#6B7280",
          300: "#D1D5DB",
          200: "#E5E7EB",
          100: "#F3F4F6",
          50:  "#F9FAFB",
        },
        // Paleta ejecutiva (alineada con Estado de Resultados): navy + dorado + ivory
        exec: {
          bg:         "#FFFFFF",   // BLANCO PURO (fondo del tablero)
          bg2:        "#FAF7F0",   // ivory suave
          panel:      "#FFFFFF",
          text:       "#0F2438",   // Navy ejecutivo (texto principal)
          subtext:    "#5A6470",   // Gris azulado (texto secundario)
          card:       "#FFFFFF",
          cardCream:  "#FAF7F0",   // ivory para tarjetas de acento
          cardBorder: "#E5E1D6",   // borde dorado-ivory sutil
          cardText:   "#0F2438",
          cardSubtext:"#5A6470",
          navy:       "#0F2438",   // navy ejecutivo
          navyDark:   "#091A2C",
          gold:       "#C9A55C",
          green:      "#1E7A4F",
          red:        "#B43A3A",
          amber:      "#C97A1E",
        },
        // Verde menta brillante para resaltar el dato/mes actual
        attention: {
          DEFAULT: "#00A86B",
          50:  "#E6F7F0",
          100: "#B3E8D2",
          200: "#80D9B4",
          300: "#4DCB97",
          400: "#1ABC79",
          500: "#00A86B",
          600: "#008C58",
          700: "#006F46",
        },
        // Texto principal: navy ejecutivo (alineado con Estado de Resultados)
        deepgreen: {
          900: "#0F2438",   // navy ejecutivo (antes verde Monteverdi #0E2410)
          700: "#1F3A52",   // navyLight
          500: "#5A6470",   // textMute gris azulado
          300: "#8C95A0",
          50:  "#FAF7F0",   // ivory suave (fondo de pills/badges)
        },
        // Paleta contable Monteverdi — Activo / Pasivo / Patrimonio
        accounting: {
          // 🟢 Activos — gama de Verdes (identidad Monteverdi)
          "activo-dark":   "#1E4620",   // Efectivo y Bancos
          "activo-mid":    "#4CAF50",   // Cuentas por Cobrar
          "activo-light":  "#81C784",   // Otros Activos / Propiedades
          // 🟦 Pasivos — Gris-Azulado / Azul Marino
          "pasivo-dark":   "#1F3A52",   // Proveedores y Contratistas
          "pasivo-mid":    "#3A6073",   // Obligaciones laborales / impuestos
          "pasivo-light":  "#7091A4",   // Provisiones / Otros pasivos
          // 🟡 Patrimonio — Dorado / Arena
          "patrim-dark":   "#D4AF37",   // Fondo de Imprevistos
          "patrim-light":  "#E6C229",   // Resultados ejercicios anteriores
        },
        // Azul navy ejecutivo (color primario)
        navy: {
          50:  "#EEF2FA",
          100: "#D7E0F0",
          200: "#A8B9DC",
          300: "#7790C5",
          400: "#4F6DAF",
          500: "#2E4F94",
          600: "#1E3A8A",   // primario
          700: "#1B3274",
          800: "#162958",
          900: "#0F1E3D",
        },
        // Verde esmeralda suave
        emerald: {
          50:  "#ECFDF5",
          100: "#D1FAE5",
          200: "#A7F3D0",
          300: "#6EE7B7",
          400: "#34D399",
          500: "#10B981",
          600: "#0E9F70",
          700: "#0C7F5A",
        },
        // Dorado / arena (acento)
        sand: {
          50:  "#FBF8EE",
          100: "#F0E5C2",
          200: "#E0CC8A",
          300: "#D4B886",
          400: "#C9A55C",
          500: "#B89150",
          600: "#9C7B3F",
        },
        // Colores de gráficos (paleta clásica solicitada)
        chart: {
          // Resumen Consolidado Anual
          ingreso:     "#1E3A8A",   // azul navy
          gasto:       "#C9A55C",   // dorado arena
          line:        "#10B981",   // esmeralda
          // Donut Solvencia
          razonCorr:   "#10B981",   // esmeralda (35%)
          razonAcida:  "#1E3A8A",   // navy (20%)
          endeud:      "#D4B886",   // arena clara (25%)
          cobertura:   "#0F1E3D",   // navy profundo (20%)
          // Treemap Gastos (paleta navy/esmeralda/arena)
          treemapBig:  "#1E3A8A",   // navy grande
          treemapMid:  "#10B981",   // esmeralda
          treemapMid2: "#C9A55C",   // arena dorada
          treemapDark: "#0F1E3D",   // navy profundo
          treemapAlt:  "#34D399",   // esmeralda claro
          treemapAdmin:"#D4B886",   // arena clara
          // Liquidez Mensual y Resultados
          barTrend:    "#1E3A8A",   // navy
          lineTrend:   "#C9A55C",   // dorado
        },
        // Icono cuadrado tonos navy/emerald
        iconBox: {
          green:     "#D1FAE5",     // fondo verde suave
          greenDark: "#0E9F70",
          navy:      "#D7E0F0",
          navyDark:  "#1E3A8A",
          sand:      "#F0E5C2",
          sandDark:  "#9C7B3F",
        },
        // Semáforo de gestión
        traffic: {
          green:  "#10B981",
          yellow: "#F59E0B",
          red:    "#EF4444",
        },
        gold: {
          50:  "#FBF8EE",
          100: "#F0E5C2",
          200: "#DCC890",
          300: "#C9B560",   // item activo (más vivo)
          400: "#B8A656",
          500: "#A89856",   // verde oliva mate
          600: "#9C8A50",   // sidebar items (oliva mate como imagen)
          700: "#7A6B40",
          900: "#3F351C",
        },
      },
      fontFamily: {
        // Tipografía ejecutiva: Segoe UI primero (alineado con el reporte de Estado de Resultados)
        sans: ["Segoe UI", "Segoe UI Variable", "-apple-system", "BlinkMacSystemFont", "Inter", "Roboto", "sans-serif"],
        display: ["'Playfair Display'", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(0, 0, 0, 0.04), 0 1px 3px 0 rgba(0, 0, 0, 0.05)",
        exec: "0 4px 14px 0 rgba(0, 0, 0, 0.25), 0 1px 3px 0 rgba(0, 0, 0, 0.2)",
        elegant: "0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(184, 160, 80, 0.10)",
        // Bordes difuminados (glow) por color de la paleta
        "soft-glow":         "0 0 0 1px rgba(228, 228, 231, 0.7), 0 4px 16px -4px rgba(30, 58, 138, 0.10), 0 2px 6px -2px rgba(0, 0, 0, 0.04)",
        "soft-glow-navy":    "0 0 0 1px rgba(30, 58, 138, 0.15), 0 6px 20px -6px rgba(30, 58, 138, 0.18), 0 2px 4px -2px rgba(0, 0, 0, 0.04)",
        "soft-glow-emerald": "0 0 0 1px rgba(16, 185, 129, 0.15), 0 6px 20px -6px rgba(16, 185, 129, 0.18), 0 2px 4px -2px rgba(0, 0, 0, 0.04)",
        "soft-glow-gold":    "0 0 0 1px rgba(201, 165, 92, 0.22), 0 6px 20px -6px rgba(201, 165, 92, 0.20), 0 2px 4px -2px rgba(0, 0, 0, 0.04)",
        "soft-glow-red":     "0 0 0 1px rgba(239, 68, 68, 0.15), 0 6px 20px -6px rgba(239, 68, 68, 0.18), 0 2px 4px -2px rgba(0, 0, 0, 0.04)",
        // Glows contables específicos
        "soft-glow-activo":  "0 0 0 1px rgba(30, 70, 32, 0.18), 0 6px 20px -6px rgba(30, 70, 32, 0.20), 0 2px 4px -2px rgba(0, 0, 0, 0.04)",
        "soft-glow-pasivo":  "0 0 0 1px rgba(31, 58, 82, 0.20), 0 6px 20px -6px rgba(31, 58, 82, 0.22), 0 2px 4px -2px rgba(0, 0, 0, 0.04)",
        "soft-glow-patrim":  "0 0 0 1px rgba(212, 175, 55, 0.25), 0 6px 20px -6px rgba(212, 175, 55, 0.22), 0 2px 4px -2px rgba(0, 0, 0, 0.04)",
      },
      letterSpacing: {
        tightest: "-0.025em",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
    },
  },
  plugins: [],
};
