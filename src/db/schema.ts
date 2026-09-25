import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  date,
} from 'drizzle-orm/pg-core';

/**
 * Data model (spec Section 9). Derived values — totals, percentages, bands,
 * current/best value, gap, per-factor attribution — are computed on read by
 * src/engine, never stored, EXCEPT `assessments.snapshot_json`, written once
 * at release so a released report never changes if the benchmark table or
 * weights are later edited.
 *
 * `advisor_id` and `owner_id` are present everywhere they will be needed for
 * Phase 2 (owner self-serve, multi-advisor) so that phase needs no migration.
 */

export const scorecardKeyEnum = pgEnum('scorecard_key', ['business', 'personal']);
export const earningsBasisEnum = pgEnum('earnings_basis', ['EBITDA', 'SDE']);
export const assessmentStatusEnum = pgEnum('assessment_status', ['draft', 'released']);

export const advisors = pgTable('advisors', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sectors = pgTable('sectors', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  naicsPrefix: text('naics_prefix'),
  lowMultiple: numeric('low_multiple', { precision: 8, scale: 3 }),
  highMultiple: numeric('high_multiple', { precision: 8, scale: 3 }),
  basis: earningsBasisEnum('basis').notNull().default('EBITDA'),
  sourceNote: text('source_note'),
  lastReviewed: date('last_reviewed'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const owners = pgTable(
  'owners',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    advisorId: uuid('advisor_id')
      .notNull()
      .references(() => advisors.id),
    name: text('name').notNull(),
    email: text('email'),
    companyName: text('company_name').notNull(),
    sectorId: uuid('sector_id').references(() => sectors.id),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('owners_advisor_idx').on(t.advisorId)],
);

export const scorecards = pgTable('scorecards', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: scorecardKeyEnum('key').notNull().unique(),
  name: text('name').notNull(),
  maxPerFactor: smallint('max_per_factor').notNull().default(6),
});

export const factors = pgTable(
  'factors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scorecardId: uuid('scorecard_id')
      .notNull()
      .references(() => scorecards.id),
    sortOrder: integer('sort_order').notNull(),
    label: text('label').notNull(),
    hint: text('hint'),
    weight: numeric('weight', { precision: 6, scale: 3 }).notNull().default('1.000'),
    active: boolean('active').notNull().default(true),
  },
  (t) => [uniqueIndex('factors_scorecard_sort_idx').on(t.scorecardId, t.sortOrder)],
);

export const ratingKey = pgTable('rating_key', {
  value: smallint('value').primaryKey(),
  label: text('label').notNull(),
  description: text('description'),
});

export const bands = pgTable('bands', {
  band: smallint('band').primaryKey(),
  label: text('label').notNull(),
  minPct: smallint('min_pct').notNull(),
  maxPct: smallint('max_pct').notNull(),
});

export const assessments = pgTable(
  'assessments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'cascade' }),
    advisorId: uuid('advisor_id')
      .notNull()
      .references(() => advisors.id),
    title: text('title'),
    assessedAt: date('assessed_at').notNull().default(sql`CURRENT_DATE`),
    status: assessmentStatusEnum('status').notNull().default('draft'),
    revenueTtm: numeric('revenue_ttm', { precision: 16, scale: 2 }),
    earnings: numeric('earnings', { precision: 16, scale: 2 }),
    earningsBasis: earningsBasisEnum('earnings_basis').notNull().default('EBITDA'),
    ownerValueEstimate: numeric('owner_value_estimate', { precision: 16, scale: 2 }),
    overrideLowMultiple: numeric('override_low_multiple', { precision: 8, scale: 3 }),
    overrideHighMultiple: numeric('override_high_multiple', { precision: 8, scale: 3 }),
    overrideNote: text('override_note'),
    /** Frozen engine result written at release time. */
    snapshotJson: jsonb('snapshot_json'),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('assessments_owner_idx').on(t.ownerId, t.assessedAt)],
);

export const ratings = pgTable(
  'ratings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),
    factorId: uuid('factor_id')
      .notNull()
      .references(() => factors.id),
    rating: smallint('rating'),
    note: text('note'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('ratings_assessment_factor_idx').on(t.assessmentId, t.factorId)],
);

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  valueJson: jsonb('value_json').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ownersRelations = relations(owners, ({ one, many }) => ({
  advisor: one(advisors, { fields: [owners.advisorId], references: [advisors.id] }),
  sector: one(sectors, { fields: [owners.sectorId], references: [sectors.id] }),
  assessments: many(assessments),
}));

export const assessmentsRelations = relations(assessments, ({ one, many }) => ({
  owner: one(owners, { fields: [assessments.ownerId], references: [owners.id] }),
  ratings: many(ratings),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
  assessment: one(assessments, { fields: [ratings.assessmentId], references: [assessments.id] }),
  factor: one(factors, { fields: [ratings.factorId], references: [factors.id] }),
}));

export const factorsRelations = relations(factors, ({ one }) => ({
  scorecard: one(scorecards, { fields: [factors.scorecardId], references: [scorecards.id] }),
}));
