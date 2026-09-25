'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { advisors } from '@/db/schema';
import { clearSessionCookie, setSessionCookie } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';

export interface LoginState {
  error?: string;
}

function credentialsConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_EMAIL && (process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD),
  );
}

function checkPassword(password: string): boolean {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash) return verifyPassword(password, hash);
  // Plain-text fallback for local development only. Never set in production.
  const plain = process.env.ADMIN_PASSWORD;
  if (plain && process.env.NODE_ENV !== 'production') return password === plain;
  return false;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '');

  if (!credentialsConfigured()) {
    return { error: 'Admin login is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD_HASH.' };
  }
  const adminEmail = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  if (email !== adminEmail || !checkPassword(password)) {
    return { error: 'Email or password is incorrect.' };
  }

  const db = getDb();
  const name = process.env.ADMIN_NAME?.trim() || email;
  const [advisor] =
    (await db
      .insert(advisors)
      .values({ email, name })
      .onConflictDoUpdate({ target: advisors.email, set: { name } })
      .returning()) ?? [];
  const row = advisor ?? (await db.query.advisors.findFirst({ where: eq(advisors.email, email) }));
  if (!row) return { error: 'Could not create the advisor record.' };

  await setSessionCookie({ advisorId: row.id, email: row.email, name: row.name, role: 'advisor' });
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/clients');
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect('/login');
}
