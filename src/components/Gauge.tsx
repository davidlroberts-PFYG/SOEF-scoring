import type { BandDef } from '@/engine';

/**
 * Semicircular readiness gauge. Plain SVG so it renders identically on the
 * dashboard and in print. The band colouring is intentionally muted: this is
 * a preparation score, not a pass/fail verdict.
 */
export function Gauge({
  label,
  pct,
  band,
  total,
  max,
  size = 200,
}: {
  label: string;
  pct: number;
  band: BandDef | null;
  total: number;
  max: number;
  size?: number;
}) {
  const clamped = Math.min(1, Math.max(0, pct));
  const r = 80;
  const cx = 100;
  const cy = 100;
  const circumference = Math.PI * r; // half circle
  const dash = circumference * clamped;
  const color = band === null ? '#9aa5b1' : band.band >= 5 ? '#2f6b4f' : band.band >= 3 ? '#da5b36' : '#9b2c2c';
  return (
    <figure className="flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 200 115" width={size} height={size * 0.575} role="img" aria-label={`${label}: ${Math.round(clamped * 100)} percent`}>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#e3e8ee" strokeWidth="16" strokeLinecap="round" />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
        <text x={cx} y={cy - 14} textAnchor="middle" fontSize="34" fontWeight="700" fill="#0a1f33" fontFamily="var(--font-heading)">
          {Math.round(clamped * 100)}%
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="11" fill="#4a5a6a">
          {total} / {max} points
        </text>
      </svg>
      <figcaption className="-mt-1 text-center">
        <p className="font-heading text-sm font-bold text-navy">{label}</p>
        <p className="text-xs text-ink-soft">{band ? band.label : 'Not yet scored'}</p>
      </figcaption>
    </figure>
  );
}
