import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { LoginForm } from './LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  if (session) redirect('/clients');
  const { next } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-navy p-6">
      <div className="w-full max-w-sm rounded-lg bg-surface p-8 shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-widest text-orange">Secure On Every Front</p>
        <h1 className="mt-1 text-2xl font-bold">Value Gap Dashboard</h1>
        <p className="mt-2 text-sm text-ink-soft">Advisor sign-in.</p>
        <LoginForm next={next ?? ''} />
      </div>
    </main>
  );
}
