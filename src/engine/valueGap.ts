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

export const BIGGEST_LEVERS_COUNT = 5;

export interface ValueGapInput {
  earnings: number | null | undefined;
  earningsBasis: EarningsBasis;
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
export function computeValueGap(input: ValueGapInput): ValueGapResult {
  const pct = Math.min(1, Math.max(0, input.businessReadinessPct || 0));
  const low = input.lowMultiple ?? null;
  const high = input.highMultiple ?? null;
  const earnings =
    typeof input.earnings === 'number' && Number.isFinite(input.earnings)
      ? input.earnings
      : null;

  const base = {
    earnings,
    earningsBasis: input.earningsBasis,
    lowMultiple: low,
    highMultiple: high,
    source: input.source,
  };

  const finish = (
    status: ValueGapResult['status'],
    message: string | null,
    multiples: { current: number | null; best: number | null; position: number | null },
    values: { current: number | null; best: number | null; gap: number | null },
  ): ValueGapResult => {
    const { attribution, totalPointsLost } = attributeGap(input.businessRows, values.gap);
    return {
      status,
      message,
      ...base,
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

  if (low === null || high === null) {
    return finish('no_multiples', NO_MULTIPLES_MESSAGE, noMultiples, noValues);
  }
  if (!isPositiveNumber(low) || !isPositiveNumber(high) || high < low) {
    return finish('invalid_multiples', INVALID_MULTIPLES_MESSAGE, noMultiples, noValues);
  }

  const currentMultiple = low + (high - low) * pct;
  const multiples = { current: currentMultiple, best: high, position: pct };

  if (earnings === null || earnings <= 0) {
    // Show the readiness scores and the multiple range, but no dollar value.
    return finish('no_earnings', NO_EARNINGS_MESSAGE, multiples, noValues);
  }

  const currentValue = earnings * currentMultiple;
  const bestInClassValue = earnings * high;
  return finish('ok', null, multiples, {
    current: currentValue,
    best: bestInClassValue,
    gap: bestInClassValue - currentValue,
  });
}
