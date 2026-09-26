import { describe, expect, it } from 'vitest';
import {
  BASIS_MISMATCH_MESSAGE,
  INVALID_MULTIPLES_MESSAGE,
  bridgeEarnings,
  buildNarrative,
  rangeKindCaveat,
  topOfRangeLabel,
  NO_EARNINGS_MESSAGE,
  NO_MULTIPLES_MESSAGE,
  buildAssessmentResult,
  computeValueGap,
  roundDisplayValue,
  scoreScorecard,
  type AssessmentInput,
  type MultipleSource,
} from '@/engine';
import { bands, businessFactors, factors, rateAll, ratingKey, scorecards } from '../fixtures/seed';

const source: MultipleSource = {
  kind: 'sector',
  sectorName: 'Test Sector',
  basis: 'EBITDA',
  rangeKind: 'quartile_range',
  medianMultiple: null,
  sourceNote: 'test',
  sourceUrl: null,
  methodNote: null,
  lastReviewed: '2026-01-01',
  overrideNote: null,
};
const sdeSource: MultipleSource = { ...source, basis: 'SDE', rangeKind: 'median_range', medianMultiple: 3.04 };

function businessRows(ratings: { factorId: string; rating: number | null }[]) {
  return scoreScorecard({ key: 'business', name: 'B', factors, ratings, bands }).rows;
}

