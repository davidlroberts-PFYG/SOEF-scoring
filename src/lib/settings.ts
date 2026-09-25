import 'server-only';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { settings } from '@/db/schema';
import settingsSeed from '@content/seed/settings.json';

export const disclosureSchema = z.object({ text: z.string().min(20) });
export const brandSchema = z.object({
  firmName: z.string().min(1),
  brandName: z.string().min(1),
  advisorTitle: z.string(),
  reportTitle: z.string().min(1),
  navy: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  orange: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export const defaultsSchema = z.object({
  earningsBasis: z.enum(['EBITDA', 'SDE']),
  sdeRevenueThreshold: z.number().nullable(),
});

export type Disclosure = z.infer<typeof disclosureSchema>;
export type Brand = z.infer<typeof brandSchema>;
export type Defaults = z.infer<typeof defaultsSchema>;

async function getSetting<T>(key: string, schema: z.ZodType<T>, fallback: T): Promise<T> {
  const row = await getDb().query.settings.findFirst({ where: eq(settings.key, key) });
  const parsed = schema.safeParse(row?.valueJson);
  return parsed.success ? parsed.data : fallback;
}

export function getDisclosure() {
  return getSetting('disclosure', disclosureSchema, settingsSeed.disclosure);
}
export function getBrand() {
  return getSetting('brand', brandSchema, settingsSeed.brand);
}
export function getDefaults() {
  return getSetting('defaults', defaultsSchema, settingsSeed.defaults as Defaults);
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await getDb()
    .insert(settings)
    .values({ key, valueJson: value })
    .onConflictDoUpdate({ target: settings.key, set: { valueJson: value, updatedAt: new Date() } });
}
