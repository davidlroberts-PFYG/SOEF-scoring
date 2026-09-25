'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveFactorAction } from '@/actions/settings';

interface FactorRow {
  id: string;
  sortOrder: number;
  label: string;
  hint: string | null;
  weight: number;
  active: boolean;
}

export function FactorEditor({ title, factors }: { title: string; factors: FactorRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(factors);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [, start] = useTransition();

  const update = (id: string, patch: Partial<FactorRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = (row: FactorRow) => {
    setStatus((s) => ({ ...s, [row.id]: 'Saving…' }));
    start(async () => {
      const res = await saveFactorAction(row.id, { label: row.label, hint: row.hint, weight: row.weight, active: row.active });
      setStatus((s) => ({ ...s, [row.id]: res.ok ? 'Saved' : (res.error ?? 'Error') }));
      if (res.ok) router.refresh();
    });
  };

  const maxPoints = rows.filter((r) => r.active).reduce((s, r) => s + 6 * r.weight, 0);

  return (
    <div className="card overflow-x-auto p-0">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-base font-bold">{title}</h2>
        <p className="text-xs text-ink-soft">
          Active factors: {rows.filter((r) => r.active).length} · Max points at current weights: {maxPoints}
        </p>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Label</th>
            <th>Hint</th>
            <th className="text-right">Weight</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="text-ink-soft">{r.sortOrder}</td>
              <td>
                <input className="input min-w-56" aria-label={`Label ${r.sortOrder}`} value={r.label} onChange={(e) => update(r.id, { label: e.target.value })} />
              </td>
              <td>
                <input className="input min-w-72" aria-label={`Hint ${r.sortOrder}`} value={r.hint ?? ''} onChange={(e) => update(r.id, { hint: e.target.value || null })} />
              </td>
              <td>
                <input
                  className="input w-24 text-right"
                  aria-label={`Weight ${r.sortOrder}`}
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={r.weight}
                  onChange={(e) => update(r.id, { weight: Number(e.target.value) })}
                />
              </td>
              <td>
                <input type="checkbox" aria-label={`Active ${r.sortOrder}`} checked={r.active} onChange={(e) => update(r.id, { active: e.target.checked })} />
              </td>
              <td className="whitespace-nowrap text-right">
                <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => save(r)}>
                  Save
                </button>
                <span className="ml-2 text-xs text-ink-soft">{status[r.id] ?? ''}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
