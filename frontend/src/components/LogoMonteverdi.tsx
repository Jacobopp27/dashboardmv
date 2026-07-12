interface Props {
  /** Alto deseado en px (el ancho se ajusta proporcional) */
  height?: number;
  /** Mostrar solo el isotipo (V dorada y nada más) */
  isotipoOnly?: boolean;
  /** Variante "blanco" para fondos oscuros (el verde se vuelve blanco) */
  light?: boolean;
}

const GREEN = "#1F7A47";
const GOLD  = "#C9A55C";

/**
 * Logo Monteverdi Casas reconstruido en SVG inline.
 * Texto "Monte Verdi" en verde cursive serif + V dorada estilizada arriba + "CASAS" en dorado.
 */
export function LogoMonteverdi({ height = 44, isotipoOnly = false, light = false }: Props) {
  const w = isotipoOnly ? height * 1.0 : height * 4.3;
  const colorText = light ? "#FFFFFF" : GREEN;

  if (isotipoOnly) {
    // Solo la V dorada
    return (
      <svg viewBox="0 0 100 100" width={height} height={height} aria-label="Monteverdi">
        <path
          d="M 18 18 Q 40 75 50 55 Q 60 75 82 18 Q 70 32 60 50 Q 52 60 50 56 Q 48 60 40 50 Q 30 32 18 18 Z"
          fill={GOLD}
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 430 100" width={w} height={height} aria-label="Monteverdi Casas">
      {/* V dorada estilizada (centrada sobre la 'V' de Verdi) */}
      <path
        d="M 218 8 Q 240 62 252 50 Q 264 62 286 8 Q 274 22 264 40 Q 256 50 252 48 Q 248 50 240 40 Q 230 22 218 8 Z"
        fill={GOLD}
      />

      {/* Texto MonteVerdi */}
      <text
        x="10"
        y="78"
        fontFamily="'Playfair Display', Georgia, serif"
        fontSize="62"
        fontStyle="italic"
        fontWeight="700"
        fill={colorText}
        letterSpacing="-1"
      >
        Monte
      </text>
      <text
        x="244"
        y="78"
        fontFamily="'Playfair Display', Georgia, serif"
        fontSize="62"
        fontStyle="italic"
        fontWeight="700"
        fill={colorText}
        letterSpacing="-1"
      >
        erdi
      </text>

      {/* Subtítulo CASAS */}
      <text
        x="290"
        y="95"
        fontFamily="Georgia, serif"
        fontSize="11"
        letterSpacing="6"
        fill={GOLD}
      >
        CASAS
      </text>
    </svg>
  );
}
