import { NextResponse } from 'next/server';
import { buildNarrative } from '@/engine';
import { requireSession } from '@/lib/auth';
import { getAssessmentBundle } from '@/lib/data';
import { getBrand, getDisclosure } from '@/lib/settings';
import { renderReportPdf } from '@/pdf/render';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const session = await requireSession();
  const { assessmentId } = await ctx.params;
  const bundle = await getAssessmentBundle(session.advisorId, assessmentId);
  if (!bundle) return new NextResponse('Not found', { status: 404 });
  const [disclosure, brand] = await Promise.all([getDisclosure(), getBrand()]);

  const pdf = await renderReportPdf({
    result: bundle.result,
    narrative: buildNarrative(bundle.result, bundle.owner.companyName),
    companyName: bundle.owner.companyName,
    ownerName: bundle.owner.name,
    advisorName: session.name,
    disclosure: disclosure.text,
    brand,
    generatedAt: new Date(),
  });

  const safeName = bundle.owner.companyName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'client';
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="value-gap-report-${safeName}-${bundle.assessment.assessedAt}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
