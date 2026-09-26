'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveSectorAction, type SectorInputData } from '@/actions/settings';
import type { SectorView } from '@/lib/data';

interface Draft {
  name: string;
  naicsPrefix: string;
  lowMultiple: string;
  highMultiple: string;
  basis: 'EBITDA' | 'SDE';
  medianMultiple: string;
  rangeKind: 'median_range' | 'quartile_range';
  sourceNote: string;
  sourceUrl: string;
  methodNote: string;
  lastReviewed: string;
  active: boolean;
}

function toDraft(s?: SectorView): Draft {
  return {
    name: s?.name ?? '',
    naicsPrefix: s?.naicsPrefix ?? '',
    lowMultiple: s?.lowMultiple === null || s?.lowMultiple === undefined ? '' : String(s.lowMultiple),
    highMultiple: s?.highMultiple === null || s?.highMultiple === undefined ? '' : String(s.highMultiple),
    basis: s?.basis ?? 'SDE',
    medianMultiple: s?.medianMultiple === null || s?.medianMultiple === undefined ? '' : String(s.medianMultiple),
    rangeKind: s?.rangeKind ?? 'median_range',
    sourceNote: s?.sourceNote ?? '',
    sourceUrl: s?.sourceUrl ?? '',
    methodNote: s?.methodNote ?? '',
    lastReviewed: s?.lastReviewed ?? '',
    active: s?.active ?? true,
  };
}

function toInput(d: Draft): SectorInputData {
  return {
    name: d.name,
    naicsPrefix: d.naicsPrefix || null,
    lowMultiple: d.lowMultiple || null,
    highMultiple: d.highMultiple || null,
    basis: d.basis,
    medianMultiple: d.medianMultiple || null,
    rangeKind: d.rangeKind,
    sourceNote: d.sourceNote || null,
    sourceUrl: d.sourceUrl || null,
    methodNote: d.methodNote || null,
    lastReviewed: d.lastReviewed || null,
    active: d.active,
  };
}

