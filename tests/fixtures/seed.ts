import scorecardsJson from '@content/seed/scorecards.json';
import bandsJson from '@content/seed/bands.json';
import ratingKeyJson from '@content/seed/rating-key.json';
import type { BandDef, FactorDef, FactorRatingInput, RatingKeyEntry } from '@/engine';

export const bands = bandsJson as BandDef[];
export const ratingKey = ratingKeyJson as RatingKeyEntry[];

export const scorecards = scorecardsJson.scorecards.map((s) => ({
  key: s.key as 'business' | 'personal',
  name: s.name,
  maxPerFactor: s.maxPerFactor,
}));

/** Deterministic factor ids so tests can reference them: business-1 … personal-11. */
export const factors: FactorDef[] = scorecardsJson.scorecards.flatMap((s) =>
  s.factors.map((f) => ({
    id: `${s.key}-${f.sortOrder}`,
    scorecardKey: s.key as 'business' | 'personal',
    sortOrder: f.sortOrder,
    label: f.label,
    hint: f.hint,
    weight: 1,
  })),
);

export const businessFactors = factors.filter((f) => f.scorecardKey === 'business');
export const personalFactors = factors.filter((f) => f.scorecardKey === 'personal');

export function rateAll(list: FactorDef[], rating: number): FactorRatingInput[] {
  return list.map((f) => ({ factorId: f.id, rating }));
}
