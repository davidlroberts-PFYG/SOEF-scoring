'use server';

import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { factors, sectors } from '@/db/schema';
import { requireSession } from '@/lib/auth';
import { brandSchema, defaultsSchema, disclosureSchema, setSetting } from '@/lib/settings';

export interface SettingsResult {
  ok: boolean;
  error?: string;
}

const multiple = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) => {
    if (v === null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : Number.NaN;
  })
  .refine((v) => v === null || (Number.isFinite(v) && v > 0), 'Multiples must be positive numbers');

const sectorSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    naicsPrefix: z.string().trim().max(10).nullable(),
    lowMultiple: multiple,
    highMultiple: multiple,
    basis: z.enum(['EBITDA', 'SDE']),
    medianMultiple: multiple,
    rangeKind: z.enum(['median_range', 'quartile_range']),
    sourceNote: z.string().trim().max(2000).nullable(),
    sourceUrl: z.string().trim().url().max(500).or(z.literal('')).nullable(),
    methodNote: z.string().trim().max(4000).nullable(),
    lastReviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const one = v.lowMultiple !== null || v.highMultiple !== null;
    const both = v.lowMultiple !== null && v.highMultiple !== null;
    if (one && !both) ctx.addIssue({ code: 'custom', message: 'Enter both a low and a high multiple, or neither.' });
    if (both && v.highMultiple! < v.lowMultiple!) ctx.addIssue({ code: 'custom', message: 'High multiple must be ≥ low multiple.' });
    if (both && v.medianMultiple !== null && (v.medianMultiple < v.lowMultiple! || v.medianMultiple > v.highMultiple!)) {
      ctx.addIssue({ code: 'custom', message: 'Median multiple must fall between low and high.' });
    }
    if (both && !v.sourceNote) ctx.addIssue({ code: 'custom', message: 'A source note is required when multiples are populated.' });
  });

export type SectorInputData = z.input<typeof sectorSchema>;

export async function saveSectorAction(id: string | null, input: SectorInputData): Promise<SettingsResult> {
  await requireSession();
  const parsed = sectorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid sector' };
  const d = parsed.data;
  const values = {
    name: d.name,
    naicsPrefix: d.naicsPrefix || null,
    lowMultiple: d.lowMultiple === null ? null : String(d.lowMultiple),
    highMultiple: d.highMultiple === null ? null : String(d.highMultiple),
    basis: d.basis,
    medianMultiple: d.medianMultiple === null ? null : String(d.medianMultiple),
    rangeKind: d.rangeKind,
    sourceNote: d.sourceNote || null,
    sourceUrl: d.sourceUrl || null,
    methodNote: d.methodNote || null,
    lastReviewed: d.lastReviewed,
    active: d.active,
    updatedAt: new Date(),
  };
  const db = getDb();
  try {
    if (id) {
      await db.update(sectors).set(values).where(eq(sectors.id, id));
    } else {
      const [last] = await db.select({ max: sectors.sortOrder }).from(sectors).orderBy(desc(sectors.sortOrder)).limit(1);
      await db.insert(sectors).values({ ...values, sortOrder: (last?.max ?? 0) + 10 });
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error && /unique/i.test(err.message) ? 'A sector with that name already exists.' : 'Could not save sector.' };
  }
  revalidatePath('/settings/sectors');
  revalidatePath('/clients');
  return { ok: true };
}

const factorSchema = z.object({
  label: z.string().trim().min(1).max(200),
  hint: z.string().trim().max(500).nullable(),
  weight: z.number().min(0).max(10),
  active: z.boolean(),
});

export type FactorInputData = z.input<typeof factorSchema>;

export async function saveFactorAction(id: string, input: FactorInputData): Promise<SettingsResult> {
  await requireSession();
  const parsed = factorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid factor' };
  const d = parsed.data;
  await getDb()
    .update(factors)
    .set({ label: d.label, hint: d.hint || null, weight: d.weight.toFixed(3), active: d.active })
    .where(eq(factors.id, id));
  revalidatePath('/settings/factors');
  return { ok: true };
}

export async function saveDisclosureAction(text: string): Promise<SettingsResult> {
  await requireSession();
  const parsed = disclosureSchema.safeParse({ text: text.trim() });
  if (!parsed.success) return { ok: false, error: 'Disclosure text is too short.' };
  if (/fee[\s-]*only/i.test(parsed.data.text)) {
    return { ok: false, error: 'Disclosure may not describe the firm as fee-only.' };
  }
  await setSetting('disclosure', parsed.data);
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function saveBrandAction(input: unknown): Promise<SettingsResult> {
  await requireSession();
  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid brand settings' };
  await setSetting('brand', parsed.data);
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function saveDefaultsAction(input: unknown): Promise<SettingsResult> {
  await requireSession();
  const parsed = defaultsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid defaults' };
  await setSetting('defaults', parsed.data);
  return { ok: true };
}
