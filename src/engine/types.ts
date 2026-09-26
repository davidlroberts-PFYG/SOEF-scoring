/**
 * Engine types. The engine is pure: it takes plain data in and returns plain
 * data out. Nothing here knows about React, Next, or the database.
 */

export type ScorecardKey = 'business' | 'personal';
export type EarningsBasis = 'EBITDA' | 'SDE';

export interface FactorDef {
  id: string;
  scorecardKey: ScorecardKey;
  sortOrder: number;
  label: string;
  hint: string | null;
  /** Relative weight; 1.0 by default so totals match the paper worksheets. */
  weight: number;
}

export interface FactorRatingInput {
  factorId: string;
  /** 1–6, or null when not yet rated. */
  rating: number | null;
  note?: string | null;
}

export interface BandDef {
  band: number;
  label: string;
  /** Inclusive whole-percent bounds, e.g. 51–67. */
  minPct: number;
  maxPct: number;
}

export interface RatingKeyEntry {
  value: number;
  label: string;
  description: string | null;
}

export interface FactorScoreRow {
  factorId: string;
  scorecardKey: ScorecardKey;
  sortOrder: number;
  label: string;
  hint: string | null;
  weight: number;
  rating: number | null;
  note: string | null;
  /** rating × weight; 0 when unrated. */
  weightedRating: number;
  /** 6 × weight. */
  weightedMax: number;
  /** (6 − rating) × weight; 0 when unrated (unrated is excluded from attribution). */
  pointsLost: number;
}

export interface ScorecardResult {
  key: ScorecardKey;
  name: string;
  maxPerFactor: number;
  rows: FactorScoreRow[];
  factorCount: number;
  ratedCount: number;
  complete: boolean;
  totalRating: number;
  maxRating: number;
  /** 0..1 */
  readinessPct: number;
  /** Whole percent, e.g. 67. */
  readinessPctPoints: number;
  band: BandDef | null;
}

export interface CombinedResult {
  totalRating: number;
  maxRating: number;
  readinessPct: number;
  readinessPctPoints: number;
  band: BandDef | null;
}

export type ValuationStatus =
  | 'ok'
  | 'no_earnings'
  | 'no_multiples'
  | 'invalid_multiples'
  | 'basis_mismatch';

/**
 * Whether the high multiple is a top-quartile figure ('quartile_range') or
 * only the top of a range of medians ('median_range'). Drives the label used
 * for the top of the range: "Best-in-class" vs "Top of sector range".
 */
export type RangeKind = 'median_range' | 'quartile_range';

export interface MultipleSource {
  kind: 'sector' | 'override';
  sectorName: string | null;
  /** Basis the multiples are expressed in. Must match the earnings they are applied to. */
  basis: EarningsBasis;
  rangeKind: RangeKind;
  medianMultiple: number | null;
  sourceNote: string | null;
  sourceUrl: string | null;
  methodNote: string | null;
  lastReviewed: string | null;
  overrideNote: string | null;
}

export interface FactorAttribution {
  factorId: string;
  label: string;
  rating: number | null;
  weight: number;
  pointsLost: number;
  /** 0..1 share of total points lost. */
  share: number;
  /** Unrounded dollars, or null when no valuation is available. */
  gapAttributed: number | null;
  note: string | null;
}

export interface ValueGapResult {
  status: ValuationStatus;
  message: string | null;
  /** Earnings as entered on the assessment, in `earningsBasis`. */
  earnings: number | null;
  earningsBasis: EarningsBasis;
  /** Owner compensation add-back (SDE − EBITDA) used to bridge bases, if any. */
  ownerCompAddback: number | null;
  /** Earnings actually multiplied, expressed in the multiples' basis. */
  effectiveEarnings: number | null;
  effectiveBasis: EarningsBasis;
  /** Plain-English derivation when the basis was bridged, e.g. "$400,000 EBITDA + $150,000 owner comp = $550,000 SDE". */
  earningsDerivation: string | null;
  lowMultiple: number | null;
  highMultiple: number | null;
  /** Interpolated multiple at the business readiness percentage. */
  currentMultiple: number | null;
  bestInClassMultiple: number | null;
  /** Unrounded dollars. */
  currentValue: number | null;
  bestInClassValue: number | null;
  valueGap: number | null;
  /** Position of the current multiple inside the range, 0..1. */
  rangePosition: number | null;
  source: MultipleSource;
  attribution: FactorAttribution[];
  biggestLevers: FactorAttribution[];
  totalPointsLost: number;
}
