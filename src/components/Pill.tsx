import type { BandDef } from '@/engine';

const BAND_CLASSES: Record<number, string> = {
  1: 'bg-danger-soft text-danger',
  2: 'bg-danger-soft text-danger',
  3: 'bg-warn-soft text-warn',
  4: 'bg-warn-soft text-warn',
  5: 'bg-ok-soft text-ok',
  6: 'bg-ok-soft text-ok',
};

export function BandPill({ band }: { band: BandDef | null }) {
  if (!band) return <span className="pill bg-canvas text-ink-soft">Not scored</span>;
  return <span className={`pill ${BAND_CLASSES[band.band] ?? 'bg-canvas text-ink-soft'}`}>{band.label}</span>;
}

export function StatusPill({ status }: { status: 'draft' | 'released' }) {
  return status === 'released' ? (
    <span className="pill bg-navy text-white">Released</span>
  ) : (
    <span className="pill bg-canvas text-ink-soft">Draft</span>
  );
}
