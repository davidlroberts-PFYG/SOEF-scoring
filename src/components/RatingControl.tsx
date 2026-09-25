'use client';

import type { RatingKeyEntry } from '@/engine';

export function RatingControl({
  value,
  onChange,
  ratingKey,
  disabled,
  name,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  ratingKey: RatingKeyEntry[];
  disabled?: boolean;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={`Rating for ${name}`} className="flex items-center gap-1">
      {ratingKey.map((k) => {
        const selected = value === k.value;
        return (
          <button
            key={k.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            title={`${k.value} — ${k.label}${k.description ? `: ${k.description}` : ''}`}
            onClick={() => onChange(selected ? null : k.value)}
            className={`h-9 w-9 rounded-md border text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
              selected
                ? 'border-orange bg-orange text-white'
                : 'border-line bg-surface text-navy hover:border-navy disabled:hover:border-line'
            }`}
          >
            {k.value}
          </button>
        );
      })}
    </div>
  );
}
