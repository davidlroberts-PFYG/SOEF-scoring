'use client';

import { useMemo, useState } from 'react';
import type { FactorAttribution } from '@/engine';
import { formatCurrency, formatPct } from '@/lib/format';

type SortKey = 'order' | 'label' | 'rating' | 'pointsLost' | 'gap';

export function FactorTable({
  rows,
  showGap,
  title,
}: {
  rows: (FactorAttribution & { sortOrder: number; hint: string | null })[];
  showGap: boolean;
  title: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('order');
  const [dir, setDir] = useState<1 | -1>(1);

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      let v = 0;
      switch (sortKey) {
        case 'order':
          v = a.sortOrder - b.sortOrder;
          break;
        case 'label':
          v = a.label.localeCompare(b.label);
          break;
        case 'rating':
          v = (a.rating ?? 0) - (b.rating ?? 0);
          break;
        case 'pointsLost':
          v = a.pointsLost - b.pointsLost;
          break;
        case 'gap':
          v = (a.gapAttributed ?? 0) - (b.gapAttributed ?? 0);
          break;
      }
      return v * dir;
    });
    return list;
  }, [rows, sortKey, dir]);

  const toggle = (k: SortKey) => {
    if (k === sortKey) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setDir(k === 'order' || k === 'label' ? 1 : -1);
    }
  };

  const Th = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th className={right ? 'text-right' : ''}>
      <button type="button" onClick={() => toggle(k)} className="inline-flex items-center gap-1 hover:text-navy">
        {children}
        {sortKey === k ? <span aria-hidden>{dir === 1 ? '▲' : '▼'}</span> : null}
      </button>
    </th>
  );

  return (
    <div className="card overflow-x-auto p-0">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-base font-bold">{title}</h3>
        <p className="text-xs text-ink-soft">Click a column to sort</p>
      </div>
      <table className="table">
        <thead>
          <tr>
            <Th k="order">#</Th>
            <Th k="label">Factor</Th>
            <Th k="rating" right>
              Rating
            </Th>
            <Th k="pointsLost" right>
              Points lost
            </Th>
            {showGap ? (
              <>
                <Th k="gap" right>
                  Share
                </Th>
                <Th k="gap" right>
                  Est. gap attributed
                </Th>
              </>
            ) : null}
            <th>Advisor note</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.factorId}>
              <td className="text-ink-soft">{r.sortOrder}</td>
              <td>
                <p className="font-semibold text-navy">{r.label}</p>
                {r.hint ? <p className="text-xs text-ink-soft">{r.hint}</p> : null}
              </td>
              <td className="text-right font-semibold">{r.rating ?? '—'}</td>
              <td className="text-right">{r.pointsLost}</td>
              {showGap ? (
                <>
                  <td className="text-right text-ink-soft">{formatPct(r.share)}</td>
                  <td className="text-right font-semibold">{r.gapAttributed === null ? '—' : formatCurrency(r.gapAttributed)}</td>
                </>
              ) : null}
              <td className="max-w-xs whitespace-pre-wrap text-xs text-ink-soft">{r.note ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
