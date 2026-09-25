import Link from 'next/link';
import { notFound } from 'next/navigation';
import { reopenAssessmentAction } from '@/actions/assessments';
import { requireSession } from '@/lib/auth';
import { getAssessmentBundle, toSectorInput } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { AssessmentEditor, type FinancialsState } from '@/components/AssessmentEditor';
import { PageHeader } from '@/components/PageHeader';
import { StatusPill } from '@/components/Pill';

export const dynamic = 'force-dynamic';

export default async function EditAssessmentPage({ params }: { params: Promise<{ assessmentId: string }> }) {
  const session = await requireSession();
  const { assessmentId } = await params;
  const bundle = await getAssessmentBundle(session.advisorId, assessmentId);
  if (!bundle) notFound();
  const { assessment, owner, sector, config, ratings } = bundle;
  const readOnly = assessment.status === 'released';
  const num = (v: string | null) => (v === null ? '' : String(Number(v)));

  const initialFinancials: FinancialsState = {
    title: assessment.title ?? '',
    assessedAt: assessment.assessedAt,
    revenueTtm: num(assessment.revenueTtm),
    earnings: num(assessment.earnings),
    earningsBasis: assessment.earningsBasis,
    ownerValueEstimate: num(assessment.ownerValueEstimate),
    useOverride: assessment.overrideLowMultiple !== null && assessment.overrideHighMultiple !== null,
    overrideLowMultiple: num(assessment.overrideLowMultiple),
    overrideHighMultiple: num(assessment.overrideHighMultiple),
    overrideNote: assessment.overrideNote ?? '',
  };

  return (
    <>
      <PageHeader
        backHref={`/clients/${owner.id}`}
        backLabel={owner.companyName}
        eyebrow={`Assessment · ${formatDate(assessment.assessedAt)}`}
        title={assessment.title ? `${owner.companyName} — ${assessment.title}` : owner.companyName}
        subtitle={
          <span className="flex items-center gap-2">
            <StatusPill status={assessment.status} />
            {readOnly ? 'Released assessments are frozen. Reopen to edit (the snapshot will be recomputed on the next release).' : 'Changes save automatically.'}
          </span>
        }
        actions={
          readOnly ? (
            <form action={reopenAssessmentAction.bind(null, assessment.id)}>
              <button type="submit" className="btn-ghost">
                Reopen for editing
              </button>
            </form>
          ) : (
            <Link href={`/assessments/${assessment.id}`} className="btn-ghost">
              Dashboard
            </Link>
          )
        }
      />
      <AssessmentEditor
        assessmentId={assessment.id}
        readOnly={readOnly}
        companyName={owner.companyName}
        sector={toSectorInput(sector)}
        scorecards={config.scorecards}
        factors={config.factors}
        bands={config.bands}
        ratingKey={config.ratingKey}
        initialRatings={ratings}
        initialFinancials={initialFinancials}
      />
    </>
  );
}
