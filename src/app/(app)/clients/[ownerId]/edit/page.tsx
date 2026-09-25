import { notFound } from 'next/navigation';
import { updateOwnerAction } from '@/actions/owners';
import { requireSession } from '@/lib/auth';
import { getOwner, listSectors } from '@/lib/data';
import { OwnerForm } from '@/components/OwnerForm';
import { PageHeader } from '@/components/PageHeader';

export default async function EditClientPage({ params }: { params: Promise<{ ownerId: string }> }) {
  const session = await requireSession();
  const { ownerId } = await params;
  const [owner, sectors] = await Promise.all([getOwner(session.advisorId, ownerId), listSectors(true)]);
  if (!owner) notFound();
  const action = updateOwnerAction.bind(null, owner.id);
  return (
    <>
      <PageHeader backHref={`/clients/${owner.id}`} backLabel={owner.companyName} eyebrow="Clients" title="Edit client" />
      <OwnerForm
        action={action}
        sectors={sectors.filter((s) => s.active || s.id === owner.sectorId)}
        submitLabel="Save changes"
        initial={{
          name: owner.name,
          email: owner.email ?? '',
          companyName: owner.companyName,
          sectorId: owner.sectorId ?? '',
          notes: owner.notes ?? '',
        }}
      />
    </>
  );
}
