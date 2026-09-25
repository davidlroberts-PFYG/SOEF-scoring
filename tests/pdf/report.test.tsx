import { describe, expect, it } from 'vitest';
import { buildAssessmentResult, buildNarrative } from '@/engine';
import { renderReportPdf } from '@/pdf/render';
import settingsSeed from '@content/seed/settings.json';
import { bands, businessFactors, factors, personalFactors, rateAll, ratingKey, scorecards } from '../fixtures/seed';

async function extractPages(buffer: Buffer): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, disableFontFace: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((it) => ('str' in it ? it.str : '')).join(' '));
  }
  return pages;
}

const disclosure = settingsSeed.disclosure.text;
const brand = settingsSeed.brand;

function makeResult(overrides: { earnings?: number | null; multiples?: [number | null, number | null] } = {}) {
  return buildAssessmentResult({
    assessment: {
      assessedAt: '2026-09-01',
      status: 'draft',
      revenueTtm: 3_000_000,
      earnings: overrides.earnings === undefined ? 500_000 : overrides.earnings,
      earningsBasis: 'EBITDA',
      ownerValueEstimate: null,
      overrideLowMultiple: null,
      overrideHighMultiple: null,
      overrideNote: null,
    },
    sector: {
      id: 's1',
      name: 'Professional Services',
      lowMultiple: overrides.multiples ? overrides.multiples[0] : 3,
      highMultiple: overrides.multiples ? overrides.multiples[1] : 6,
      basis: 'EBITDA',
      sourceNote: 'Advisor experience (test)',
      lastReviewed: '2026-06-01',
    },
    scorecards,
    factors,
    ratings: [
      ...businessFactors.map((f, i) => ({ factorId: f.id, rating: ((i * 5) % 6) + 1, note: i === 0 ? 'Brand refresh underway' : null })),
      ...rateAll(personalFactors, 3),
    ],
    bands,
    ratingKey,
  });
}

describe('PDF report', () => {
  it('renders and every page carries the disclosure footer', async () => {
    const result = makeResult();
    const pdf = await renderReportPdf({
      result,
      narrative: buildNarrative(result, 'Acme Fabrication'),
      companyName: 'Acme Fabrication',
      ownerName: 'Pat Example',
      advisorName: 'David Roberts',
      disclosure,
      brand,
      generatedAt: new Date('2026-09-25T12:00:00Z'),
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const pages = await extractPages(pdf);
    expect(pages.length).toBeGreaterThanOrEqual(3);
    for (const [i, text] of pages.entries()) {
      const norm = text.replace(/\s+/g, ' ');
      expect(norm, `page ${i + 1} missing disclosure`).toContain('not a business appraisal');
      expect(norm, `page ${i + 1} missing firm`).toContain('Plan For Your Goals, LLC');
      expect(norm, `page ${i + 1} missing page number`).toMatch(/Page \d+ of \d+/);
    }
    const all = pages.join(' ');
    expect(all).toContain('Acme Fabrication');
    expect(all).toContain('Best-in-class minus current');
    expect(all).toContain('Biggest levers');
    expect(all).toContain('Advisor experience (test)');
    expect(all).not.toMatch(/fee[\s-]*only/i);
    expect(all).not.toMatch(/Securian|FINRA|SIPC/);
  });

  it('shows the no-earnings message instead of dollar values when earnings are zero', async () => {
    const result = makeResult({ earnings: 0 });
    const pdf = await renderReportPdf({
      result,
      narrative: buildNarrative(result, 'Zero Co'),
      companyName: 'Zero Co',
      ownerName: 'Owner',
      advisorName: 'Advisor',
      disclosure,
      brand,
      generatedAt: new Date(),
    });
    const all = (await extractPages(pdf)).join(' ').replace(/\s+/g, ' ');
    expect(all).toContain('Valuation requires positive normalized earnings');
    expect(all).not.toContain('Current estimated value');
    expect(all).not.toContain('$');
  });
});
