import type { RangeKind } from './types';

/**
 * The top of a sector range is only "best-in-class" when the high multiple is
 * a top-quartile figure. When the range spans sub-industry medians (the
 * BizBuySell-derived seed), calling its top "best-in-class" overstates it.
 */
export function topOfRangeLabel(rangeKind: RangeKind): string {
  return rangeKind === 'quartile_range' ? 'Best-in-class' : 'Top of sector range';
}

export function topOfRangeNoun(rangeKind: RangeKind): string {
  return rangeKind === 'quartile_range'
    ? 'a best-in-class company in the same sector'
    : 'a company at the top of the sector range';
}

export function rangeKindCaveat(rangeKind: RangeKind): string | null {
  return rangeKind === 'median_range'
    ? 'Range spans sub-industry medians, not top-quartile transactions.'
    : null;
}
