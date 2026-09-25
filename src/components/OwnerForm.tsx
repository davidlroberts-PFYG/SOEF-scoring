'use client';

import { useActionState } from 'react';
import type { FormState } from '@/actions/owners';
import type { SectorView } from '@/lib/data';

export interface OwnerFormValues {
  name: string;
  email: string;
  companyName: string;
  sectorId: string;
  notes: string;
}

export function OwnerForm({
  action,
  sectors,
  initial,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  sectors: SectorView[];
  initial?: Partial<OwnerFormValues>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  return (
    <form action={formAction} className="card max-w-2xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="companyName">
            Company
          </label>
          <input id="companyName" name="companyName" required className="input" defaultValue={initial?.companyName ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="sectorId">
            Sector
          </label>
          <select id="sectorId" name="sectorId" className="input" defaultValue={initial?.sectorId ?? ''}>
            <option value="">— Select sector —</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.hasMultiples ? '' : ' (multiples not set)'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="name">
            Owner name
          </label>
          <input id="name" name="name" required className="input" defaultValue={initial?.name ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Owner email (optional)
          </label>
          <input id="email" name="email" type="email" className="input" defaultValue={initial?.email ?? ''} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="notes">
          Notes (advisor only)
        </label>
        <textarea id="notes" name="notes" rows={3} className="input" defaultValue={initial?.notes ?? ''} />
      </div>
      {state.error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
