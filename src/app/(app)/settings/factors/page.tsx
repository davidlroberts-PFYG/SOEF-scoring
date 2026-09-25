import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { factors, scorecards } from '@/db/schema';
import { requireSession } from '@/lib/auth';
import { toNumber } from '@/lib/format';
import { FactorEditor } from '@/components/settings/FactorEditor';

export const dynamic = 'force-dynamic';

export default async function FactorsSettingsPage() {
  await requireSession();
  const db = getDb();
  const cards = await db.select().from(scorecards).orderBy(asc(scorecards.key));
  const lists = await Promise.all(
    cards.map(async (sc) => ({
      scorecard: sc,
      factors: (await db.select().from(factors).where(eq(factors.scorecardId, sc.id)).orderBy(asc(factors.sortOrder))).map((f) => ({
        id: f.id,
        sortOrder: f.sortOrder,
        label: f.label,
        hint: f.hint,
        weight: toNumber(f.weight) ?? 1,
        active: f.active,
      })),
    })),
  );
  return (
    <div className="space-y-6">
      <div className="rounded-md bg-canvas px-4 py-3 text-sm text-ink-soft">
        <p>
          <strong className="text-navy">Weights</strong> default to 1.0 so totals match the paper worksheets (132 and 66). Raising a weight increases both that factor&apos;s contribution and the maximum, and its share of the attributed gap.
        </p>
        <p className="mt-1">
          <strong className="text-navy">Labels and hints</strong> are editable so the factor text can be reworded in your own language before public release (see the IP note in CLAUDE.md). Inactive factors are hidden from new scoring and excluded from totals.
        </p>
      </div>
      {lists.map(({ scorecard, factors: list }) => (
        <FactorEditor key={scorecard.id} title={scorecard.name} factors={list} />
      ))}
    </div>
  );
}
