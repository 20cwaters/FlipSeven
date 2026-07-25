/**
 * Thematic artwork for the join screen: a deco marquee frame with a fan of
 * numbered cards arcing out of the top, echoing the box art.
 */

const FAN = [
  { rotate: -54, fill: '#5AB4E8', label: '3' },
  { rotate: -36, fill: '#3FA96B', label: '5' },
  { rotate: -18, fill: '#F9BE3B', label: '7' },
  { rotate: 0, fill: '#F79B4D', label: '9' },
  { rotate: 18, fill: '#E2452C', label: '11' },
  { rotate: 36, fill: '#C93A6B', label: '12' },
  { rotate: 54, fill: '#7C5CC4', label: '2' },
];

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 240"
      className={className}
      role="img"
      aria-label="Flip 7 — press your luck, race to 200"
    >
      <defs>
        <linearGradient id="fm-card" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFBF0" />
          <stop offset="100%" stopColor="#EADFC4" />
        </linearGradient>
        <filter id="fm-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#063A39" floodOpacity="0.45" />
        </filter>
      </defs>

      {/* Card fan, pivoting from a point below the wordmark */}
      <g filter="url(#fm-shadow)">
        {FAN.map((card) => (
          <g key={card.rotate} transform={`rotate(${card.rotate} 160 190)`}>
            <rect
              x="140"
              y="42"
              width="40"
              height="58"
              rx="6"
              fill={card.fill}
              stroke="#0D2B3A"
              strokeWidth="3.5"
            />
            <text
              x="160"
              y="80"
              textAnchor="middle"
              fontFamily="Archivo Black, Arial Black, sans-serif"
              fontSize="26"
              fill="#0D2B3A"
              opacity="0.85"
            >
              {card.label}
            </text>
          </g>
        ))}
      </g>

      {/* Marquee plaque */}
      <g filter="url(#fm-shadow)">
        <rect
          x="42"
          y="126"
          width="236"
          height="86"
          rx="12"
          fill="url(#fm-card)"
          stroke="#0D2B3A"
          strokeWidth="4"
        />
        <rect
          x="52"
          y="136"
          width="216"
          height="66"
          rx="7"
          fill="none"
          stroke="#E2452C"
          strokeWidth="2.5"
          strokeDasharray="7 5"
        />
        <text
          x="160"
          y="180"
          textAnchor="middle"
          fontFamily="Archivo Black, Arial Black, sans-serif"
          fontSize="46"
          fill="#E2452C"
          letterSpacing="2"
        >
          FLIP
          <tspan fill="#0B6C68" dx="8">
            7
          </tspan>
        </text>
        <text
          x="160"
          y="197"
          textAnchor="middle"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="10"
          fontWeight="700"
          fill="#0D2B3A"
          letterSpacing="3.5"
        >
          PRESS YOUR LUCK
        </text>
      </g>
    </svg>
  );
}

/** Slim wordmark for the in-game header. */
export function WordMark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display uppercase leading-none tracking-tight ${className}`}>
      <span className="text-tomato text-outline-thin">Flip</span>
      <span className="ml-1 text-marquee text-outline-thin">7</span>
    </span>
  );
}
