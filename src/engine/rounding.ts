/**
 * Display rounding for dollar values (Section 6d):
 *   below $1,000,000 → nearest $1,000
 *   $1,000,000 and above → nearest $10,000
 * Applied at display time only; the engine keeps unrounded numbers so
 * per-factor attributions still sum to the total gap.
 */
export function roundDisplayValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const abs = Math.abs(value);
  const step = abs < 1_000_000 ? 1_000 : 10_000;
  return Math.sign(value) * Math.round(abs / step) * step;
}
