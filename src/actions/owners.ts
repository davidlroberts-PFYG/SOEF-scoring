'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { assessments, owners } from '@/db/schema';
import { requireSession } from '@/lib/auth';

const ownerSchema = z.object({
  name: z.string().trim().min(1, 'Owner name is required').max(200),
  email: z.string().trim().email().max(320).or(z.literal('')).transform((v) => (v === '' ? null : v)),
  companyName: z.string().trim().min(1, 'Company name is required').max(200),
  sectorId: z.string().uuid().or(z.literal('')).transform((v) => (v === '' ? null : v)),
  notes: z.string().trim().max(5000).transform((v) => (v === '' ? null : v)),
});

export interface FormState {
  error?: string;
  ok?: boolean;
}

function parseOwner(formData: FormData) {
  return ownerSchema.safeParse({
    name: formData.get('name') ?? '',
    email: formData.get('email') ?? '',
    companyName: formData.get('companyName') ?? '',
    sectorId: formData.get('sectorId') ?? '',
    notes: formData.get('notes') ?? '',
  });
}

export async function createOwnerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = parseOwner(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const [row] = await getDb()
    .insert(owners)
    .values({ ...parsed.data, advisorId: session.advisorId })
    .returning({ id: owners.id });
  if (!row) return { error: 'Could not create client' };
  revalidatePath('/clients');
  redirect(`/clients/${row.id}`);
}

export async function updateOwnerAction(
  ownerId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const parsed = parseOwner(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  await getDb()
    .update(owners)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(owners.id, ownerId), eq(owners.advisorId, session.advisorId)));
  revalidatePath('/clients');
  revalidatePath(`/clients/${ownerId}`);
  redirect(`/clients/${ownerId}`);
}

export async function deleteOwnerAction(ownerId: string): Promise<void> {
  const session = await requireSession();
  const db = getDb();
  // Ratings cascade from assessments; assessments cascade from owners.
  await db.delete(assessments).where(eq(assessments.ownerId, ownerId));
  await db.delete(owners).where(and(eq(owners.id, ownerId), eq(owners.advisorId, session.advisorId)));
  revalidatePath('/clients');
  redirect('/clients');
}
