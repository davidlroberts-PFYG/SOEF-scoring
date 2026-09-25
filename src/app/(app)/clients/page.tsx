import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { listClients } from '@/lib/data';
import { formatCurrency, formatDate, formatPct } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { StatusPill } from '@/components/Pill';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const session = await requireSession();
  const clients = await listClients(session.advisorId);

  return (
    <>
      <PageHeader
        eyebrow="Clients"
        title="Clients"
        subtitle="Each row shows the most recent assessment. Values are estimates, not appraisals."
        actions={
          <Link href="/clients/new" className="btn-primary">
            + New client
          </Link>
        }
      />

      {clients.length === 0 ? (
        <div className="card text-center">
          <p className="text-ink-soft">No clients yet.</p>
          <Link href="/clients/new" className="btn-primary mt-4">
            Add your first client
          </Link>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Owner</th>
                <th>Sector</th>
                <th>Last assessment</th>
                <th className="text-right">Business</th>
                <th className="text-right">Personal</th>
                <th className="text-right">Est. value gap</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map(({ owner, sectorName, latest, assessmentCount }) => (
                <tr key={owner.id} className="hover:bg-canvas">
                  <td>
                    <Link href={`/clients/${owner.id}`} className="font-semibold text-navy hover:underline">
                      {owner.companyName}
                    </Link>
                  </td>
                  <td>{owner.name}</td>
                  <td className="text-ink-soft">{sectorName ?? '—'}</td>
                  <td>
                    {latest ? (
                      <div className="flex items-center gap-2">
                        <Link href={`/assessments/${latest.id}`} className="hover:underline">
                          {formatDate(latest.assessedAt)}
                        </Link>
                        <StatusPill status={latest.status} />
                        {assessmentCount > 1 ? (
                          <span className="text-xs text-ink-soft">+{assessmentCount - 1} more</span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-ink-soft">None</span>
                    )}
                  </td>
                  <td className="text-right font-semibold">{latest ? formatPct(latest.businessPct) : '—'}</td>
                  <td className="text-right">{latest ? formatPct(latest.personalPct) : '—'}</td>
                  <td className="text-right font-semibold">
                    {latest?.valueGap !== null && latest?.valueGap !== undefined ? (
                      formatCurrency(latest.valueGap)
                    ) : (
                      <span className="text-xs font-normal text-ink-soft" title={latest?.valuationStatus}>
                        {latest?.valuationStatus === 'no_earnings'
                          ? 'Needs earnings'
                          : latest?.valuationStatus === 'no_multiples'
                            ? 'Needs multiples'
                            : '—'}
                      </span>
                    )}
                  </td>
                  <td className="text-right">
                    <Link href={`/clients/${owner.id}`} className="btn-ghost px-3 py-1 text-xs">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
