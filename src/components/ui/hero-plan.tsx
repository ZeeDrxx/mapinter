/**
 * Illustration de la page d'accueil : un hall en plan, le point « Vous êtes ici »
 * et le trajet jusqu'au stand B12. Dessinée avec les tokens : elle suit le thème.
 */
export function HeroPlan({ className = "" }: { className?: string }) {
  const cols = 7;
  const w = 34;
  const h = 26;
  const rows = [
    { y: 70, prefix: "A" },
    { y: 96, prefix: "A" },
    { y: 172, prefix: "B" },
    { y: 198, prefix: "B" },
  ];
  const left = 40;
  const right = 300;
  const target = { x: right + 4 * w, y: 172 }; // B12

  return (
    <svg viewBox="0 0 600 320" className={className} role="img" aria-label="Plan d'un salon : vous êtes à l'entrée, le stand B12 est à 62 mètres vers le nord-est">
      {/* Hall */}
      <rect x="16" y="24" width="568" height="272" rx="3" fill="var(--sheet)" stroke="var(--hair-strong)" />
      <text x="32" y="48" fill="var(--t3)" fontSize="10" fontWeight="700" letterSpacing="1.6">HALL 1</text>

      {/* Allées */}
      <rect x="16" y="130" width="568" height="34" fill="var(--paper-2)" opacity="0.7" />
      <rect x="282" y="24" width="14" height="272" fill="var(--paper-2)" opacity="0.7" />

      {/* Stands */}
      {rows.map(({ y, prefix }, r) =>
        [left, right].map((x0, half) =>
          Array.from({ length: cols }, (_, i) => {
            const x = x0 + i * w;
            const n = (r % 2) * cols * 2 + half * cols + i + 1;
            const isTarget = x === target.x && y === target.y;
            return (
              <g key={`${r}-${half}-${i}`}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill={isTarget ? "var(--signal-soft)" : "var(--sheet)"}
                  stroke={isTarget ? "var(--signal)" : "var(--hair-strong)"}
                  strokeWidth={isTarget ? 2 : 1}
                />
                <text
                  x={x + w / 2}
                  y={y + h / 2 + 3.5}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill={isTarget ? "var(--signal-ink)" : "var(--t4)"}
                  fontFamily="var(--font-mono)"
                >
                  {prefix}
                  {n}
                </text>
              </g>
            );
          }),
        ),
      )}

      {/* Scène */}
      <rect x="430" y="240" width="140" height="40" rx="2" fill="var(--ink)" opacity="0.14" />
      <text x="500" y="264" textAnchor="middle" fill="var(--t3)" fontSize="9" fontWeight="700" letterSpacing="1.4">SCÈNE</text>

      {/* Trajet */}
      <path
        d={`M289 286 V147 H${target.x + w / 2} V${target.y - 3}`}
        fill="none"
        stroke="var(--signal)"
        strokeWidth="2.5"
        strokeDasharray="1 7"
        strokeLinecap="round"
      />

      {/* Vous êtes ici */}
      <circle cx="289" cy="286" r="16" fill="var(--signal)" opacity="0.16" />
      <circle cx="289" cy="286" r="7" fill="var(--signal)" stroke="var(--sheet)" strokeWidth="3" />

      {/* Plaque d'entrée */}
      <g transform="translate(150 262)">
        <rect width="118" height="24" rx="3" fill="var(--signal)" />
        <text x="59" y="16" textAnchor="middle" fill="var(--on-signal)" fontSize="10.5" fontWeight="700">Vous êtes ici</text>
      </g>

      {/* Bande de direction */}
      <g transform="translate(428 36)">
        <rect width="148" height="54" rx="3" fill="var(--ink)" />
        <rect x="8" y="8" width="38" height="38" rx="3" fill="var(--signal)" />
        <path d="M27 17v20M27 17l-6 6M27 17l6 6" fill="none" stroke="var(--on-signal)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" transform="rotate(45 27 27)" />
        <text x="56" y="27" fill="var(--on-ink)" fontSize="17" fontWeight="800" letterSpacing="-0.4">62 m</text>
        <text x="56" y="42" fill="var(--on-ink)" opacity="0.7" fontSize="9.5" fontWeight="600">Stand B12 · 1 min</text>
      </g>
    </svg>
  );
}
