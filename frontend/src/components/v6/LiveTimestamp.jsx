import { useEffect, useState } from 'react';

function formatUTC(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const Y = date.getUTCFullYear();
  const M = pad(date.getUTCMonth() + 1);
  const D = pad(date.getUTCDate());
  const h = pad(date.getUTCHours());
  const m = pad(date.getUTCMinutes());
  const s = pad(date.getUTCSeconds());
  return `${Y}-${M}-${D}  ${h}:${m}:${s} UTC`;
}

export default function LiveTimestamp({ className = '', compact = false }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const formatted = formatUTC(now);
  const label = compact ? formatted.slice(12) : formatted;

  return (
    <time
      dateTime={now.toISOString()}
      className={className}
      style={{
        fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
        fontSize: 11,
        letterSpacing: '0.02em',
        color: 'var(--ink)',
      }}
    >
      {label}
    </time>
  );
}
