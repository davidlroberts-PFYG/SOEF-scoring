import { requireSession } from '@/lib/auth';
import { listSectors } from '@/lib/data';
import { SectorEditor } from '@/components/settings/SectorEditor';

export const dynamic = 'force-dynamic';

export default async function SectorsSettingsPage() {
  await requireSession();
  const sectors = await listSectors(true);
  return (
    <div className="space-y-4">
      <div className="rounded-md bg-warn-soft px-4 py-3 text-sm text-warn">
        <strong>Check the basis before you trust a number.</strong> Seeded rows come from BizBuySell sub-industry medians and are <strong>SDE</strong> multiples; the app blocks a valuation when an assessment&apos;s earnings are entered in a different basis unless an owner-compensation add-back bridges them. &quot;Median range&quot; rows label their top &quot;Top of sector range&quot;, not &quot;Best-in-class&quot;; switch to &quot;Top quartile&quot; only for ranges built from a transaction database. Reuse terms for BizBuySell and IBBA data are not yet verified (see content/benchmarks/README.md).
      </div>
      <SectorEditor sectors={sectors} />
    </div>
  );
}
