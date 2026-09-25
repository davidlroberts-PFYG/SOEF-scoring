import { createOwnerAction } from '@/actions/owners';
import { requireSession } from '@/lib/auth';
import { listSectors } from '@/lib/data';
import { OwnerForm } from '@/components/OwnerForm';
import { PageHeader } from '@/components/PageHeader';

export default async function NewClientPage() {
  await requireSession();
  const sectors = await listSectors();
  return (
    <>
      <PageHeader backHref="/clients" backLabel="Clients" eyebrow="Clients" title="New client" />
      <OwnerForm action={createOwnerAction} sectors={sectors} submitLabel="Create client" />
    </>
  );
}
