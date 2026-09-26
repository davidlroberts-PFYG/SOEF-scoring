import type { AssessmentResult } from './buildResult';
import { roundDisplayValue } from './rounding';
import { rangeKindCaveat, topOfRangeNoun } from './labels';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const money = (v: number) => usd.format(roundDisplayValue(v));
const pct = (v: number) => `${Math.round(v * 100)}%`;

export interface Narrative {
  headline: string;
  paragraphs: string[];
  levers: string[];
  caveat: string;
}

/**
 * Deterministic "What this means" copy. No AI, no adjectives the numbers do
 * not support. Every dollar figure is framed as an estimate.
 */
export function buildNarrative(result: AssessmentResult, companyName: string): Narrative {
  const b = result.business;
  const p = result.personal;
  const vg = result.valueGap;
  const bandLabel = b.band?.label ?? 'unbanded';
  const basis = vg.effectiveBasis;
  const topNoun = topOfRangeNoun(vg.source.rangeKind);
  const kindCaveat = rangeKindCaveat(vg.source.rangeKind);

  const headline = `${companyName} scored ${pct(b.readinessPct)} on Business Readiness (${bandLabel}).`;
  const paragraphs: string[] = [];

  paragraphs.push(
    `Business Readiness came in at ${b.totalRating} of ${b.maxRating} points (${pct(b.readinessPct)}), which places the business in the "${bandLabel}" band. ` +
      (p.ratedCount > 0
        ? `Personal Readiness scored ${p.totalRating} of ${p.maxRating} (${pct(p.readinessPct)}, ${p.band?.label ?? 'unbanded'}). Personal readiness affects whether the owner can step away on their own terms; it does not change what a buyer pays, so it is shown beside the value gap rather than inside it.`
        : 'Personal Readiness has not been scored yet.'),
  );

  if (vg.status === 'ok' && vg.effectiveEarnings !== null && vg.currentValue !== null && vg.bestInClassValue !== null && vg.valueGap !== null) {
    paragraphs.push(
      (vg.earningsDerivation ? `${vg.earningsDerivation}. ` : '') +
        `At normalized ${basis} of ${money(vg.effectiveEarnings)}, the current readiness score corresponds to an estimated multiple of ${vg.currentMultiple?.toFixed(2)}× inside the sector's ${vg.lowMultiple}×–${vg.highMultiple}× ${basis} range. That puts the estimated value at roughly ${money(vg.currentValue)}. ` +
        `${topNoun.charAt(0).toUpperCase()}${topNoun.slice(1)} at the same ${basis} would be worth roughly ${money(vg.bestInClassValue)}. ` +
        `The estimated gap is ${money(vg.valueGap)}.` +
        (kindCaveat ? ` ${kindCaveat}` : ''),
    );
  } else if (vg.status === 'basis_mismatch') {
    paragraphs.push(
      `The sector range is ${vg.lowMultiple}×–${vg.highMultiple}× on an ${vg.effectiveBasis} basis, but earnings were entered as ${vg.earningsBasis}. A dollar estimate is not shown until earnings are entered in ${vg.effectiveBasis} or an owner compensation add-back is provided to bridge the two.`,
    );
  } else if (vg.status === 'no_earnings') {
    paragraphs.push(
      `The sector range is ${vg.lowMultiple}×–${vg.highMultiple}×, and the current score corresponds to about ${vg.currentMultiple?.toFixed(2)}×. A dollar estimate is not shown because normalized earnings are zero, negative, or not yet entered. Valuation requires positive normalized earnings.`,
    );
  } else {
    paragraphs.push(
      'A dollar estimate is not shown because no multiple range is available for this sector yet. Enter a sector range in Settings or a custom override on this assessment.',
    );
  }

  const levers = vg.biggestLevers.map((l) => {
    const dollars = l.gapAttributed !== null ? ` (about ${money(l.gapAttributed)} of the estimated gap)` : '';
    return `${l.label}: rated ${l.rating ?? '—'} of 6, ${l.pointsLost} point${l.pointsLost === 1 ? '' : 's'} lost${dollars}.`;
  });

  if (levers.length > 0) {
    paragraphs.push(
      `The ${levers.length === 1 ? 'factor' : `${levers.length} factors`} below account for the largest share of the points lost. The dollar figures are an allocation of the estimated gap in proportion to points lost, not a prediction that fixing one factor returns that exact amount.`,
    );
  }

  const caveat =
    'These figures are estimates built from rated factors and a general multiple range. They are not a business appraisal, valuation opinion, or offer to purchase.';

  return { headline, paragraphs, levers, caveat };
}