describe('value gap engine', () => {
  it('low 3.0×, high 6.0×, EBITDA $500,000, business pct 50% → 4.5×, $2.25M, $3.0M, gap $750k', () => {
    // 50% exactly: rate 11 factors 6 and 11 factors 0? Ratings are 1–6, so use a
    // mix that sums to 66/132: eleven 5s and eleven 1s.
    const ratings = businessFactors.map((f, i) => ({ factorId: f.id, rating: i < 11 ? 5 : 1 }));
    const rows = businessRows(ratings);
    const pct = rows.reduce((s, r) => s + r.weightedRating, 0) / 132;
    expect(pct).toBe(0.5);

    const r = computeValueGap({
      earnings: 500_000,
      earningsBasis: 'EBITDA',
      lowMultiple: 3,
      highMultiple: 6,
      businessReadinessPct: pct,
      businessRows: rows,
      source,
    });
    expect(r.status).toBe('ok');
    expect(r.currentMultiple).toBeCloseTo(4.5, 10);
    expect(r.bestInClassMultiple).toBe(6);
    expect(r.currentValue).toBeCloseTo(2_250_000, 6);
    expect(r.bestInClassValue).toBeCloseTo(3_000_000, 6);
    expect(r.valueGap).toBeCloseTo(750_000, 6);
    expect(r.rangePosition).toBe(0.5);
  });

  it('per-factor attributed gaps sum to the total gap', () => {
    const ratings = businessFactors.map((f, i) => ({ factorId: f.id, rating: ((i * 7) % 6) + 1 }));
    const rows = businessRows(ratings);
    const pct = rows.reduce((s, r) => s + r.weightedRating, 0) / 132;
    const r = computeValueGap({
      earnings: 1_234_567,
      earningsBasis: 'SDE',
      lowMultiple: 2.5,
      highMultiple: 4.25,
      businessReadinessPct: pct,
      businessRows: rows,
      source: sdeSource,
    });
    const sum = r.attribution.reduce((s, a) => s + (a.gapAttributed ?? 0), 0);
    expect(sum).toBeCloseTo(r.valueGap!, 6);
    const shareSum = r.attribution.reduce((s, a) => s + a.share, 0);
    expect(shareSum).toBeCloseTo(1, 10);
    // Attribution is proportional to points lost: rating 1 loses 5 points, rating 6 loses 0.
    const worst = r.attribution[0]!;
    expect(worst.rating).toBe(1);
    expect(worst.pointsLost).toBe(5);
    expect(r.attribution.at(-1)!.rating).toBe(6);
    expect(r.attribution.at(-1)!.gapAttributed).toBe(0);
  });

  it('biggest levers are the top 5 by attributed gap and exclude factors with nothing lost', () => {
    const ratings = businessFactors.map((f, i) => ({ factorId: f.id, rating: i < 3 ? 2 : 6 }));
    const r = computeValueGap({
      earnings: 400_000,
      earningsBasis: 'EBITDA',
      lowMultiple: 3,
      highMultiple: 5,
      businessReadinessPct: 0.9,
      businessRows: businessRows(ratings),
      source,
    });
    expect(r.biggestLevers).toHaveLength(3);
    expect(r.biggestLevers.every((l) => l.pointsLost > 0)).toBe(true);
  });

  it('earnings = 0 → no dollar values, message displayed, multiples still shown', () => {
    const r = computeValueGap({
      earnings: 0,
      earningsBasis: 'EBITDA',
      lowMultiple: 3,
      highMultiple: 6,
      businessReadinessPct: 0.5,
      businessRows: businessRows(rateAll(businessFactors, 3)),
      source,
    });
    expect(r.status).toBe('no_earnings');
    expect(r.message).toBe(NO_EARNINGS_MESSAGE);
    expect(r.currentValue).toBeNull();
    expect(r.bestInClassValue).toBeNull();
    expect(r.valueGap).toBeNull();
    expect(r.currentMultiple).toBeCloseTo(4.5, 10);
    expect(r.attribution.every((a) => a.gapAttributed === null)).toBe(true);
    expect(r.attribution.every((a) => a.pointsLost === 3)).toBe(true);
  });

  it('negative and null earnings are treated the same as zero', () => {
    for (const earnings of [-50_000, null, undefined, Number.NaN]) {
      const r = computeValueGap({
        earnings,
        earningsBasis: 'EBITDA',
        lowMultiple: 3,
        highMultiple: 6,
        businessReadinessPct: 0.5,
        businessRows: [],
        source,
      });
      expect(r.status).toBe('no_earnings');
      expect(r.valueGap).toBeNull();
    }
  });

  it('missing multiples block the valuation and prompt for an override', () => {
    const r = computeValueGap({
      earnings: 500_000,
      earningsBasis: 'EBITDA',
      lowMultiple: null,
      highMultiple: null,
      businessReadinessPct: 0.5,
      businessRows: [],
      source,
    });
    expect(r.status).toBe('no_multiples');
    expect(r.message).toBe(NO_MULTIPLES_MESSAGE);
    expect(r.currentMultiple).toBeNull();
    expect(r.valueGap).toBeNull();
  });

  it('rejects inverted or non-positive multiples', () => {
    const bad = [
      [6, 3],
      [0, 5],
      [-1, 5],
    ] as const;
    for (const [low, high] of bad) {
      const r = computeValueGap({
        earnings: 500_000,
        earningsBasis: 'EBITDA',
        lowMultiple: low,
        highMultiple: high,
        businessReadinessPct: 0.5,
        businessRows: [],
        source,
      });
      expect(r.status).toBe('invalid_multiples');
      expect(r.message).toBe(INVALID_MULTIPLES_MESSAGE);
    }
  });

  it('a perfect scorecard has zero gap and zero attribution shares', () => {
    const r = computeValueGap({
      earnings: 500_000,
      earningsBasis: 'EBITDA',
      lowMultiple: 3,
      highMultiple: 6,
      businessReadinessPct: 1,
      businessRows: businessRows(rateAll(businessFactors, 6)),
      source,
    });
    expect(r.valueGap).toBeCloseTo(0, 6);
    expect(r.totalPointsLost).toBe(0);
    expect(r.biggestLevers).toHaveLength(0);
    expect(r.attribution.every((a) => a.share === 0)).toBe(true);
  });
});


