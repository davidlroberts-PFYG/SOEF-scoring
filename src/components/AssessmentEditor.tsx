'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { saveFinancialsAction, saveRatingAction, type ActionResult, type FinancialsInput } from '@/actions/assessments';
import {
  buildAssessmentResult,
  type AssessmentInput,
  type BandDef,
  type FactorDef,
  type FactorRatingInput,
  type RatingKeyEntry,
  type ScorecardMeta,
  type SectorInput,
} from '@/engine';
import { formatCurrency, formatMultiple, formatPct } from '@/lib/format';
import { RatingControl } from './RatingControl';
import { BandPill } from './Pill';

type Tab = 'business' | 'personal' | 'financials';

export interface FinancialsState {
  title: string;
  assessedAt: string;
  revenueTtm: string;
  earnings: string;
  earningsBasis: 'EBITDA' | 'SDE';
  ownerValueEstimate: string;
  useOverride: boolean;
  overrideLowMultiple: string;
  overrideHighMultiple: string;
  overrideNote: string;
}

interface Props {
  assessmentId: string;
  readOnly: boolean;
  companyName: string;
  sector: SectorInput | null;
  scorecards: ScorecardMeta[];
  factors: FactorDef[];
  bands: BandDef[];
  ratingKey: RatingKeyEntry[];
  initialRatings: FactorRatingInput[];
  initialFinancials: FinancialsState;
}

type RatingsMap = Record<string, { rating: number | null; note: string }>;

