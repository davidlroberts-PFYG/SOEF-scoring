'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveBrandAction, saveDefaultsAction, saveDisclosureAction } from '@/actions/settings';
import type { Brand, Defaults, Disclosure } from '@/lib/settings';

export function DisclosureEditor({ disclosure, brand, defaults }: { disclosure: Disclosure; brand: Brand; defaults: Defaults }) {
  const router = useRouter();
  const [text, setText] = useState(disclosure.text);
  const [b, setB] = useState(brand);
  const [d, setD] = useState(defaults);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const run = (key: string, fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const res = await fn();
      setMsg((m) => ({ ...m, [key]: res.ok ? 'Saved' : (res.error ?? 'Error') }));
      if (res.ok) router.refresh();
    });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card space-y-3">
        <h2 className="text-base font-bold">Disclosure text</h2>
        <p className="text-xs text-ink-soft">Shown in the footer of every dashboard page and on every page of the PDF. Plan For Your Goals, LLC is a State of Florida Registered Investment Adviser; the firm may be described as a fiduciary but never as fee-only.</p>
        <textarea className="input" rows={9} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-ink-soft">{msg.disclosure}</span>
          <button type="button" className="btn-primary" disabled={pending} onClick={() => run('disclosure', () => saveDisclosureAction(text))}>
            Save disclosure
          </button>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-base font-bold">Brand</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['firmName', 'Firm name'],
              ['brandName', 'Brand name'],
              ['advisorTitle', 'Advisor title'],
              ['reportTitle', 'Report title'],
              ['navy', 'Navy (hex)'],
              ['orange', 'Orange (hex)'],
            ] as [keyof Brand, string][]
          ).map(([k, label]) => (
            <div key={k}>
              <label className="label" htmlFor={`brand-${k}`}>
                {label}
              </label>
              <input id={`brand-${k}`} className="input" value={b[k]} onChange={(e) => setB((p) => ({ ...p, [k]: e.target.value }))} />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-ink-soft">{msg.brand}</span>
          <button type="button" className="btn-primary" disabled={pending} onClick={() => run('brand', () => saveBrandAction(b))}>
            Save brand
          </button>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-base font-bold">Defaults</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="def-basis">
              Default earnings basis for new assessments
            </label>
            <select id="def-basis" className="input" value={d.earningsBasis} onChange={(e) => setD((p) => ({ ...p, earningsBasis: e.target.value as 'EBITDA' | 'SDE' }))}>
              <option value="EBITDA">EBITDA</option>
              <option value="SDE">SDE</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="def-threshold">
              SDE revenue threshold (optional, informational)
            </label>
            <input
              id="def-threshold"
              className="input"
              inputMode="decimal"
              placeholder="e.g. 2000000"
              value={d.sdeRevenueThreshold ?? ''}
              onChange={(e) => setD((p) => ({ ...p, sdeRevenueThreshold: e.target.value === '' ? null : Number(e.target.value) }))}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-ink-soft">{msg.defaults}</span>
          <button type="button" className="btn-primary" disabled={pending} onClick={() => run('defaults', () => saveDefaultsAction(d))}>
            Save defaults
          </button>
        </div>
      </section>
    </div>
  );
}
