import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAssessmentAction, deleteAssessmentAction } from '@/actions/assessments';
import { deleteOwnerAction } from '@/actions/owners';
import { requireSession } from '@/lib/auth';
import { getEngineConfig, getOwner, getRatingsForAssessment, listAssessmentsForOwner, toAssessmentInput, toSectorInput } from '@/lib/data';
import { formatCurrency, formatDate, formatPct } from '@/lib/format';
import { buildAssessmentResult } from '@/engine';
import { PageHeader } from '@/components/PageHeader';
import { BandPill, StatusPill } from '@/components/Pill';
import { ConfirmButton } from '@/components/ConfirmButton';

export const dynamic = 'force-dynamic';

export default async function ClientPage({ params }: { params: Promise<{ ownerId: string }> }) {
  const session = await requireSession();
  const { ownerId } = await params;
  const owner = await getOwner(session.advisorId, ownerId);
  if (!owner) notFound();
  const [list, config] = await Promise.all([listAssessmentsForOwner(owner.id), getEngineConfig()]);
  const rows = await Promise.all(
    list.map(async (a) => {
      const ratings = await getRatingsForAssessment(a.id);
      const result = buildAssessmentResult({
        assessment: toAssessmentInput(a),
        sector: toSectorInput(owner.sector),
        scorecards: config.scorecards,
        factors: config.factors,
        ratings,
        bands: config.bands,
        ratingKey: config.ratingKey,
      });
      return { a, result };
    }),
  );

  const newBlank = createAssessmentAction.bind(null, owner.id, false);
  const newCopy = createAssessmentAction.bind(null, owner.id, true);
  const deleteOwner = deleteOwnerAction.bind(null, owner.id);

  return (
    <>
      <PageHeader
        backHref="/clients"
        backLabel="Clients"
        eyebrow={owner.sector?.name ?? 'No sector set'}
        title={owner.companyName}
        subtitle={
          <>
            {owner.name}
            {owner.email ? ` · ${owner.email}` : ''}
            {!owner.sector?.hasMultiples ? (
              <span className="ml-2 rounded bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn">
                {owner.sector ? 'Sector multiples not set' : 'Sector needed for valuation'}
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <Link href={`/clients/${owner.id}/edit`} className="btn-ghost">
              Edit client
            </Link>
            {list.length > 0 ? (
              <form action={newCopy}>
                <button type="submit" className="btn-navy">
                  New assessment (copy latest)
                </button>
              </form>
            ) : null}
            <form action={newBlank}>
              <button type="submit" className="btn-primary">
                + New blank assessment
              </button>
            </form>
          </>
        }
      />

      {owner.notes ? (
        <div className="card mb-6">
          <p className="label">Advisor notes</p>
          <p className="whitespace-pre-wrap text-sm">{owner.notes}</p>
        </div>
      ) : null}

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Title</th>
              <th>Status</th>
              <th className="text-right">Business</th>
              <th>Band</th>
              <th className="text-right">Personal</th>
              <th className="text-right">Est. current value</th>
              <th className="text-right">Est. gap</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-ink-soft">
                  No assessments yet. Start one above.
                </td>
              </tr>
            ) : null}
            {rows.map(({ a, result }) => (
              <tr key={a.id} className="hover:bg-canvas">
                <td className="whitespace-nowrap">
                  <Link href={`/assessments/${a.id}`} className="font-semibold text-navy hover:underline">
                    {formatDate(a.assessedAt)}
                  </Link>
                </td>
                <td className="text-ink-soft">{a.title ?? '—'}</td>
                <td>
                  <StatusPill status={a.status} />
                </td>
                <td className="text-right font-semibold">{formatPct(result.business.readinessPct)}</td>
                <td>
                  <BandPill band={result.business.band} />
                </td>
                <td className="text-right">{formatPct(result.personal.readinessPct)}</td>
                <td className="text-right">{formatCurrency(result.valueGap.currentValue)}</td>
                <td className="text-right font-semibold">{formatCurrency(result.valueGap.valueGap)}</td>
                <td className="whitespace-nowrap text-right">
                  <Link href={`/assessments/${a.id}`} className="btn-ghost px-3 py-1 text-xs">
                    Dashboard
                  </Link>{' '}
                  <Link href={`/assessments/${a.id}/edit`} className="btn-ghost px-3 py-1 text-xs">
                    {a.status === 'released' ? 'View' : 'Edit'}
                  </Link>{' '}
                  <ConfirmButton
                    action={deleteAssessmentAction.bind(null, a.id)}
                    confirmText="Delete this assessment and all its ratings? This cannot be undone."
                    className="btn-danger px-3 py-1 text-xs"
                  >
                    Delete
                  </ConfirmButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > 1 ? (
        <p className="mt-3 text-xs text-ink-soft">
          Progress over time: compare the Business % and estimated gap across rows. A chart view is planned for Phase 2.
        </p>
      ) : null}

      <div className="mt-10 border-t border-line pt-6">
        <ConfirmButton
          action={deleteOwner}
          confirmText={`Delete ${owner.companyName} and ALL of its assessments? This cannot be undone.`}
          className="btn-danger"
        >
          Delete client
        </ConfirmButton>
      </div>
    </>
  );
}
