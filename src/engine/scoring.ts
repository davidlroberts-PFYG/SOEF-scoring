import type {
  BandDef,
  CombinedResult,
  FactorDef,
  FactorRatingInput,
  FactorScoreRow,
  ScorecardKey,
  ScorecardResult,
} from './types';

export const MIN_RATING = 1;
export const MAX_RATING = 6;

export function isValidRating(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_RATING &&
    value <= MAX_RATING
  );
}

/** Whole-percent points from a 0..1 ratio (67 for 0.6667). */
export function toPctPoints(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.round(Math.min(1, Math.max(0, pct)) * 100);
}

/**
 * Look up the Common Sense Rating band for a whole-percent score. Bands are
 * inclusive whole-percent ranges (0–17, 18–33, …), so the score is rounded to
 * the nearest whole percent first — 88/132 = 66.67% → 67% → band 4.
 */
export function bandForPct(pct: number, bands: BandDef[]): BandDef | null {
  const points = toPctPoints(pct);
  return bands.find((b) => points >= b.minPct && points <= b.maxPct) ?? null;
}

function buildRows(
  factors: FactorDef[],
  ratings: FactorRatingInput[],
  maxPerFactor: number,
): FactorScoreRow[] {
  const byFactor = new Map(ratings.map((r) => [r.factorId, r]));
  return [...factors]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((f) => {
      const r = byFactor.get(f.id);
      const rating = r && isValidRating(r.rating) ? r.rating : null;
      const weight = Number.isFinite(f.weight) && f.weight > 0 ? f.weight : 0;
      return {
        factorId: f.id,
        scorecardKey: f.scorecardKey,
        sortOrder: f.sortOrder,
        label: f.label,
        hint: f.hint,
        weight,
        rating,
        note: r?.note ?? null,
        weightedRating: rating === null ? 0 : rating * weight,
        weightedMax: maxPerFactor * weight,
        pointsLost: rating === null ? 0 : (maxPerFactor - rating) * weight,
      };
    });
}

export interface ScoreScorecardInput {
  key: ScorecardKey;
  name: string;
  maxPerFactor?: number;
  factors: FactorDef[];
  ratings: FactorRatingInput[];
  bands: BandDef[];
}

/**
 * total_rating  = Σ rating_i × weight_i
 * max_rating    = Σ 6 × weight_i          (132 and 66 at default weights)
 * readiness_pct = total_rating / max_rating
 *
 * Unrated factors contribute 0 to the total but still count toward the
 * maximum, so a partially completed scorecard shows a running percentage
 * against the full worksheet, exactly as the paper version would.
 */
export function scoreScorecard(input: ScoreScorecardInput): ScorecardResult {
  const maxPerFactor = input.maxPerFactor ?? MAX_RATING;
  const factors = input.factors.filter((f) => f.scorecardKey === input.key);
  const rows = buildRows(factors, input.ratings, maxPerFactor);
  const totalRating = rows.reduce((s, r) => s + r.weightedRating, 0);
  const maxRating = rows.reduce((s, r) => s + r.weightedMax, 0);
  const readinessPct = maxRating > 0 ? totalRating / maxRating : 0;
  const ratedCount = rows.filter((r) => r.rating !== null).length;
  return {
    key: input.key,
    name: input.name,
    maxPerFactor,
    rows,
    factorCount: rows.length,
    ratedCount,
    complete: rows.length > 0 && ratedCount === rows.length,
    totalRating,
    maxRating,
    readinessPct,
    readinessPctPoints: toPctPoints(readinessPct),
    band: bandForPct(readinessPct, input.bands),
  };
}

/**
 * Combined Readiness = (business_total + personal_total) / (business_max + personal_max).
 * Shown alongside — never instead of — the two component scores.
 */
export function combineScorecards(
  business: ScorecardResult,
  personal: ScorecardResult,
  bands: BandDef[],
): CombinedResult {
  const totalRating = business.totalRating + personal.totalRating;
  const maxRating = business.maxRating + personal.maxRating;
  const readinessPct = maxRating > 0 ? totalRating / maxRating : 0;
  return {
    totalRating,
    maxRating,
    readinessPct,
    readinessPctPoints: toPctPoints(readinessPct),
    band: bandForPct(readinessPct, bands),
  };
}
