import type {
  EarningsBasis,
  FactorAttribution,
  FactorScoreRow,
  MultipleSource,
  ValueGapResult,
} from './types';

export const NO_EARNINGS_MESSAGE = 'Valuation requires positive normalized earnings.';
export const NO_MULTIPLES_MESSAGE =
  'This sector has no multiple range yet. Enter a custom low/high multiple override (with a note) to see an estimated value.';
export const INVALID_MULTIPLES_MESSAGE =
  'Multiple range is invalid: both multiples must be positive and the high multiple must be at least the low multiple.';
export const BASIS_MISMATCH_MESSAGE =
  'The multiples are on a different earnings basis than the earnings entered. Enter earnings in the same basis, or enter the owner compensation add-back (SDE − EBITDA) so the value can be bridged.';

export const BIGGEST_LEVERS_COUNT = 5;

export interface ValueGapInput {
  earnings: number | null | undefined;
  earningsBasis: EarningsBasis;
  /** SDE − EBITDA. Positive number. Bridges an entry in one basis to multiples in the other. */
  ownerCompAddback?: number | null;
  lowMultiple: number | null | undefined;
  highMultiple: number | null | undefined;
  /** 0..1 — business readiness only; personal readiness never enters the formula. */
  businessReadinessPct: number;
  /** Business scorecard rows (used for per-factor attribution). */
  businessRows: FactorScoreRow[];
  source: MultipleSource;
}

function isPositiveNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/**
 * Per-factor gap attribution (Section 6b):
 *   points_lost_i    = (6 − rating_i) × weight_i
 *   share_i          = points_lost_i / Σ points_lost
 *   gap_attributed_i = value_gap × share_i
 *
 * This is an allocation of the estimated gap, not a prediction that fixing
 * one factor yields that exact dollar amount.
 */
export function attributeGap(
  rows: FactorScoreRow[],
  valueGap: number | null,
): { attribution: FactorAttribution[]; totalPointsLost: number } {
  const totalPointsLost = rows.reduce((s, r) => s + r.pointsLost, 0);
  const attribution = rows
    .map<FactorAttribution>((r) => {
      const share = totalPointsLost > 0 ? r.pointsLost / totalPointsLost : 0;
      return {
        factorId: r.factorId,
        label: r.label,
        rating: r.rating,
        weight: r.weight,
        pointsLost: r.pointsLost,
        share,
        gapAttributed: valueGap === null ? null : valueGap * share,
        note: r.note,
      };
    })
    .sort((a, b) => {
      if (b.pointsLost !== a.pointsLost) return b.pointsLost - a.pointsLost;
      return a.label.localeCompare(b.label);
    });
  return { attribution, totalPointsLost };
}

/**
 * Value Gap engine (Section 6a). Everything it returns is an ESTIMATE.
 *
 *   current_multiple    = low + (high − low) × business_readiness_pct
 *   best_in_class_mult  = high
 *   current_value       = earnings × current_multiple
 *   best_in_class_value = earnings × best_in_class_mult
 *   value_gap           = best_in_class_value − current_value
 */
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/**
 * Express the entered earnings in the multiples' basis.
 *   SDE    = EBITDA + owner compensation add-back
 *   EBITDA = SDE − owner compensation add-back
 * Returns null when the bases differ and no add-back is available.
 */
export function bridgeEarnings(
  earnings: number,
  from: EarningsBasis,
  to: EarningsBasis,
  ownerCompAddback: number | null | undefined,
): { value: number; derivation: string | null } | null {
  if (from === to) return { value: earnings, derivation: null };
  if (typeof ownerCompAddback !== 'number' || !Number.isFinite(ownerCompAddback)) return null;
  if (from === 'EBITDA' && to === 'SDE') {
    const value = earnings + ownerCompAddback;
    return {
      value,
      derivation: `${usd.format(earnings)} EBITDA + ${usd.format(ownerCompAddback)} owner comp = ${usd.format(value)} SDE`,
    };
  }
  const value = earnings - ownerCompAddback;
  return {
    value,
    derivation: `${usd.format(earnings)} SDE − ${usd.format(ownerCompAddback)} owner comp = ${usd.format(value)} EBITDA`,
  };
}

