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
        <strong>Multiples are placeholders until you populate them.</strong> Enter ranges from a licensed transaction-data source (DealStats, BizBuySell Insight, Peercomps) or your own experience, and record the source and review date. The source note and review date are shown beside every valuation figure and on the PDF.
      </div>
      <SectorEditor sectors={sectors} />
    </div>
  );
}
