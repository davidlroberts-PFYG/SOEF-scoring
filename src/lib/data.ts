import 'server-only';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { assessments, bands, factors, owners, ratingKey, ratings, scorecards, sectors } from '@/db/schema';
import {
  buildAssessmentResult,
  type AssessmentInput,
  type AssessmentResult,
  type BandDef,
  type FactorDef,
  type FactorRatingInput,
  type RatingKeyEntry,
  type ScorecardMeta,
  type SectorInput,
} from '@/engine';
import { toNumber } from '@/lib/format';

export interface EngineConfig {
  scorecards: ScorecardMeta[];
  factors: FactorDef[];
  bands: BandDef[];
  ratingKey: RatingKeyEntry[];
}

/** Scorecards, active factors, bands, and rating key — config as data. */
export async function getEngineConfig(): Promise<EngineConfig> {
  const db = getDb();
  const [scRows, fRows, bRows, rkRows] = await Promise.all([
    db.select().from(scorecards),
    db
      .select({
        id: factors.id,
        scorecardId: factors.scorecardId,
        sortOrder: factors.sortOrder,
        label: factors.label,
        hint: factors.hint,
        weight: factors.weight,
        active: factors.active,
      })
      .from(factors)
      .where(eq(factors.active, true))
      .orderBy(asc(factors.sortOrder)),
    db.select().from(bands).orderBy(asc(bands.band)),
    db.select().from(ratingKey).orderBy(asc(ratingKey.value)),
  ]);
  const keyById = new Map(scRows.map((s) => [s.id, s.key]));
  return {
    scorecards: scRows.map((s) => ({ key: s.key, name: s.name, maxPerFactor: s.maxPerFactor })),
    factors: fRows.flatMap((f) => {
      const key = keyById.get(f.scorecardId);
      if (!key) return [];
      return [
        {
          id: f.id,
          scorecardKey: key,
          sortOrder: f.sortOrder,
          label: f.label,
          hint: f.hint,
          weight: toNumber(f.weight) ?? 1,
        },
      ];
    }),
    bands: bRows.map((b) => ({ band: b.band, label: b.label, minPct: b.minPct, maxPct: b.maxPct })),
    ratingKey: rkRows.map((r) => ({ value: r.value, label: r.label, description: r.description })),
  };
}

export async function listSectors(includeInactive = false) {
  const rows = await getDb()
    .select()
    .from(sectors)
    .where(includeInactive ? undefined : eq(sectors.active, true))
    .orderBy(asc(sectors.sortOrder), asc(sectors.name));
  return rows.map(toSectorView);
}

export type SectorView = ReturnType<typeof toSectorView>;

export function toSectorView(s: typeof sectors.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    naicsPrefix: s.naicsPrefix,
    lowMultiple: toNumber(s.lowMultiple),
    highMultiple: toNumber(s.highMultiple),
    medianMultiple: toNumber(s.medianMultiple),
    basis: s.basis,
    rangeKind: s.rangeKind,
    sourceNote: s.sourceNote,
    sourceUrl: s.sourceUrl,
    methodNote: s.methodNote,
    lastReviewed: s.lastReviewed,
    sortOrder: s.sortOrder,
    active: s.active,
    hasMultiples: toNumber(s.lowMultiple) !== null && toNumber(s.highMultiple) !== null,
  };
}

export function toSectorInput(s: SectorView | null): SectorInput | null {
  if (!s) return null;
  return {
    id: s.id,
    name: s.name,
    lowMultiple: s.lowMultiple,
    highMultiple: s.highMultiple,
    medianMultiple: s.medianMultiple,
    basis: s.basis,
    rangeKind: s.rangeKind,
    sourceNote: s.sourceNote,
    sourceUrl: s.sourceUrl,
    methodNote: s.methodNote,
    lastReviewed: s.lastReviewed,
  };
}

export type AssessmentRow = typeof assessments.$inferSelect;
export type OwnerRow = typeof owners.$inferSelect;

export function toAssessmentInput(a: AssessmentRow): AssessmentInput {
  return {
    assessedAt: a.assessedAt,
    status: a.status,
    revenueTtm: toNumber(a.revenueTtm),
    earnings: toNumber(a.earnings),
    earningsBasis: a.earningsBasis,
    ownerCompAddback: toNumber(a.ownerCompAddback),
    ownerValueEstimate: toNumber(a.ownerValueEstimate),
    overrideLowMultiple: toNumber(a.overrideLowMultiple),
    overrideHighMultiple: toNumber(a.overrideHighMultiple),
    overrideBasis: a.overrideBasis,
    overrideNote: a.overrideNote,
  };
}

export async function getOwner(advisorId: string, ownerId: string) {
  const row = await getDb().query.owners.findFirst({
    where: and(eq(owners.id, ownerId), eq(owners.advisorId, advisorId)),
    with: { sector: true },
  });
  if (!row) return null;
  return { ...row, sector: row.sector ? toSectorView(row.sector) : null };
}

export async function listAssessmentsForOwner(ownerId: string) {
  return getDb()
    .select()
    .from(assessments)
    .where(eq(assessments.ownerId, ownerId))
    .orderBy(desc(assessments.assessedAt), desc(assessments.createdAt));
}

