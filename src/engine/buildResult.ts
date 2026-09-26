import { combineScorecards, scoreScorecard } from './scoring';
import { computeValueGap } from './valueGap';
import type {
  BandDef,
  CombinedResult,
  EarningsBasis,
  FactorDef,
  FactorRatingInput,
  MultipleSource,
  RangeKind,
  RatingKeyEntry,
  ScorecardResult,
  ValueGapResult,
} from './types';

export interface ScorecardMeta {
  key: 'business' | 'personal';
  name: string;
  maxPerFactor: number;
}

export interface SectorInput {
  id: string;
  name: string;
  lowMultiple: number | null;
  highMultiple: number | null;
  medianMultiple?: number | null;
  basis: EarningsBasis;
  rangeKind?: RangeKind;
  sourceNote: string | null;
  sourceUrl?: string | null;
  methodNote?: string | null;
  lastReviewed: string | null;
}

export interface AssessmentInput {
  assessedAt: string;
  status: 'draft' | 'released';
  revenueTtm: number | null;
  earnings: number | null;
  earningsBasis: EarningsBasis;
  /** SDE − EBITDA, used to bridge the entered basis to the multiples' basis. */
  ownerCompAddback?: number | null;
  ownerValueEstimate: number | null;
  overrideLowMultiple: number | null;
  overrideHighMultiple: number | null;
  /** Basis of the override multiples; null = same as `earningsBasis`. */
  overrideBasis?: EarningsBasis | null;
  overrideNote: string | null;
}

export interface BuildResultInput {
  assessment: AssessmentInput;
  sector: SectorInput | null;
  scorecards: ScorecardMeta[];
  factors: FactorDef[];
  ratings: FactorRatingInput[];
  bands: BandDef[];
  ratingKey: RatingKeyEntry[];
}

export interface AssessmentResult {
  /** Bumped when the shape of this object changes, so stored snapshots can be checked. */
  version: 1;
  computedAt: string;
  assessment: AssessmentInput;
  sector: SectorInput | null;
  business: ScorecardResult;
  personal: ScorecardResult;
  combined: CombinedResult;
  valueGap: ValueGapResult;
  bands: BandDef[];
  ratingKey: RatingKeyEntry[];
}

/** Which multiple range applies: an assessment-level override wins over the sector table. */
export function resolveMultiples(
  assessment: AssessmentInput,
  sector: SectorInput | null,
): { low: number | null; high: number | null; source: MultipleSource } {
  const hasOverride =
    assessment.overrideLowMultiple !== null && assessment.overrideHighMultiple !== null;
  if (hasOverride) {
    return {
      low: assessment.overrideLowMultiple,
      high: assessment.overrideHighMultiple,
      source: {
        kind: 'override',
        sectorName: sector?.name ?? null,
        basis: assessment.overrideBasis ?? assessment.earningsBasis,
        // An advisor-entered range is taken at face value as the best-in-class ceiling.
        rangeKind: 'quartile_range',
        medianMultiple: null,
        sourceNote: null,
        sourceUrl: null,
        methodNote: null,
        lastReviewed: null,
        overrideNote: assessment.overrideNote,
      },
    };
  }
  return {
    low: sector?.lowMultiple ?? null,
    high: sector?.highMultiple ?? null,
    source: {
      kind: 'sector',
      sectorName: sector?.name ?? null,
      basis: sector?.basis ?? assessment.earningsBasis,
      rangeKind: sector?.rangeKind ?? 'median_range',
      medianMultiple: sector?.medianMultiple ?? null,
      sourceNote: sector?.sourceNote ?? null,
      sourceUrl: sector?.sourceUrl ?? null,
      methodNote: sector?.methodNote ?? null,
      lastReviewed: sector?.lastReviewed ?? null,
      overrideNote: null,
    },
  };
}

/**
 * The single orchestrator. The dashboard, the PDF, and the release snapshot
 * all call this, so there is exactly one definition of what a result is.
 */
export function buildAssessmentResult(input: BuildResultInput, now = new Date()): AssessmentResult {
  const meta = (key: 'business' | 'personal'): ScorecardMeta =>
    input.scorecards.find((s) => s.key === key) ?? {
      key,
      name: key === 'business' ? 'Business Readiness' : 'Personal Readiness',
      maxPerFactor: 6,
    };

  const b = meta('business');
  const p = meta('personal');

  const business = scoreScorecard({
    key: 'business',
    name: b.name,
    maxPerFactor: b.maxPerFactor,
    factors: input.factors,
    ratings: input.ratings,
    bands: input.bands,
  });
  const personal = scoreScorecard({
    key: 'personal',
    name: p.name,
    maxPerFactor: p.maxPerFactor,
    factors: input.factors,
    ratings: input.ratings,
    bands: input.bands,
  });
  const combined = combineScorecards(business, personal, input.bands);

  const { low, high, source } = resolveMultiples(input.assessment, input.sector);
  const valueGap = computeValueGap({
    earnings: input.assessment.earnings,
    earningsBasis: input.assessment.earningsBasis,
    ownerCompAddback: input.assessment.ownerCompAddback ?? null,
    lowMultiple: low,
    highMultiple: high,
    businessReadinessPct: business.readinessPct,
    businessRows: business.rows,
    source,
  });

  return {
    version: 1,
    computedAt: now.toISOString(),
    assessment: input.assessment,
    sector: input.sector,
    business,
    personal,
    combined,
    valueGap,
    bands: input.bands,
    ratingKey: input.ratingKey,
  };
}