describe('earnings basis guard', () => {
  const rows = businessRows(rateAll(businessFactors, 3));

  it('blocks the valuation when EBITDA is entered against SDE multiples and no add-back is given', () => {
    const r = computeValueGap({
      earnings: 400_000,
      earningsBasis: 'EBITDA',
      lowMultiple: 2.59,
      highMultiple: 4.24,
      businessReadinessPct: 0.5,
      businessRows: rows,
      source: sdeSource,
    });
    expect(r.status).toBe('basis_mismatch');
    expect(r.message).toBe(BASIS_MISMATCH_MESSAGE);
    expect(r.currentValue).toBeNull();
    expect(r.valueGap).toBeNull();
    // Multiples are still shown so the advisor sees the range.
    expect(r.currentMultiple).toBeCloseTo(3.415, 6);
    expect(r.effectiveBasis).toBe('SDE');
  });

  it('bridges EBITDA to SDE with the owner compensation add-back and explains the derivation', () => {
    const r = computeValueGap({
      earnings: 400_000,
      earningsBasis: 'EBITDA',
      ownerCompAddback: 150_000,
      lowMultiple: 2.59,
      highMultiple: 4.24,
      businessReadinessPct: 0.5,
      businessRows: rows,
      source: sdeSource,
    });
    expect(r.status).toBe('ok');
    expect(r.effectiveEarnings).toBe(550_000);
    expect(r.earningsDerivation).toBe('$400,000 EBITDA + $150,000 owner comp = $550,000 SDE');
    expect(r.currentValue).toBeCloseTo(550_000 * 3.415, 6);
  });

  it('bridges SDE to EBITDA the other way, and blocks if the result is not positive', () => {
    const ok = bridgeEarnings(550_000, 'SDE', 'EBITDA', 150_000);
    expect(ok?.value).toBe(400_000);
    expect(ok?.derivation).toContain('= $400,000 EBITDA');
    const r = computeValueGap({
      earnings: 100_000,
      earningsBasis: 'SDE',
      ownerCompAddback: 150_000,
      lowMultiple: 3,
      highMultiple: 6,
      businessReadinessPct: 0.5,
      businessRows: rows,
      source,
    });
    expect(r.status).toBe('no_earnings');
    expect(r.valueGap).toBeNull();
  });

  it('matching bases need no add-back and ignore one if present', () => {
    const r = computeValueGap({
      earnings: 300_000,
      earningsBasis: 'SDE',
      ownerCompAddback: 999_999,
      lowMultiple: 2.59,
      highMultiple: 4.24,
      businessReadinessPct: 0.5,
      businessRows: rows,
      source: sdeSource,
    });
    expect(r.status).toBe('ok');
    expect(r.effectiveEarnings).toBe(300_000);
    expect(r.earningsDerivation).toBeNull();
  });

  it('worked case: Manufacturing 2.59×–4.24× SDE, SDE $300,000, 50% → 3.415×, $1,024,500, $1,272,000, gap $247,500', () => {
    const ratings = businessFactors.map((f, i) => ({ factorId: f.id, rating: i < 11 ? 5 : 1 }));
    const r = computeValueGap({
      earnings: 300_000,
      earningsBasis: 'SDE',
      lowMultiple: 2.59,
      highMultiple: 4.24,
      businessReadinessPct: 0.5,
      businessRows: businessRows(ratings),
      source: sdeSource,
    });
    expect(r.currentMultiple).toBeCloseTo(3.415, 10);
    expect(r.currentValue).toBeCloseTo(1_024_500, 6);
    expect(r.bestInClassValue).toBeCloseTo(1_272_000, 6);
    expect(r.valueGap).toBeCloseTo(247_500, 6);
  });
});

describe('range kind labels', () => {
  it('names the top of a median range honestly', () => {
    expect(topOfRangeLabel('median_range')).toBe('Top of sector range');
    expect(topOfRangeLabel('quartile_range')).toBe('Best-in-class');
    expect(rangeKindCaveat('median_range')).toMatch(/medians/);
    expect(rangeKindCaveat('quartile_range')).toBeNull();
  });

  it('the narrative avoids "best-in-class" for a median range and states the derivation', () => {
    const res = buildAssessmentResult({
      assessment: {
        assessedAt: '2026-09-01',
        status: 'draft',
        revenueTtm: null,
        earnings: 400_000,
        earningsBasis: 'EBITDA',
        ownerCompAddback: 150_000,
        ownerValueEstimate: null,
        overrideLowMultiple: null,
        overrideHighMultiple: null,
        overrideNote: null,
      },
      sector: { id: 's', name: 'Manufacturing', lowMultiple: 2.59, highMultiple: 4.24, medianMultiple: 3.04, basis: 'SDE', rangeKind: 'median_range', sourceNote: 'BizBuySell', lastReviewed: '2026-09-26' },
      scorecards,
      factors,
      ratings: rateAll(businessFactors, 4),
      bands,
      ratingKey,
    });
    const text = buildNarrative(res, 'Acme').paragraphs.join(' ');
    expect(text).toContain('$400,000 EBITDA + $150,000 owner comp = $550,000 SDE');
    expect(text).toContain('top of the sector range');
    expect(text).not.toMatch(/best-in-class company/i);
    expect(text).toContain('sub-industry medians');
  });
});