export async function getRatingsForAssessment(assessmentId: string): Promise<FactorRatingInput[]> {
  const rows = await getDb()
    .select({ factorId: ratings.factorId, rating: ratings.rating, note: ratings.note })
    .from(ratings)
    .where(eq(ratings.assessmentId, assessmentId));
  return rows.map((r) => ({ factorId: r.factorId, rating: r.rating, note: r.note }));
}

export interface AssessmentBundle {
  assessment: AssessmentRow;
  owner: OwnerRow;
  sector: SectorView | null;
  ratings: FactorRatingInput[];
  config: EngineConfig;
  /** Live result (always computed from current data). */
  live: AssessmentResult;
  /** What to display: the frozen snapshot for a released assessment, else live. */
  result: AssessmentResult;
  fromSnapshot: boolean;
}

/** Everything a dashboard, form, or PDF needs for one assessment. Scoped to the advisor. */
export async function getAssessmentBundle(
  advisorId: string,
  assessmentId: string,
): Promise<AssessmentBundle | null> {
  const db = getDb();
  const a = await db.query.assessments.findFirst({
    where: and(eq(assessments.id, assessmentId), eq(assessments.advisorId, advisorId)),
    with: { owner: { with: { sector: true } } },
  });
  if (!a) return null;
  const [config, ratingRows] = await Promise.all([getEngineConfig(), getRatingsForAssessment(a.id)]);
  const sector = a.owner.sector ? toSectorView(a.owner.sector) : null;
  const live = buildAssessmentResult({
    assessment: toAssessmentInput(a),
    sector: toSectorInput(sector),
    scorecards: config.scorecards,
    factors: config.factors,
    ratings: ratingRows,
    bands: config.bands,
    ratingKey: config.ratingKey,
  });
  const snapshot = a.status === 'released' ? parseSnapshot(a.snapshotJson) : null;
  const { owner: ownerWithSector, ...assessmentOnly } = a;
  const { sector: _s, ...owner } = ownerWithSector;
  void _s;
  return {
    assessment: assessmentOnly,
    owner,
    sector,
    ratings: ratingRows,
    config,
    live,
    result: snapshot ?? live,
    fromSnapshot: snapshot !== null,
  };
}

function parseSnapshot(value: unknown): AssessmentResult | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<AssessmentResult>;
  if (v.version !== 1 || !v.business || !v.personal || !v.valueGap) return null;
  return v as AssessmentResult;
}

export interface ClientListRow {
  owner: OwnerRow;
  sectorName: string | null;
  latest: {
    id: string;
    assessedAt: string;
    status: 'draft' | 'released';
    businessPct: number;
    personalPct: number;
    valueGap: number | null;
    valuationStatus: string;
  } | null;
  assessmentCount: number;
}

/** Clients list: each owner with their most recent assessment's headline numbers. */
export async function listClients(advisorId: string): Promise<ClientListRow[]> {
  const db = getDb();
  const ownerRows = await db.query.owners.findMany({
    where: eq(owners.advisorId, advisorId),
    with: { sector: true, assessments: { orderBy: [desc(assessments.assessedAt), desc(assessments.createdAt)] } },
    orderBy: [asc(owners.companyName)],
  });
  const latestIds = ownerRows.flatMap((o) => (o.assessments[0] ? [o.assessments[0].id] : []));
  const ratingRows = latestIds.length
    ? await db
        .select({ assessmentId: ratings.assessmentId, factorId: ratings.factorId, rating: ratings.rating })
        .from(ratings)
        .where(inArray(ratings.assessmentId, latestIds))
    : [];
  const config = latestIds.length ? await getEngineConfig() : null;
  const byAssessment = new Map<string, FactorRatingInput[]>();
  for (const r of ratingRows) {
    const list = byAssessment.get(r.assessmentId) ?? [];
    list.push({ factorId: r.factorId, rating: r.rating });
    byAssessment.set(r.assessmentId, list);
  }

  return ownerRows.map((o) => {
    const { sector, assessments: list, ...owner } = o;
    const latestRow = list[0];
    let latest: ClientListRow['latest'] = null;
    if (latestRow && config) {
      const snapshot = latestRow.status === 'released' ? parseSnapshot(latestRow.snapshotJson) : null;
      const result =
        snapshot ??
        buildAssessmentResult({
          assessment: toAssessmentInput(latestRow),
          sector: toSectorInput(sector ? toSectorView(sector) : null),
          scorecards: config.scorecards,
          factors: config.factors,
          ratings: byAssessment.get(latestRow.id) ?? [],
          bands: config.bands,
          ratingKey: config.ratingKey,
        });
      latest = {
        id: latestRow.id,
        assessedAt: latestRow.assessedAt,
        status: latestRow.status,
        businessPct: result.business.readinessPct,
        personalPct: result.personal.readinessPct,
        valueGap: result.valueGap.valueGap,
        valuationStatus: result.valueGap.status,
      };
    }
    return {
      owner,
      sectorName: sector?.name ?? null,
      latest,
      assessmentCount: list.length,
    };
  });
}
