import { eq, sql } from 'drizzle-orm';
import type { Db } from './client';
import { bands, factors, ratingKey, scorecards, sectors, settings } from './schema';
import scorecardsSeed from '../../content/seed/scorecards.json';
import ratingKeySeed from '../../content/seed/rating-key.json';
import bandsSeed from '../../content/seed/bands.json';
import sectorsSeed from '../../content/seed/sectors.json';
import settingsSeed from '../../content/seed/settings.json';

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

  let order = 0;
  for (const s of sectorsSeed.sectors) {
    order += 10;
    await db
      .insert(sectors)
      .values({
        name: s.name,
        naicsPrefix: s.naicsPrefix,
        lowMultiple: null,
        highMultiple: null,
        basis: 'EBITDA',
        sourceNote: sectorsSeed.defaultSourceNote,
        lastReviewed: null,
        sortOrder: order,
      })
      .onConflictDoNothing({ target: sectors.name });
  }
  log(`sectors: ${sectorsSeed.sectors.length} (multiples blank — SOURCE NEEDED)`);

  for (const [key, value] of Object.entries(settingsSeed)) {
    await db
      .insert(settings)
      .values({ key, valueJson: value })
      .onConflictDoNothing({ target: settings.key });
  }
  log(`settings: ${Object.keys(settingsSeed).join(', ')}`);

  await db.execute(sql`select 1`);
}
