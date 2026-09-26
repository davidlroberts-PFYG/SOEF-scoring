import { formatMultiple } from '@/lib/format';

/**
 * Range-of-value bar: low multiple → high multiple, with the owner's current
 * position marked and best-in-class at the top of the range.
 */
export function RangeBar({
  low,
  high,
  current,
  position,
  basis,
  median,
  topLabel = 'Best-in-class',
}: {
  low: number | null;
  high: number | null;
  current: number | null;
  position: number | null;
  basis: string;
  median?: number | null;
  topLabel?: string;
}) {
  if (low === null || high === null) {
    return <p className="text-sm text-ink-soft">No multiple range available.</p>;
  }
  const pos = position === null ? 0 : Math.min(1, Math.max(0, position));
  const x = 40 + pos * 520;
  const medianPos = median !== null && median !== undefined && high > low ? Math.min(1, Math.max(0, (median - low) / (high - low))) : null;
  const mx = medianPos === null ? null : 40 + medianPos * 520;
  return (
    <svg viewBox="0 0 600 90" className="h-auto w-full" role="img" aria-label={`Range of value ${low} to ${high} times ${basis}; current position ${current ?? 'unknown'}`}>
      <defs>
        <linearGradient id="rangeGrad" x1="0" x2="1">
          <stop offset="0" stopColor="#c9d3de" />
          <stop offset="1" stopColor="#0a1f33" />
        </linearGradient>
      </defs>
      <rect x="40" y="38" width="520" height="14" rx="7" fill="url(#rangeGrad)" />
      {/* Low */}
      <text x="40" y="74" fontSize="12" fill="#4a5a6a" textAnchor="start">
        Low {formatMultiple(low)}
      </text>
      {/* Sector median */}
      {mx !== null ? (
        <>
          <line x1={mx} y1="30" x2={mx} y2="60" stroke="#4a5a6a" strokeWidth="2" strokeDasharray="3 3" />
          <text x={mx} y="18" fontSize="11" fill="#4a5a6a" textAnchor="middle">
            Median {formatMultiple(median)}
          </text>
        </>
      ) : null}
      {/* Top of range */}
      <line x1="560" y1="26" x2="560" y2="64" stroke="#2f6b4f" strokeWidth="2" />
      <text x="560" y="18" fontSize="12" fontWeight="700" fill="#2f6b4f" textAnchor="end">
        {topLabel} {formatMultiple(high)}
      </text>
      {/* Current */}
      <line x1={x} y1="26" x2={x} y2="64" stroke="#da5b36" strokeWidth="3" />
      <circle cx={x} cy="45" r="9" fill="#da5b36" stroke="#fff" strokeWidth="3" />
      <text x={x} y={pos > 0.75 ? 84 : 84} fontSize="12" fontWeight="700" fill="#da5b36" textAnchor={pos > 0.85 ? 'end' : pos < 0.15 ? 'start' : 'middle'}>
        You: {formatMultiple(current)} {basis}
      </text>
    </svg>
  );
}
