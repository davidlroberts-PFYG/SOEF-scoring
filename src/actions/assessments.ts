'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { assessments, owners, ratings, sectors } from '@/db/schema';
import { isValidRating } from '@/engine';
import { requireSession } from '@/lib/auth';
import { getAssessmentBundle, listAssessmentsForOwner } from '@/lib/data';
import { getDefaults } from '@/lib/settings';

export interface ActionResult {
  ok: boolean;
  error?: string;
  savedAt?: string;
}

async function ownedAssessment(assessmentId: string, advisorId: string) {
  return getDb().query.assessments.findFirst({
    where: and(eq(assessments.id, assessmentId), eq(assessments.advisorId, advisorId)),
  });
}

/** Create a new dated assessment for an owner, optionally copying the previous ratings as a starting point. */
export async function createAssessmentAction(ownerId: string, copyFromLatest: boolean): Promise<void> {
  const session = await requireSession();
  const db = getDb();
  const owner = await db.query.owners.findFirst({
    where: and(eq(owners.id, ownerId), eq(owners.advisorId, session.advisorId)),
  });
  if (!owner) redirect('/clients');
  const defaults = await getDefaults();
  const previous = copyFromLatest ? (await listAssessmentsForOwner(ownerId))[0] : undefined;
  // New assessments default to the basis the client's sector multiples are expressed in.
  const sector = owner.sectorId ? await db.query.sectors.findFirst({ where: eq(sectors.id, owner.sectorId) }) : null;
  const defaultBasis = previous?.earningsBasis ?? sector?.basis ?? defaults.earningsBasis;

  const [created] = await db
    .insert(assessments)
    .values({
      ownerId,
      advisorId: session.advisorId,
      earningsBasis: defaultBasis,
      revenueTtm: previous?.revenueTtm ?? null,
      earnings: previous?.earnings ?? null,
      ownerCompAddback: previous?.ownerCompAddback ?? null,
      ownerValueEstimate: previous?.ownerValueEstimate ?? null,
      overrideLowMultiple: previous?.overrideLowMultiple ?? null,
      overrideHighMultiple: previous?.overrideHighMultiple ?? null,
      overrideBasis: previous?.overrideBasis ?? null,
      overrideNote: previous?.overrideNote ?? null,
    })
    .returning({ id: assessments.id });
  if (!created) redirect(`/clients/${ownerId}`);

  if (previous) {
    const prevRatings = await db.select().from(ratings).where(eq(ratings.assessmentId, previous.id));
    if (prevRatings.length) {
      await db.insert(ratings).values(
        prevRatings.map((r) => ({
          assessmentId: created.id,
          factorId: r.factorId,
          rating: r.rating,
          note: r.note,
        })),
      );
    }
  }
  revalidatePath(`/clients/${ownerId}`);
  redirect(`/assessments/${created.id}/edit`);
}

const ratingSchema = z.object({
  factorId: z.string().uuid(),
  rating: z.number().int().min(1).max(6).nullable(),
  note: z.string().max(4000).nullable(),
});

/** Autosave one factor's rating and/or note. Upsert keyed on (assessment, factor). */
export async function saveRatingAction(
  assessmentId: string,
  input: { factorId: string; rating: number | null; note: string | null },
): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = ratingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid rating' };
  if (parsed.data.rating !== null && !isValidRating(parsed.data.rating)) {
    return { ok: false, error: 'Rating must be 1–6' };
  }
  const a = await ownedAssessment(assessmentId, session.advisorId);
  if (!a) return { ok: false, error: 'Assessment not found' };
  if (a.status === 'released') return { ok: false, error: 'Released assessments are read-only. Reopen it to edit.' };

  const now = new Date();
  const db = getDb();
  await db
    .insert(ratings)
    .values({ assessmentId, factorId: parsed.data.factorId, rating: parsed.data.rating, note: parsed.data.note, updatedAt: now })
    .onConflictDoUpdate({
      target: [ratings.assessmentId, ratings.factorId],
      set: { rating: parsed.data.rating, note: parsed.data.note, updatedAt: now },
    });
  await db.update(assessments).set({ updatedAt: now }).where(eq(assessments.id, assessmentId));
  return { ok: true, savedAt: now.toISOString() };
}

const moneyField = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) => {
    if (v === null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  });

