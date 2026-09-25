import { describe, expect, it } from 'vitest';
import { bandForPct, combineScorecards, scoreScorecard, toPctPoints } from '@/engine';
import { bands, businessFactors, factors, personalFactors, rateAll } from '../fixtures/seed';

describe('scoring — worksheet parity', () => {
  it('has 22 business factors (max 132) and 11 personal factors (max 66)', () => {
    expect(businessFactors).toHaveLength(22);
    expect(personalFactors).toHaveLength(11);
  });

  it('rating every business factor 4 → 88/132 → 67% → Slightly Above Average', () => {
    const r = scoreScorecard({
      key: 'business',
      name: 'Business Readiness',
      factors,
      ratings: rateAll(businessFactors, 4),
      bands,
    });
    expect(r.totalRating).toBe(88);
    expect(r.maxRating).toBe(132);
    expect(r.readinessPctPoints).toBe(67);
    expect(r.band?.label).toBe('Slightly Above Average');
    expect(r.complete).toBe(true);
  });

  it('rating every personal factor 3 → 33/66 → 50% → Slightly Below Average', () => {
    const r = scoreScorecard({
      key: 'personal',
      name: 'Personal Readiness',
      factors,
      ratings: rateAll(personalFactors, 3),
      bands,
    });
    expect(r.totalRating).toBe(33);
    expect(r.maxRating).toBe(66);
    expect(r.readinessPctPoints).toBe(50);
    expect(r.band?.label).toBe('Slightly Below Average');
  });

  it('ignores ratings that belong to the other scorecard and invalid values', () => {
    const r = scoreScorecard({
      key: 'business',
      name: 'Business Readiness',
      factors,
      ratings: [
        ...rateAll(personalFactors, 6),
        { factorId: 'business-1', rating: 7 },
        { factorId: 'business-2', rating: 0 },
        { factorId: 'business-3', rating: 2.5 },
        { factorId: 'business-4', rating: 5 },
      ],
      bands,
    });
    expect(r.totalRating).toBe(5);
    expect(r.ratedCount).toBe(1);
    expect(r.complete).toBe(false);
  });

  it('unrated factors count as 0 toward the total but still count toward the max', () => {
    const r = scoreScorecard({
      key: 'business',
      name: 'Business Readiness',
      factors,
      ratings: rateAll(businessFactors.slice(0, 11), 6),
      bands,
    });
    expect(r.totalRating).toBe(66);
    expect(r.maxRating).toBe(132);
    expect(r.readinessPctPoints).toBe(50);
  });

  it('applies per-factor weights to both the total and the maximum', () => {
    const weighted = businessFactors.map((f) =>
      f.label === 'Financials' ? { ...f, weight: 2 } : f,
    );
    const r = scoreScorecard({
      key: 'business',
      name: 'Business Readiness',
      factors: weighted,
      ratings: rateAll(businessFactors, 4),
      bands,
    });
    expect(r.maxRating).toBe(138);
    expect(r.totalRating).toBe(92);
  });
});

describe('bands', () => {
  it('tile 0–100 with no gaps or overlaps', () => {
    const sorted = [...bands].sort((a, b) => a.minPct - b.minPct);
    expect(sorted[0]!.minPct).toBe(0);
    expect(sorted[sorted.length - 1]!.maxPct).toBe(100);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.minPct).toBe(sorted[i - 1]!.maxPct + 1);
    }
  });

  it.each([
    [0, 'Poor or Non-Existent'],
    [0.17, 'Poor or Non-Existent'],
    [0.18, 'Needs Improvement'],
    [0.33, 'Needs Improvement'],
    [0.34, 'Slightly Below Average'],
    [0.5, 'Slightly Below Average'],
    [0.51, 'Slightly Above Average'],
    [0.67, 'Slightly Above Average'],
    [0.68, 'Best-in-Class'],
    [0.83, 'Best-in-Class'],
    [0.84, 'Industry Leader ("The Standard")'],
    [1, 'Industry Leader ("The Standard")'],
  ])('%s → %s', (pct, label) => {
    expect(bandForPct(pct, bands)?.label).toBe(label);
  });

  it('rounds to the nearest whole percent before banding (88/132 → 67)', () => {
    expect(toPctPoints(88 / 132)).toBe(67);
    expect(toPctPoints(1.2)).toBe(100);
    expect(toPctPoints(-0.1)).toBe(0);
  });
});

describe('combined readiness', () => {
  it('is (business_total + personal_total) / (business_max + personal_max)', () => {
    const b = scoreScorecard({
      key: 'business',
      name: 'B',
      factors,
      ratings: rateAll(businessFactors, 4),
      bands,
    });
    const p = scoreScorecard({
      key: 'personal',
      name: 'P',
      factors,
      ratings: rateAll(personalFactors, 3),
      bands,
    });
    const c = combineScorecards(b, p, bands);
    expect(c.totalRating).toBe(121);
    expect(c.maxRating).toBe(198);
    expect(c.readinessPctPoints).toBe(61);
    expect(c.band?.label).toBe('Slightly Above Average');
  });
});
