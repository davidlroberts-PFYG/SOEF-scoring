import { requireSession } from '@/lib/auth';
import { getBrand, getDefaults, getDisclosure } from '@/lib/settings';
import { DisclosureEditor } from '@/components/settings/DisclosureEditor';

export const dynamic = 'force-dynamic';

export default async function DisclosureSettingsPage() {
  await requireSession();
  const [disclosure, brand, defaults] = await Promise.all([getDisclosure(), getBrand(), getDefaults()]);
  return <DisclosureEditor disclosure={disclosure} brand={brand} defaults={defaults} />;
}
