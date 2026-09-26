import ibba from '@content/benchmarks/ibba_market_pulse_size_tiers.json';

/**
 * Read-only reference for the override panel: IBBA / M&A Source Market Pulse
 * all-industry median multiples by deal size. Not sector-specific, so it is
 * shown as context for an override note, never applied automatically.
 */
export function BenchmarkReference() {
  const latestQuarter = ibba.tiers[0]?.quarter;
  const rows = ibba.tiers.filter((t) => t.quarter === latestQuarter);
  const src = rows[0];
  if (!src) return null;
  return (
    <div className="mt-4 rounded-md border border-line bg-surface p-3 text-xs text-ink">
      <p className="font-semibold text-navy">Reference: IBBA Market Pulse {latestQuarter} median multiples by deal size (all industries)</p>
      <table className="mt-2 w-full">
        <thead>
          <tr className="text-left text-ink-soft">
            <th className="py-1 pr-3 font-semibold">Deal size</th>
            <th className="py-1 pr-3 font-semibold">Basis</th>
            <th className="py-1 text-right font-semibold">Median ×</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.dealSizeTier} className="border-t border-line">
              <td className="py-1 pr-3">{t.dealSizeTier}</td>
              <td className="py-1 pr-3">{t.basis}</td>
              <td className="py-1 text-right font-semibold">{t.medianMultiple.toFixed(1)}×</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-ink-soft">
        {src.source}.{' '}
        <a href={src.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
          Source
        </a>{' '}
        · Reviewed {src.lastReviewed}. Not sector-specific; cite it in the override note if you use it.
      </p>
    </div>
  );
}
