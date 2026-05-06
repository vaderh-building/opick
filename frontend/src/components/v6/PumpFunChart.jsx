export default function PumpFunChart() {
  const data = [
    { label: "JAN '25", value: 24000, projected: false },
    { label: "FEB '25", value: 11900, projected: false },
    { label: "MAR '25", value: 6600, projected: true },
  ];

  const max = 25000;
  const W = 720;
  const H = 320;
  const padTop = 40;
  const padRight = 24;
  const padBottom = 72;
  const padLeft = 64;
  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;
  const gap = 64;
  const barW = (chartW - gap * (data.length - 1)) / data.length;
  const ticks = [0, 5000, 10000, 15000, 20000, 25000];

  return (
    <figure style={{ margin: '28px 0 8px', padding: 0 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Pump.fun monthly bonding curve graduations, January through March 2025"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {ticks.map((t) => {
          const y = padTop + chartH - (t / max) * chartH;
          return (
            <g key={t}>
              <line
                x1={padLeft}
                y1={y}
                x2={W - padRight}
                y2={y}
                stroke={t === 0 ? 'var(--ink)' : 'var(--border)'}
                strokeWidth={t === 0 ? 1.25 : 1}
              />
              <text
                x={padLeft - 12}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--dim)' }}
              >
                {t === 0 ? '0' : `${t / 1000}k`}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const x = padLeft + i * (barW + gap);
          const h = (d.value / max) * chartH;
          const y = padTop + chartH - h;
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                fill="var(--ink)"
                fillOpacity={d.projected ? 0.38 : 1}
              />
              <text
                x={x + barW / 2}
                y={y - 12}
                textAnchor="middle"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fill: 'var(--ink)' }}
              >
                {d.value.toLocaleString()}
              </text>
              <text
                x={x + barW / 2}
                y={padTop + chartH + 24}
                textAnchor="middle"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 11,
                  fill: 'var(--ink)',
                  letterSpacing: '0.14em',
                  fontWeight: 500,
                }}
              >
                {d.label}
              </text>
              {d.projected && (
                <text
                  x={x + barW / 2}
                  y={padTop + chartH + 42}
                  textAnchor="middle"
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 9,
                    fill: 'var(--muted)',
                    letterSpacing: '0.18em',
                  }}
                >
                  PROJECTED
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          color: 'var(--dim)',
          marginTop: 14,
          textAlign: 'left',
        }}
      >
        Source — Dune Analytics, via Cointelegraph March 2025
      </figcaption>
    </figure>
  );
}
