import Link from 'next/link';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  backHref,
  backLabel,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {backHref ? (
          <Link href={backHref} className="text-xs font-semibold text-ink-soft hover:text-navy">
            ← {backLabel ?? 'Back'}
          </Link>
        ) : null}
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-widest text-orange">{eyebrow}</p> : null}
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle ? <div className="mt-1 text-sm text-ink-soft">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
