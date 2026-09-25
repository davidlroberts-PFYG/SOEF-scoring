import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';

const TABS = [
  { href: '/settings/sectors', label: 'Sector benchmarks' },
  { href: '/settings/factors', label: 'Factors & weights' },
  { href: '/settings/disclosure', label: 'Disclosure & brand' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader eyebrow="Settings" title="Settings" subtitle="Configuration lives in the database, not in code. Changes apply to draft assessments immediately; released assessments keep their frozen snapshot." />
      <nav className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="btn-ghost">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
