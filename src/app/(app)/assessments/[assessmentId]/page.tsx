import Link from 'next/link';
import { notFound } from 'next/navigation';
import { releaseAssessmentAction, reopenAssessmentAction } from '@/actions/assessments';
import { requireSession } from '@/lib/auth';
import { getAssessmentBundle } from '@/lib/data';
import { formatCurrency, formatCurrencyExact, formatDate, formatMultiple, formatPct } from '@/lib/format';
import { buildNarrative } from '@/engine';
import { PageHeader } from '@/components/PageHeader';
import { BandPill, StatusPill } from '@/components/Pill';
import { Gauge } from '@/components/Gauge';
import { RangeBar } from '@/components/RangeBar';
import { FactorTable } from '@/components/FactorTable';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({ params }: { params: Promise<{ assessmentId: string }> }) {
  const session = await requireSession();
  const { assessmentId } = await params;
  const bundle = await getAssessmentBundle(session.advisorId, assessmentId);
  if (!bundle) notFound();
  const { assessment, owner, result, fromSnapshot } = bundle;
  const { business, personal, combined, valueGap: vg } = result;
  const narrative = buildNarrative(result, owner.companyName);
  const released = assessment.status === 'released';

  const businessRows = business.rows.map((row) => {
    const attr = vg.attribution.find((a) => a.factorId === row.factorId);
    return {
      factorId: row.factorId,
      label: row.label,
      rating: row.rating,
      weight: row.weight,
      pointsLost: row.pointsLost,
      share: attr?.share ?? 0,
      gapAttributed: attr?.gapAttributed ?? null,
      note: row.note,
      sortOrder: row.sortOrder,
      hint: row.hint,
    };
  });
  const personalRows = personal.rows.map((row) => ({
    factorId: row.factorId,
    label: row.label,
    rating: row.rating,
    weight: row.weight,
    pointsLost: row.pointsLost,
    share: 0,
    gapAttributed: null,
    note: row.note,
    sortOrder: row.sortOrder,
    hint: row.hint,
  }));

  return (
    <>
      <PageHeader
        backHref={`/clients/${owner.id}`}
        backLabel={owner.companyName}
        eyebrow={`Value Gap Dashboard · ${formatDate(assessment.assessedAt)}`}
        title={assessment.title ? `${owner.companyName} — ${assessment.title}` : owner.companyName}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill status={assessment.status} />
            {owner.name}
            {result.sector ? ` · ${result.sector.name}` : ''}
            {fromSnapshot ? (
              <span className="text-xs">· Frozen at release {assessment.releasedAt ? formatDate(assessment.releasedAt) : ''}</span>
            ) : null}
          </span>
        }
        actions={
          <>
            <a href={`/assessments/${assessment.id}/report`} className="btn-ghost" target="_blank" rel="noopener">
              Export PDF
            </a>
            {released ? (
              <form action={reopenAssessmentAction.bind(null, assessment.id)}>
                <button type="submit" className="btn-ghost">
                  Reopen
                </button>
              </form>
            ) : (
              <>
                <Link href={`/assessments/${assessment.id}/edit`} className="btn-ghost">
                  Edit scores
                </Link>
                <form action={releaseAssessmentAction.bind(null, assessment.id)}>
                  <button type="submit" className="btn-primary" title="Freeze this result so the report never changes if benchmarks are edited later">
                    Release
                  </button>
                </form>
              </>
            )}
          </>
        }
      />

      {!business.complete ? (
        <div className="mb-4 rounded-md bg-warn-soft px-4 py-2 text-sm text-warn">
          Business scorecard is {business.ratedCount}/{business.factorCount} rated. Unrated factors count as zero until scored.
        </div>
      ) : null}

      {/* Row 1: gauges + headline */}
      <section className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
        <div className="card flex flex-wrap items-start justify-center gap-6">
          <Gauge label="Business Readiness" pct={business.readinessPct} band={business.band} total={business.totalRating} max={business.maxRating} />
          <Gauge label="Personal Readiness" pct={personal.readinessPct} band={personal.band} total={personal.totalRating} max={personal.maxRating} />
          <div className="w-full text-center text-xs text-ink-soft">
            Combined readiness {formatPct(combined.readinessPct)} ({combined.totalRating}/{combined.maxRating}) <BandPill band={combined.band} />
          </div>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-widest text-orange">In plain English</p>
          <h2 className="mt-1 text-xl font-bold">{narrative.headline}</h2>
          <p className="mt-2 text-sm leading-relaxed">{narrative.paragraphs[1]}</p>
          <p className="mt-3 text-xs text-ink-soft">{narrative.caveat}</p>
        </div>
      </section>

      {/* Row 2: value */}
      <section className="mt-4 card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">Range of value</h2>
          <p className="text-xs text-ink-soft">
            {vg.source.kind === 'override' ? (
              <>
                Custom override for this assessment
                {vg.source.overrideNote ? ` — ${vg.source.overrideNote}` : ''}
              </>
            ) : (
              <>
                Sector: {vg.source.sectorName ?? '—'} · Source: {vg.source.sourceNote ?? 'not recorded'} · Last reviewed: {vg.source.lastReviewed ? formatDate(vg.source.lastReviewed) : '—'}
              </>
            )}
          </p>
        </div>
        {vg.status === 'no_multiples' || vg.status === 'invalid_multiples' ? (
          <div className="mt-3 rounded-md bg-warn-soft p-4 text-sm text-warn">
            <p className="font-semibold">Valuation panel unavailable.</p>
            <p>{vg.message}</p>
            <div className="mt-2 flex gap-2">
              <Link href={`/assessments/${assessment.id}/edit`} className="btn-ghost text-xs">
                Enter an override
              </Link>
              <Link href="/settings/sectors" className="btn-ghost text-xs">
                Edit sector table
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-3">
              <RangeBar low={vg.lowMultiple} high={vg.highMultiple} current={vg.currentMultiple} position={vg.rangePosition} basis={vg.earningsBasis} />
            </div>
            {vg.status === 'no_earnings' ? (
              <div className="mt-3 rounded-md bg-warn-soft p-4 text-sm text-warn">
                <p className="font-semibold">{vg.message}</p>
                <p>Readiness scores and the multiple range are shown; dollar values are hidden until positive normalized {vg.earningsBasis} is entered.</p>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <BigNumber label="Current estimated value" value={formatCurrency(vg.currentValue)} sub={`${formatCurrencyExact(vg.earnings)} ${vg.earningsBasis} × ${formatMultiple(vg.currentMultiple)}`} />
                <BigNumber label="Best-in-class value" value={formatCurrency(vg.bestInClassValue)} sub={`${formatCurrencyExact(vg.earnings)} ${vg.earningsBasis} × ${formatMultiple(vg.bestInClassMultiple)}`} />
                <BigNumber label="Estimated value gap" value={formatCurrency(vg.valueGap)} sub="Best-in-class minus current" accent />
              </div>
            )}
            {result.assessment.ownerValueEstimate !== null && vg.currentValue !== null ? (
              <p className="mt-3 text-xs text-ink-soft">
                Owner&apos;s own estimate: {formatCurrencyExact(result.assessment.ownerValueEstimate)} (
                {result.assessment.ownerValueEstimate > vg.currentValue ? 'above' : 'below'} the current estimate by {formatCurrency(Math.abs(result.assessment.ownerValueEstimate - vg.currentValue))}).
              </p>
            ) : null}
          </>
        )}
      </section>

      {/* Row 3: levers */}
      <section className="mt-4 card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">Biggest levers</h2>
          <p className="text-xs text-ink-soft">Allocation of the estimated gap by points lost — not a prediction for any single fix.</p>
        </div>
        {vg.biggestLevers.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">{business.ratedCount === 0 ? 'Score the business factors to see levers.' : 'No points lost — every rated factor is at 6.'}</p>
        ) : (
          <ol className="mt-3 grid gap-3 lg:grid-cols-5">
            {vg.biggestLevers.map((l, i) => (
              <li key={l.factorId} className="rounded-md border border-line p-3">
                <p className="text-xs font-semibold text-orange">#{i + 1}</p>
                <p className="font-heading text-sm font-bold text-navy">{l.label}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  Rated {l.rating ?? '—'}/6 · {l.pointsLost} pts lost · {formatPct(l.share)} of gap
                </p>
                <p className="mt-1 text-lg font-bold text-navy">{l.gapAttributed === null ? '—' : formatCurrency(l.gapAttributed)}</p>
                {l.note ? <p className="mt-1 whitespace-pre-wrap text-xs text-ink-soft">{l.note}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Row 4: full tables */}
      <section className="mt-4 space-y-4">
        <FactorTable title="Business Readiness — all factors" rows={businessRows} showGap={vg.status === 'ok'} />
        <FactorTable title="Personal Readiness — all factors" rows={personalRows} showGap={false} />
      </section>
    </>
  );
}

function BigNumber({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-md p-4 ${accent ? 'bg-navy text-white' : 'bg-canvas'}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${accent ? 'text-orange' : 'text-ink-soft'}`}>{label}</p>
      <p className={`mt-1 font-heading text-2xl font-bold sm:text-3xl ${accent ? 'text-white' : 'text-navy'}`}>{value}</p>
      {sub ? <p className={`mt-1 text-xs ${accent ? 'text-white/70' : 'text-ink-soft'}`}>{sub}</p> : null}
    </div>
  );
}