describe('display rounding', () => {
  it('rounds to nearest $1,000 below $1M and nearest $10,000 at or above $1M', () => {
    expect(roundDisplayValue(2_250_000)).toBe(2_250_000);
    expect(roundDisplayValue(2_254_999)).toBe(2_250_000);
    expect(roundDisplayValue(2_255_000)).toBe(2_260_000);
    expect(roundDisplayValue(750_000)).toBe(750_000);
    expect(roundDisplayValue(750_499)).toBe(750_000);
    expect(roundDisplayValue(750_500)).toBe(751_000);
    expect(roundDisplayValue(999_600)).toBe(1_000_000);
    expect(roundDisplayValue(-12_345)).toBe(-12_000);
    expect(roundDisplayValue(Number.NaN)).toBe(0);
  });
});

describe('buildAssessmentResult', () => {
  const assessment: AssessmentInput = {
    assessedAt: '2026-09-01',
    status: 'draft',
    revenueTtm: 3_000_000,
    earnings: 500_000,
    earningsBasis: 'EBITDA',
    ownerValueEstimate: null,
    overrideLowMultiple: null,
    overrideHighMultiple: null,
    overrideNote: null,
  };
  const sector = {
    id: 's1',
    name: 'Professional Services',
    lowMultiple: 3,
    highMultiple: 6,
    basis: 'EBITDA' as const,
    sourceNote: 'Advisor experience',
    lastReviewed: '2026-06-01',
  };

  it('uses the sector table by default and surfaces its source note', () => {
    const res = buildAssessmentResult({
      assessment,
      sector,
      scorecards,
      factors,
      ratings: businessFactors.map((f, i) => ({ factorId: f.id, rating: i < 11 ? 5 : 1 })),
      bands,
      ratingKey,
    });
    expect(res.business.readinessPctPoints).toBe(50);
    expect(res.valueGap.source.kind).toBe('sector');
    expect(res.valueGap.source.sourceNote).toBe('Advisor experience');
    expect(res.valueGap.valueGap).toBeCloseTo(750_000, 6);
    expect(res.personal.ratedCount).toBe(0);
  });

  it('an assessment override wins over the sector table', () => {
    const res = buildAssessmentResult({
      assessment: {
        ...assessment,
        overrideLowMultiple: 4,
        overrideHighMultiple: 8,
        overrideNote: 'Recurring-revenue premium per recent comps',
      },
      sector,
      scorecards,
      factors,
      ratings: rateAll(businessFactors, 6),
      bands,
      ratingKey,
    });
    expect(res.valueGap.source.kind).toBe('override');
    expect(res.valueGap.source.basis).toBe('EBITDA');
    expect(res.valueGap.source.rangeKind).toBe('quartile_range');
    expect(res.valueGap.source.overrideNote).toMatch(/premium/);
    expect(res.valueGap.bestInClassValue).toBeCloseTo(4_000_000, 6);
    expect(res.valueGap.valueGap).toBeCloseTo(0, 6);
  });

  it('an override can carry its own basis, which then governs the mismatch check', () => {
    const res = buildAssessmentResult({
      assessment: { ...assessment, earningsBasis: 'EBITDA', overrideLowMultiple: 2, overrideHighMultiple: 3, overrideBasis: 'SDE', overrideNote: 'SDE comps' },
      sector,
      scorecards,
      factors,
      ratings: rateAll(businessFactors, 4),
      bands,
      ratingKey,
    });
    expect(res.valueGap.source.basis).toBe('SDE');
    expect(res.valueGap.status).toBe('basis_mismatch');
  });

  it('personal readiness never changes the valuation', () => {
    const base = buildAssessmentResult({
      assessment,
      sector,
      scorecards,
      factors,
      ratings: rateAll(businessFactors, 4),
      bands,
      ratingKey,
    });
    const withPersonal = buildAssessmentResult({
      assessment,
      sector,
      scorecards,
      factors,
      ratings: [...rateAll(businessFactors, 4), ...rateAll(factors.filter((f) => f.scorecardKey === 'personal'), 1)],
      bands,
      ratingKey,
    });
    expect(withPersonal.valueGap.currentValue).toBe(base.valueGap.currentValue);
    expect(withPersonal.personal.readinessPctPoints).toBe(17);
  });

  it('a sector with blank multiples blocks the valuation panel', () => {
    const res = buildAssessmentResult({
      assessment,
      sector: { ...sector, lowMultiple: null, highMultiple: null },
      scorecards,
      factors,
      ratings: rateAll(businessFactors, 4),
      bands,
      ratingKey,
    });
    expect(res.valueGap.status).toBe('no_multiples');
  });
});