function toNum(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function toAssessmentInput(f: FinancialsState): AssessmentInput {
  return {
    assessedAt: f.assessedAt,
    status: 'draft',
    revenueTtm: toNum(f.revenueTtm),
    earnings: toNum(f.earnings),
    earningsBasis: f.earningsBasis,
    ownerValueEstimate: toNum(f.ownerValueEstimate),
    overrideLowMultiple: f.useOverride ? toNum(f.overrideLowMultiple) : null,
    overrideHighMultiple: f.useOverride ? toNum(f.overrideHighMultiple) : null,
    overrideNote: f.useOverride ? f.overrideNote || null : null,
  };
}

export function AssessmentEditor(props: Props) {
  const { assessmentId, readOnly, factors, bands, ratingKey, scorecards } = props;
  const [tab, setTab] = useState<Tab>('business');
  const [ratings, setRatings] = useState<RatingsMap>(() => {
    const m: RatingsMap = {};
    for (const r of props.initialRatings) m[r.factorId] = { rating: r.rating, note: r.note ?? '' };
    return m;
  });
  const [fin, setFin] = useState<FinancialsState>(props.initialFinancials);
  const [saveState, setSaveState] = useState<{ status: 'idle' | 'saving' | 'saved' | 'error'; message?: string; at?: string }>({
    status: 'idle',
  });
  const pending = useRef(0);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const result = useMemo(
    () =>
      buildAssessmentResult({
        assessment: toAssessmentInput(fin),
        sector: props.sector,
        scorecards,
        factors,
        ratings: Object.entries(ratings).map(([factorId, v]) => ({ factorId, rating: v.rating, note: v.note })),
        bands,
        ratingKey,
      }),
    [fin, ratings, props.sector, scorecards, factors, bands, ratingKey],
  );

  const track = useCallback((p: Promise<ActionResult>) => {
    pending.current += 1;
    setSaveState({ status: 'saving' });
    p.then((res) => {
      pending.current -= 1;
      if (!res.ok) setSaveState({ status: 'error', message: res.error ?? 'Save failed' });
      else if (pending.current === 0) setSaveState({ status: 'saved', at: res.savedAt });
    }).catch((err: unknown) => {
      pending.current -= 1;
      setSaveState({ status: 'error', message: err instanceof Error ? err.message : 'Save failed' });
    });
  }, []);

  const scheduleRatingSave = useCallback(
    (factorId: string, next: { rating: number | null; note: string }, delay: number) => {
      if (readOnly) return;
      clearTimeout(timers.current[factorId]);
      timers.current[factorId] = setTimeout(() => {
        track(saveRatingAction(assessmentId, { factorId, rating: next.rating, note: next.note || null }));
      }, delay);
    },
    [assessmentId, readOnly, track],
  );

  const setRating = (factorId: string, rating: number | null) => {
    setRatings((prev) => {
      const next = { rating, note: prev[factorId]?.note ?? '' };
      scheduleRatingSave(factorId, next, 250);
      return { ...prev, [factorId]: next };
    });
  };

  const setNote = (factorId: string, note: string) => {
    setRatings((prev) => {
      const next = { rating: prev[factorId]?.rating ?? null, note };
      scheduleRatingSave(factorId, next, 900);
      return { ...prev, [factorId]: next };
    });
  };

  const finTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finDirty = useRef(false);
  useEffect(() => {
    if (readOnly || !finDirty.current) return;
    if (finTimer.current) clearTimeout(finTimer.current);
    finTimer.current = setTimeout(() => {
      const payload: FinancialsInput = {
        title: fin.title || null,
        assessedAt: fin.assessedAt,
        revenueTtm: fin.revenueTtm || null,
        earnings: fin.earnings || null,
        earningsBasis: fin.earningsBasis,
        ownerValueEstimate: fin.ownerValueEstimate || null,
        useOverride: fin.useOverride,
        overrideLowMultiple: fin.overrideLowMultiple || null,
        overrideHighMultiple: fin.overrideHighMultiple || null,
        overrideNote: fin.overrideNote || null,
      };
      track(saveFinancialsAction(assessmentId, payload));
    }, 900);
  }, [fin, assessmentId, readOnly, track]);

  const updateFin = <K extends keyof FinancialsState>(key: K, value: FinancialsState[K]) => {
    finDirty.current = true;
    setFin((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    const t = timers.current;
    return () => {
      Object.values(t).forEach(clearTimeout);
      if (finTimer.current) clearTimeout(finTimer.current);
    };
  }, []);

  const current = tab === 'personal' ? result.personal : result.business;
  const vg = result.valueGap;

  return (
    <div className="space-y-4">
      {/* Sticky running totals */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex gap-1">
            {(['business', 'personal', 'financials'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                  tab === t ? 'bg-navy text-white' : 'text-navy hover:bg-canvas'
                }`}
              >
                {t === 'business' ? 'Business Scorecard' : t === 'personal' ? 'Personal Scorecard' : 'Financials'}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <Stat label="Business" value={`${result.business.totalRating}/${result.business.maxRating} · ${formatPct(result.business.readinessPct)}`} band={result.business.band} />
            <Stat label="Personal" value={`${result.personal.totalRating}/${result.personal.maxRating} · ${formatPct(result.personal.readinessPct)}`} band={result.personal.band} />
            <span className="text-ink-soft">
              Combined <strong className="text-navy">{formatPct(result.combined.readinessPct)}</strong>
            </span>
            {vg.valueGap !== null ? (
              <span className="text-ink-soft">
                Est. gap <strong className="text-navy">{formatCurrency(vg.valueGap)}</strong>
              </span>
            ) : null}
          </div>
          <div className="ml-auto text-xs">
            {readOnly ? (
              <span className="rounded bg-navy px-2 py-1 font-semibold text-white">Released · read-only</span>
            ) : saveState.status === 'saving' ? (
              <span className="text-ink-soft">Saving…</span>
            ) : saveState.status === 'saved' ? (
              <span className="text-ok">Saved{saveState.at ? ` ${new Date(saveState.at).toLocaleTimeString()}` : ''}</span>
            ) : saveState.status === 'error' ? (
              <span role="alert" className="text-danger">
                {saveState.message}
              </span>
            ) : (
              <span className="text-ink-soft">Autosave on</span>
            )}
          </div>
        </div>
      </div>

      {tab !== 'financials' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">{current.name}</h2>
            <p className="text-xs text-ink-soft">
              {current.ratedCount}/{current.factorCount} rated · max {current.maxRating} points
            </p>
          </div>
          <RatingKeyLegend ratingKey={ratingKey} />
          <ol className="space-y-2">
            {current.rows.map((row) => (
              <li key={row.factorId} className="card grid gap-3 p-4 lg:grid-cols-[minmax(0,1.3fr)_auto_minmax(0,1fr)] lg:items-start">
                <div>
                  <p className="font-semibold text-navy">
                    <span className="mr-2 text-xs text-ink-soft">{row.sortOrder}.</span>
                    {row.label}
                    {row.weight !== 1 ? <span className="ml-2 text-xs font-normal text-ink-soft">weight {row.weight}</span> : null}
                  </p>
                  {row.hint ? <p className="mt-0.5 text-sm text-ink-soft">{row.hint}</p> : null}
                </div>
                <div className="flex flex-col gap-1">
                  <RatingControl
                    name={row.label}
                    value={row.rating}
                    onChange={(v) => setRating(row.factorId, v)}
                    ratingKey={ratingKey}
                    disabled={readOnly}
                  />
                  <p className="h-4 text-xs text-ink-soft">
                    {row.rating !== null ? ratingKey.find((k) => k.value === row.rating)?.label : 'Not rated'}
                  </p>
                </div>
                <div>
                  <textarea
                    aria-label={`Notes for ${row.label}`}
                    placeholder="Advisor notes (optional)"
                    rows={2}
                    disabled={readOnly}
                    className="input text-sm"
                    value={ratings[row.factorId]?.note ?? ''}
                    onChange={(e) => setNote(row.factorId, e.target.value)}
                  />
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <FinancialsTab fin={fin} updateFin={updateFin} readOnly={readOnly} sector={props.sector} result={result} />
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Link href={`/assessments/${assessmentId}`} className="btn-navy">
          View dashboard →
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, band }: { label: string; value: string; band: BandDef | null }) {
  return (
    <span className="flex items-center gap-2 text-ink-soft">
      {label} <strong className="text-navy">{value}</strong> <BandPill band={band} />
    </span>
  );
}

function RatingKeyLegend({ ratingKey }: { ratingKey: RatingKeyEntry[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-surface px-3 py-2 text-xs text-ink-soft">
      {ratingKey.map((k) => (
        <span key={k.value}>
          <strong className="text-navy">{k.value}</strong> {k.label}
          {k.description && k.description.toLowerCase() !== k.label.toLowerCase() ? ` — ${k.description}` : ''}
        </span>
      ))}
    </div>
  );
}

function FinancialsTab({
  fin,
  updateFin,
  readOnly,
  sector,
  result,
}: {
  fin: FinancialsState;
  updateFin: <K extends keyof FinancialsState>(key: K, value: FinancialsState[K]) => void;
  readOnly: boolean;
  sector: SectorInput | null;
  result: ReturnType<typeof buildAssessmentResult>;
}) {
  const vg = result.valueGap;
  const sectorHasMultiples = sector?.lowMultiple !== null && sector?.lowMultiple !== undefined && sector?.highMultiple !== null;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="card space-y-4">
        <h2 className="text-lg font-bold">Assessment</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="assessedAt">
              Assessment date
            </label>
            <input id="assessedAt" type="date" className="input" disabled={readOnly} value={fin.assessedAt} onChange={(e) => updateFin('assessedAt', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="title">
              Title (optional)
            </label>
            <input id="title" className="input" disabled={readOnly} placeholder="e.g. Baseline, 6-month check-in" value={fin.title} onChange={(e) => updateFin('title', e.target.value)} />
          </div>
        </div>

        <h2 className="pt-2 text-lg font-bold">Financials</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="revenueTtm">
              Trailing-12-month revenue
            </label>
            <input id="revenueTtm" inputMode="decimal" className="input" disabled={readOnly} placeholder="$" value={fin.revenueTtm} onChange={(e) => updateFin('revenueTtm', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="earningsBasis">
              Earnings basis
            </label>
            <select id="earningsBasis" className="input" disabled={readOnly} value={fin.earningsBasis} onChange={(e) => updateFin('earningsBasis', e.target.value as 'EBITDA' | 'SDE')}>
              <option value="EBITDA">Normalized EBITDA</option>
              <option value="SDE">SDE (seller&apos;s discretionary earnings)</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="earnings">
              Normalized {fin.earningsBasis}
            </label>
            <input id="earnings" inputMode="decimal" className="input" disabled={readOnly} placeholder="$" value={fin.earnings} onChange={(e) => updateFin('earnings', e.target.value)} />
            <p className="mt-1 text-xs text-ink-soft">Must be positive to produce a dollar estimate.</p>
          </div>
          <div>
            <label className="label" htmlFor="ownerValueEstimate">
              Owner&apos;s own value estimate (optional)
            </label>
            <input id="ownerValueEstimate" inputMode="decimal" className="input" disabled={readOnly} placeholder="$" value={fin.ownerValueEstimate} onChange={(e) => updateFin('ownerValueEstimate', e.target.value)} />
          </div>
        </div>

        <h2 className="pt-2 text-lg font-bold">Multiple range</h2>
        <div className="rounded-md bg-canvas p-3 text-sm">
          {sector ? (
            sectorHasMultiples ? (
              <p>
                Sector table: <strong>{sector.name}</strong> {formatMultiple(sector.lowMultiple)}–{formatMultiple(sector.highMultiple)} ({sector.basis})
                <br />
                <span className="text-xs text-ink-soft">
                  Source: {sector.sourceNote ?? '—'} · Last reviewed: {sector.lastReviewed ?? '—'}
                </span>
              </p>
            ) : (
              <p className="text-warn">
                <strong>{sector.name}</strong> has no multiples in the sector table yet. Populate it in Settings or enter an override below.
              </p>
            )
          ) : (
            <p className="text-warn">No sector set for this client. Set one on the client record or enter an override below.</p>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" disabled={readOnly} checked={fin.useOverride} onChange={(e) => updateFin('useOverride', e.target.checked)} />
          Use a custom multiple range for this assessment
        </label>
        {fin.useOverride ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="overrideLow">
                Override low multiple
              </label>
              <input id="overrideLow" inputMode="decimal" className="input" disabled={readOnly} placeholder="e.g. 3.0" value={fin.overrideLowMultiple} onChange={(e) => updateFin('overrideLowMultiple', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="overrideHigh">
                Override high multiple
              </label>
              <input id="overrideHigh" inputMode="decimal" className="input" disabled={readOnly} placeholder="e.g. 6.0" value={fin.overrideHighMultiple} onChange={(e) => updateFin('overrideHighMultiple', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="overrideNote">
                Why this range? (required)
              </label>
              <textarea id="overrideNote" rows={2} className="input" disabled={readOnly} placeholder="Data source, comps, or rationale" value={fin.overrideNote} onChange={(e) => updateFin('overrideNote', e.target.value)} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="card space-y-3 self-start">
        <h2 className="text-lg font-bold">Live estimate</h2>
        <p className="text-xs text-ink-soft">Uses Business Readiness only. Estimates, not an appraisal.</p>
        {vg.status === 'ok' ? (
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-ink-soft">Current multiple</dt>
            <dd className="text-right font-semibold">{formatMultiple(vg.currentMultiple)}</dd>
            <dt className="text-ink-soft">Best-in-class multiple</dt>
            <dd className="text-right font-semibold">{formatMultiple(vg.bestInClassMultiple)}</dd>
            <dt className="text-ink-soft">Current estimated value</dt>
            <dd className="text-right font-semibold">{formatCurrency(vg.currentValue)}</dd>
            <dt className="text-ink-soft">Best-in-class value</dt>
            <dd className="text-right font-semibold">{formatCurrency(vg.bestInClassValue)}</dd>
            <dt className="text-navy font-semibold">Estimated value gap</dt>
            <dd className="text-right text-lg font-bold text-orange">{formatCurrency(vg.valueGap)}</dd>
          </dl>
        ) : (
          <div className="rounded-md bg-warn-soft p-3 text-sm text-warn">
            <p>{vg.message}</p>
            {vg.currentMultiple !== null ? (
              <p className="mt-1">
                Multiple range {formatMultiple(vg.lowMultiple)}–{formatMultiple(vg.highMultiple)}; current position {formatMultiple(vg.currentMultiple)}.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
