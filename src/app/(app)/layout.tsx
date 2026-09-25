import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { getDisclosure } from '@/lib/settings';
import { logoutAction } from '@/app/login/actions';
import { DisclosureFooter } from '@/components/DisclosureFooter';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const disclosure = await getDisclosure();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print bg-navy text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/clients" className="flex items-baseline gap-3">
            <span className="font-heading text-lg font-bold text-white">Value Gap Dashboard</span>
            <span className="hidden text-xs font-semibold uppercase tracking-widest text-orange sm:inline">
              Secure On Every Front
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/clients" className="rounded px-3 py-1.5 hover:bg-white/10">
              Clients
            </Link>
            <Link href="/settings" className="rounded px-3 py-1.5 hover:bg-white/10">
              Settings
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="rounded px-3 py-1.5 text-white/80 hover:bg-white/10" title={session.email}>
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
      <DisclosureFooter text={disclosure.text} />
    </div>
  );
}