export function SectorEditor({ sectors }: { sectors: SectorView[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(toDraft());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const begin = (s?: SectorView) => {
    setEditing(s?.id ?? 'new');
    setDraft(toDraft(s));
    setError(null);
  };

  const save = () => {
    start(async () => {
      const res = await saveSectorAction(editing === 'new' ? null : editing, toInput(draft));
      if (!res.ok) setError(res.error ?? 'Save failed');
      else {
        setEditing(null);
        router.refresh();
      }
    });
  };

  const field = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="card overflow-x-auto p-0">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-base font-bold">Sector benchmark table</h2>
        <button type="button" className="btn-primary text-xs" onClick={() => begin()}>
          + Add sector
        </button>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Sector</th>
            <th>NAICS</th>
            <th className="text-right">Low ×</th>
            <th className="text-right">Median ×</th>
            <th className="text-right">High ×</th>
            <th>Basis</th>
            <th>Top of range</th>
            <th>Source note</th>
            <th>Last reviewed</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {editing === 'new' ? <EditRow draft={draft} field={field} save={save} cancel={() => setEditing(null)} pending={pending} error={error} /> : null}
          {sectors.map((s) =>
            editing === s.id ? (
              <EditRow key={s.id} draft={draft} field={field} save={save} cancel={() => setEditing(null)} pending={pending} error={error} />
            ) : (
              <tr key={s.id} className={s.active ? '' : 'opacity-50'}>
                <td className="font-semibold text-navy">{s.name}</td>
                <td className="text-ink-soft">{s.naicsPrefix ?? '—'}</td>
                <td className="text-right">{s.lowMultiple ?? '—'}</td>
                <td className="text-right text-ink-soft">{s.medianMultiple ?? '—'}</td>
                <td className="text-right">{s.highMultiple ?? '—'}</td>
                <td>{s.basis}</td>
                <td className="text-xs">{s.rangeKind === 'quartile_range' ? 'Best-in-class (top quartile)' : 'Median range'}</td>
                <td className="max-w-xs text-xs">
                  {s.hasMultiples ? (
                    <>
                      {s.sourceUrl ? (
                        <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                          {s.sourceNote}
                        </a>
                      ) : (
                        s.sourceNote
                      )}
                      {s.methodNote ? <span className="mt-1 block text-ink-soft" title={s.methodNote}>Method: {s.methodNote.length > 90 ? `${s.methodNote.slice(0, 90)}…` : s.methodNote}</span> : null}
                    </>
                  ) : (
                    <>
                      <span className="rounded bg-warn-soft px-1.5 py-0.5 font-semibold text-warn">SOURCE NEEDED</span>
                      {s.sourceNote ? <span className="mt-1 block text-ink-soft">{s.sourceNote}</span> : null}
                    </>
                  )}
                </td>
                <td className="text-xs">{s.lastReviewed ?? '—'}</td>
                <td>{s.active ? 'Yes' : 'No'}</td>
                <td className="text-right">
                  <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => begin(s)}>
                    Edit
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function EditRow({
  draft,
  field,
  save,
  cancel,
  pending,
  error,
}: {
  draft: Draft;
  field: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
  save: () => void;
  cancel: () => void;
  pending: boolean;
  error: string | null;
}) {
  return (
    <>
      <tr className="bg-canvas">
        <td>
          <input className="input" aria-label="Sector name" value={draft.name} onChange={(e) => field('name', e.target.value)} />
        </td>
        <td>
          <input className="input w-20" aria-label="NAICS prefix" value={draft.naicsPrefix} onChange={(e) => field('naicsPrefix', e.target.value)} />
        </td>
        <td>
          <input className="input w-20 text-right" aria-label="Low multiple" inputMode="decimal" value={draft.lowMultiple} onChange={(e) => field('lowMultiple', e.target.value)} />
        </td>
        <td>
          <input className="input w-20 text-right" aria-label="Median multiple" inputMode="decimal" value={draft.medianMultiple} onChange={(e) => field('medianMultiple', e.target.value)} />
        </td>
        <td>
          <input className="input w-20 text-right" aria-label="High multiple" inputMode="decimal" value={draft.highMultiple} onChange={(e) => field('highMultiple', e.target.value)} />
        </td>
        <td>
          <select className="input" aria-label="Basis" value={draft.basis} onChange={(e) => field('basis', e.target.value as 'EBITDA' | 'SDE')}>
            <option>EBITDA</option>
            <option>SDE</option>
          </select>
        </td>
        <td>
          <select className="input" aria-label="Range kind" value={draft.rangeKind} onChange={(e) => field('rangeKind', e.target.value as 'median_range' | 'quartile_range')}>
            <option value="median_range">Median range</option>
            <option value="quartile_range">Top quartile</option>
          </select>
        </td>
        <td>
          <textarea className="input min-w-48" rows={2} aria-label="Source note" placeholder="Data source / rationale" value={draft.sourceNote} onChange={(e) => field('sourceNote', e.target.value)} />
          <input className="input mt-1 min-w-48" aria-label="Source URL" placeholder="https:// source link (optional)" value={draft.sourceUrl} onChange={(e) => field('sourceUrl', e.target.value)} />
          <textarea className="input mt-1 min-w-48" rows={2} aria-label="Method note" placeholder="How low/high were derived (optional)" value={draft.methodNote} onChange={(e) => field('methodNote', e.target.value)} />
        </td>
        <td>
          <input className="input" type="date" aria-label="Last reviewed" value={draft.lastReviewed} onChange={(e) => field('lastReviewed', e.target.value)} />
        </td>
        <td>
          <input type="checkbox" aria-label="Active" checked={draft.active} onChange={(e) => field('active', e.target.checked)} />
        </td>
        <td className="whitespace-nowrap text-right">
          <button type="button" className="btn-primary px-3 py-1 text-xs" disabled={pending} onClick={save}>
            {pending ? 'Saving…' : 'Save'}
          </button>{' '}
          <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={cancel}>
            Cancel
          </button>
        </td>
      </tr>
      {error ? (
        <tr>
          <td colSpan={11} className="bg-danger-soft text-sm text-danger" role="alert">
            {error}
          </td>
        </tr>
      ) : null}
    </>
  );
}
