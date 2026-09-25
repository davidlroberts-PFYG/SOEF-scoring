import { roundDisplayValue } from '@/engine/rounding';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** Rounded per Section 6d: nearest $1,000 below $1M, nearest $10,000 above. */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return usd.format(roundDisplayValue(value));
}

/** Exact currency (inputs echo, e.g. the EBITDA the advisor typed). */
export function formatCurrencyExact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return usd.format(Math.round(value));
}

export function formatMultiple(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits).replace(/\.?0+$/, '')}×`;
}

export function formatPct(pct01: number | null | undefined): string {
  if (pct01 === null || pct01 === undefined || !Number.isFinite(pct01)) return '—';
  return `${Math.round(pct01 * 100)}%`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value.length === 10 ? `${value}T00:00:00` : value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
