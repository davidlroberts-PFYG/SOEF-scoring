import { eq, sql } from 'drizzle-orm';
import type { Db } from './client';
import { bands, factors, ratingKey, scorecards, sectors, settings } from './schema';
import scorecardsSeed from '../../content/seed/scorecards.json';
import ratingKeySeed from '../../content/seed/rating-key.json';
import bandsSeed from '../../content/seed/bands.json';
import sectorsSeed from '../../content/seed/sectors.json';
import settingsSeed from '../../content/seed/settings.json';

type SectorSeedRow = (typeof sectorsSeed.sectors)[number];

/** A sector row is "blank" when both multiples are null; only blank rows accept seed values. */
export function shouldFillSector(row: { lowMultiple: string | null; highMultiple: string | null }): boolean {
  return row.lowMultiple === null && row.highMultiple === null;
}

export function sectorSeedValues(s: SectorSeedRow) {
  const num = (v: number | null | undefined) => (v === null || v === undefined ? null : String(v));
  return {
    name: s.name,
    naicsPrefix: s.naicsPrefix ?? null,
    lowMultiple: num(s.lowMultiple),
    highMultiple: num(s.highMultiple),
    medianMultiple: num(s.medianMultiple),
    basis: (s.basis === 'SDE' ? 'SDE' : 'EBITDA') as 'EBITDA' | 'SDE',
    rangeKind: (s.rangeKind === 'quartile_range' ? 'quartile_range' : 'median_range') as 'median_range' | 'quartile_range',
    sourceNote: s.sourceNote ?? sectorsSeed.defaultSourceNote,
    sourceUrl: s.sourceUrl ?? null,
    methodNote: s.methodNote ?? null,
    lastReviewed: s.lastReviewed ?? null,
  };
}

/**
 * Idempotent seed. Config lives in tables, not code constants; this loads the
 * JSON under content/seed the first time and fills in anything missing on
 * later runs without overwriting edits made in Settings.
 */
export async function seedDatabase(db: Db, log: (msg: string) => void = () => {}) {
  for (const sc of scorecardsSeed.scorecards) {
    const [row] = await db
      .insert(scorecards)
      .values({ key: sc.key as 'business' | 'personal', name: sc.name, maxPerFactor: sc.maxPerFactor })
      .onConflictDoNothing({ target: scorecards.key })
      .returning();
    const scorecard =
      row ?? (await db.query.scorecards.findFirst({ where: eq(scorecards.key, sc.key as 'business' | 'personal') }));
    if (!scorecard) throw new Error(`Could not upsert scorecard ${sc.key}`);

    for (const f of sc.factors) {
      await db
        .insert(factors)
        .values({
          scorecardId: scorecard.id,
          sortOrder: f.sortOrder,
          label: f.label,
          hint: f.hint,
          weight: '1.000',
          active: true,
        })
        .onConflictDoNothing({ target: [factors.scorecardId, factors.sortOrder] });
    }
    log(`scorecard ${sc.key}: ${sc.factors.length} factors`);
  }

  for (const rk of ratingKeySeed) {
    await db
      .insert(ratingKey)
      .values({ value: rk.value, label: rk.label, description: rk.description })
      .onConflictDoNothing({ target: ratingKey.value });
  }
  log(`rating key: ${ratingKeySeed.length} entries`);

  for (const b of bandsSeed) {
    await db
      .insert(bands)
      .values({ band: b.band, label: b.label, minPct: b.minPct, maxPct: b.maxPct })
      .onConflictDoNothing({ target: bands.band });
  }
  log(`bands: ${bandsSeed.length}`);

  const existingSectors = await db.select().from(sectors);
  const byName = new Map(existingSectors.map((s) => [s.name, s]));
  let order = existingSectors.reduce((m, s) => Math.max(m, s.sortOrder), 0);
  let inserted = 0;
  let filled = 0;
  for (const s of sectorsSeed.sectors) {
    const values = sectorSeedValues(s);
    const current = byName.get(s.name);
    if (!current) {
      order += 10;
      await db.insert(sectors).values({ ...values, sortOrder: order });
      inserted += 1;
    } else if (shouldFillSector(current) && values.lowMultiple !== null && values.highMultiple !== null) {
      // Fill-blank semantics: rows the advisor has already populated are never touched.
      await db.update(sectors).set({ ...values, updatedAt: new Date() }).where(eq(sectors.id, current.id));
      filled += 1;
    }
  }
  log(`sectors: ${inserted} inserted, ${filled} filled from seed, ${sectorsSeed.sectors.length - inserted - filled} left as-is`);

  for (const [key, value] of Object.entries(settingsSeed)) {
    await db
      .insert(settings)
      .values({ key, valueJson: value })
      .onConflictDoNothing({ target: settings.key });
  }
  log(`settings: ${Object.keys(settingsSeed).join(', ')}`);

  await db.execute(sql`select 1`);
}