/**
 * Value Gap engine (Section 6a). Everything it returns is an ESTIMATE.
 *
 *   current_multiple    = low + (high − low) × business_readiness_pct
 *   best_in_class_mult  = high
 *   current_value       = earnings × current_multiple
 *   best_in_class_value = earnings × best_in_class_mult
 *   value_gap           = best_in_class_value − current_value
 *
 * `earnings` must be in the same basis as the multiples (`source.basis`).
 * When it is not, the owner compensation add-back bridges it; without one the
 * valuation is blocked with status `basis_mismatch` rather than silently
 * applying SDE multiples to EBITDA (which understates value).
 */
export function computeValueGap(input: ValueGapInput): ValueGapResult {
  const pct = Math.min(1, Math.max(0, input.businessReadinessPct || 0));
  const low = input.lowMultiple ?? null;
  const high = input.highMultiple ?? null;
  const earnings =
    typeof input.earnings === 'number' && Number.isFinite(input.earnings)
      ? input.earnings
      : null;
  const addback =
    typeof input.ownerCompAddback === 'number' && Number.isFinite(input.ownerCompAddback)
      ? input.ownerCompAddback
      : null;
  const multipleBasis = input.source.basis;

  const base = {
    earnings,
    earningsBasis: input.earningsBasis,
    ownerCompAddback: addback,
    lowMultiple: low,
    highMultiple: high,
    source: input.source,
  };

  const finish = (
    status: ValueGapResult['status'],
    message: string | null,
    multiples: { current: number | null; best: number | null; position: number | null },
    values: { current: number | null; best: number | null; gap: number | null },
    effective: { earnings: number | null; derivation: string | null },
  ): ValueGapResult => {
    const { attribution, totalPointsLost } = attributeGap(input.businessRows, values.gap);
    return {
      status,
      message,
      ...base,
      effectiveEarnings: effective.earnings,
      effectiveBasis: multipleBasis,
      earningsDerivation: effective.derivation,
      currentMultiple: multiples.current,
      bestInClassMultiple: multiples.best,
      rangePosition: multiples.position,
      currentValue: values.current,
      bestInClassValue: values.best,
      valueGap: values.gap,
      attribution,
      biggestLevers: attribution
        .filter((a) => a.pointsLost > 0)
        .slice(0, BIGGEST_LEVERS_COUNT),
      totalPointsLost,
    };
  };

  const noMultiples = { current: null, best: null, position: null };
  const noValues = { current: null, best: null, gap: null };
  const noEffective = { earnings: null, derivation: null };

  if (low === null || high === null) {
    return finish('no_multiples', NO_MULTIPLES_MESSAGE, noMultiples, noValues, noEffective);
  }
  if (!isPositiveNumber(low) || !isPositiveNumber(high) || high < low) {
    return finish('invalid_multiples', INVALID_MULTIPLES_MESSAGE, noMultiples, noValues, noEffective);
  }

  const currentMultiple = low + (high - low) * pct;
  const multiples = { current: currentMultiple, best: high, position: pct };

  if (earnings === null || earnings <= 0) {
    // Show the readiness scores and the multiple range, but no dollar value.
    return finish('no_earnings', NO_EARNINGS_MESSAGE, multiples, noValues, noEffective);
  }

  const bridged = bridgeEarnings(earnings, input.earningsBasis, multipleBasis, addback);
  if (!bridged) {
    return finish('basis_mismatch', BASIS_MISMATCH_MESSAGE, multiples, noValues, noEffective);
  }
  if (bridged.value <= 0) {
    return finish('no_earnings', NO_EARNINGS_MESSAGE, multiples, noValues, {
      earnings: bridged.value,
      derivation: bridged.derivation,
    });
  }

  const currentValue = bridged.value * currentMultiple;
  const bestInClassValue = bridged.value * high;
  return finish(
    'ok',
    null,
    multiples,
    { current: currentValue, best: bestInClassValue, gap: bestInClassValue - currentValue },
    { earnings: bridged.value, derivation: bridged.derivation },
  );
}