const financialsSchema = z
  .object({
    title: z.string().trim().max(200).nullable(),
    assessedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    revenueTtm: moneyField,
    earnings: moneyField,
    earningsBasis: z.enum(['EBITDA', 'SDE']),
    ownerCompAddback: moneyField,
    ownerValueEstimate: moneyField,
    useOverride: z.boolean(),
    overrideLowMultiple: moneyField,
    overrideHighMultiple: moneyField,
    overrideBasis: z.enum(['EBITDA', 'SDE']).nullable(),
    overrideNote: z.string().trim().max(2000).nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.ownerCompAddback !== null && v.ownerCompAddback < 0) {
      ctx.addIssue({ code: 'custom', message: 'Owner compensation add-back must be zero or positive.' });
    }
    if (v.useOverride) {
      if (v.overrideLowMultiple === null || v.overrideHighMultiple === null) {
        ctx.addIssue({ code: 'custom', message: 'Override requires both a low and a high multiple.' });
      } else if (v.overrideLowMultiple <= 0 || v.overrideHighMultiple < v.overrideLowMultiple) {
        ctx.addIssue({ code: 'custom', message: 'Override multiples must be positive and high ≥ low.' });
      }
      if (!v.overrideNote) {
        ctx.addIssue({ code: 'custom', message: 'A note explaining the override is required.' });
      }
    }
  });

export type FinancialsInput = z.input<typeof financialsSchema>;

/** Autosave the Financials tab. */
export async function saveFinancialsAction(assessmentId: string, input: FinancialsInput): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = financialsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid financials' };
  const a = await ownedAssessment(assessmentId, session.advisorId);
  if (!a) return { ok: false, error: 'Assessment not found' };
  if (a.status === 'released') return { ok: false, error: 'Released assessments are read-only. Reopen it to edit.' };

  const d = parsed.data;
  const now = new Date();
  const numStr = (n: number | null) => (n === null ? null : String(n));
  await getDb()
    .update(assessments)
    .set({
      title: d.title || null,
      assessedAt: d.assessedAt,
      revenueTtm: numStr(d.revenueTtm),
      earnings: numStr(d.earnings),
      earningsBasis: d.earningsBasis,
      ownerCompAddback: numStr(d.ownerCompAddback),
      ownerValueEstimate: numStr(d.ownerValueEstimate),
      overrideLowMultiple: d.useOverride ? numStr(d.overrideLowMultiple) : null,
      overrideHighMultiple: d.useOverride ? numStr(d.overrideHighMultiple) : null,
      overrideBasis: d.useOverride ? d.overrideBasis : null,
      overrideNote: d.useOverride ? d.overrideNote : null,
      updatedAt: now,
    })
    .where(eq(assessments.id, assessmentId));
  revalidatePath(`/assessments/${assessmentId}`);
  return { ok: true, savedAt: now.toISOString() };
}

/**
 * Release: freeze the engine result as a snapshot so the report never changes
 * if the benchmark table or weights are edited later.
 */
export async function releaseAssessmentAction(assessmentId: string): Promise<void> {
  const session = await requireSession();
  const bundle = await getAssessmentBundle(session.advisorId, assessmentId);
  if (!bundle) redirect('/clients');
  const now = new Date();
  await getDb()
    .update(assessments)
    .set({
      status: 'released',
      releasedAt: now,
      snapshotJson: { ...bundle.live, assessment: { ...bundle.live.assessment, status: 'released' } },
      updatedAt: now,
    })
    .where(eq(assessments.id, assessmentId));
  revalidatePath(`/assessments/${assessmentId}`);
  revalidatePath(`/clients/${bundle.owner.id}`);
  redirect(`/assessments/${assessmentId}`);
}

/** Reopen a released assessment for editing; the frozen snapshot is discarded. */
export async function reopenAssessmentAction(assessmentId: string): Promise<void> {
  const session = await requireSession();
  const a = await ownedAssessment(assessmentId, session.advisorId);
  if (!a) redirect('/clients');
  await getDb()
    .update(assessments)
    .set({ status: 'draft', releasedAt: null, snapshotJson: null, updatedAt: new Date() })
    .where(eq(assessments.id, assessmentId));
  revalidatePath(`/assessments/${assessmentId}`);
  redirect(`/assessments/${assessmentId}/edit`);
}

export async function deleteAssessmentAction(assessmentId: string): Promise<void> {
  const session = await requireSession();
  const a = await ownedAssessment(assessmentId, session.advisorId);
  if (!a) redirect('/clients');
  await getDb().delete(assessments).where(eq(assessments.id, assessmentId));
  revalidatePath(`/clients/${a.ownerId}`);
  redirect(`/clients/${a.ownerId}`);
}
