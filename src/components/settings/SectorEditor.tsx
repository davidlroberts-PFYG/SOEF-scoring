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
  sourceNote: string;
  lastReviewed: string;
  active: boolean;
}

function toDraft(s?: SectorView): Draft {
  return {
    name: s?.name ?? '',
    naicsPrefix: s?.naicsPrefix ?? '',
    lowMultiple: s?.lowMultiple === null || s?.lowMultiple === undefined ? '' : String(s.lowMultiple),
    highMultiple: s?.highMultiple === null || s?.highMultiple === undefined ? '' : String(s.highMultiple),
    basis: s?.basis ?? 'EBITDA',
    sourceNote: s?.sourceNote ?? '',
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
    sourceNote: d.sourceNote || null,
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
            <th className="text-right">High ×</th>
            <th>Basis</th>
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
                <td className="text-right">{s.highMultiple ?? '—'}</td>
                <td>{s.basis}</td>
                <td className="max-w-xs text-xs">
                  {s.hasMultiples ? s.sourceNote : <span className="rounded bg-warn-soft px-1.5 py-0.5 font-semibold text-warn">SOURCE NEEDED</span>}
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
          <input className="input w-20 text-right" aria-label="High multiple" inputMode="decimal" value={draft.highMultiple} onChange={(e) => field('highMultiple', e.target.value)} />
        </td>
        <td>
          <select className="input" aria-label="Basis" value={draft.basis} onChange={(e) => field('basis', e.target.value as 'EBITDA' | 'SDE')}>
            <option>EBITDA</option>
            <option>SDE</option>
          </select>
        </td>
        <td>
          <textarea className="input min-w-48" rows={2} aria-label="Source note" placeholder="Data source / rationale" value={draft.sourceNote} onChange={(e) => field('sourceNote', e.target.value)} />
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
          <td colSpan={9} className="bg-danger-soft text-sm text-danger" role="alert">
            {error}
          </td>
        </tr>
      ) : null}
    </>
  );
}
