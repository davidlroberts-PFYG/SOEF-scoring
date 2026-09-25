# CLAUDE.md

Guidance for Claude Code sessions working in this repository.

## What this is

**Value Gap Dashboard** — an advisor tool for Plan For Your Goals, LLC (public brand: Secure On Every Front). An advisor grades a business owner's company on two scorecards (Business Readiness, 22 factors; Personal Readiness, 11 factors), each factor 1–6, then positions the business inside its sector's range of value and shows the estimated dollar gap to a best-in-class company at the same earnings.

**Everything this tool outputs is an estimate.** It is not a business appraisal, valuation opinion, or offer to purchase, and the UI and PDF must say so (see Compliance below).

## Commands

```bash
npm run dev              # dev server at localhost:3000
npm test                 # vitest: engine math, PDF footer, forbidden-copy grep
npm run typecheck        # tsc --noEmit
npm run lint             # eslint .
npm run build            # next build (fails on type or lint errors)
npm run db:generate      # drizzle-kit: generate a migration from src/db/schema.ts
npm run db:migrate       # apply ./drizzle migrations to DATABASE_URL
npm run db:seed          # idempotent seed from content/seed/*.json
npm run db:setup         # migrate + seed
npm run vercel-build     # what Vercel runs: migrate + seed + next build
npm run hash-password -- 'pw'   # scrypt hash for ADMIN_PASSWORD_HASH
```

Local Postgres: `DATABASE_URL=postgres://postgres@localhost:5432/value_gap` in `.env.local`. Scripts load `.env.local` then `.env`.

## Architecture

```
ratings + financials + sector ──▶ src/engine (pure TS, no React/Next/DB) ──▶ AssessmentResult
                                                                                │
                                              dashboard page ◀──────────────────┼──▶ PDF (src/pdf, @react-pdf/renderer)
                                              release snapshot (assessments.snapshot_json) ◀┘
```

- `src/engine/buildResult.ts` — `buildAssessmentResult()` is the single orchestrator. Dashboard, clients list, PDF, and release snapshot all call it. There is exactly one definition of a result.
- `src/engine/**` must never import React, Next, or the database (ESLint `no-restricted-imports` enforces this). Tests run against it with plain fixtures from `content/seed`.
- `src/lib/data.ts` — server-only reads; converts Postgres `numeric` strings to numbers and assembles engine inputs. `getAssessmentBundle()` returns both `live` (always recomputed) and `result` (frozen snapshot if released, else live).
- `src/actions/*.ts` — server actions for mutations (autosave ratings/financials, release/reopen, settings).
- Config is data: factors, weights, rating key, bands, sectors, disclosure, and brand live in DB tables seeded from `content/seed/*.json`. Do not add these as code constants.
- Auth (MVP): single admin, signed JWT cookie (`src/lib/auth.ts`, `src/middleware.ts`). Callers only ever use `getSession()`/`requireSession()`, so Auth.js / magic links can replace `login()` in Phase 2 without touching pages.

## Scoring math (spec Section 5)

```
total_rating  = Σ rating_i × weight_i
max_rating    = Σ 6 × weight_i          # 132 business, 66 personal at default weights
readiness_pct = total_rating / max_rating
```
- Percent is rounded to the nearest whole number **before** banding: 88/132 = 66.67% → 67% → band 4.
- Unrated factors contribute 0 to the total but still count toward the max (running total on a partial worksheet).
- Bands (inclusive whole-percent): 1 Poor or Non-Existent 0–17 · 2 Needs Improvement 18–33 · 3 Slightly Below Average 34–50 · 4 Slightly Above Average 51–67 · 5 Best-in-Class 68–83 · 6 Industry Leader ("The Standard") 84–100.
- Combined Readiness = (business_total + personal_total) / (business_max + personal_max). Always shown beside, never instead of, the two component scores.

Acceptance: all business factors 4 → 88/132 → 67% "Slightly Above Average"; all personal factors 3 → 33/66 → 50% "Slightly Below Average". Both are unit tests.

## Value Gap engine (spec Section 6)

```
current_multiple    = low + (high − low) × business_readiness_pct   # business pct ONLY
best_in_class_mult  = high
current_value       = earnings × current_multiple
best_in_class_value = earnings × high
value_gap           = best_in_class_value − current_value

points_lost_i    = (6 − rating_i) × weight_i
share_i          = points_lost_i / Σ points_lost
gap_attributed_i = value_gap × share_i        # allocation, not a prediction
```
- Personal readiness never enters the formula; it is displayed beside the gap.
- Multiples come from `sectors` unless the assessment has an override (`override_low_multiple`, `override_high_multiple`, required `override_note`). The override wins.
- Guards: earnings ≤ 0 → status `no_earnings`, show scores and multiple range but **no dollar values**, message "Valuation requires positive normalized earnings." Sector without multiples → status `no_multiples`, block the valuation panel and prompt for an override. Inverted/non-positive multiples → `invalid_multiples`.
- Display rounding (`roundDisplayValue`): nearest $1,000 below $1M, nearest $10,000 at or above. Engine keeps unrounded numbers so attributions sum to the gap.
- Acceptance: low 3.0×, high 6.0×, EBITDA $500,000, business pct 50% → 4.5×, $2,250,000, $3,000,000, gap $750,000 (unit test).
- **Seed sectors have blank multiples on purpose** with a "SOURCE NEEDED" note. Never invent authoritative multiples. The advisor populates them from a licensed data source; `source_note` and `last_reviewed` are displayed beside every valuation figure and on the PDF.
- On release, the full `AssessmentResult` is frozen into `assessments.snapshot_json` so a released report never changes when benchmarks or weights are edited later. Reopening discards the snapshot.

## Compliance, disclosures, IP (spec Section 8) — do not skip

- Plan For Your Goals, LLC is a **State of Florida Registered Investment Adviser**. David may be described as a **fiduciary** but **never "fee-only."** `tests/copy/forbidden-copy.test.ts` greps `src/`, `content/`, `public/` for that phrase; the disclosure editor also rejects it.
- The **Securian / FINRA / SIPC** disclosure printed on the paper worksheets does not apply and must not appear anywhere (also grep-tested).
- The default disclosure (in `content/seed/settings.json`, editable in Settings) must appear in the dashboard footer and on **every page** of the PDF. `tests/pdf/report.test.tsx` renders the PDF and checks every page.
- **IP flag for David, not for Claude Code to resolve:** factor labels/hints are adapted from Exit Planning Institute worksheets. Before public or paid release, confirm permission with EPI or reword them. They are seed data and editable in Settings → Factors, so rewording is a data change. Do not use EPI's name, logo, or "Value Acceleration Methodology" marks in the UI.
- Client financials are sensitive: no analytics on financial fields, no third-party AI calls containing client financials in MVP.

## Technical conventions (spec Section 9)

- Next.js 15 App Router, TypeScript strict, Tailwind 4 (tokens in `src/app/globals.css`: navy `#0A1F33`, orange `#DA5B36`, Montserrat headings, Roboto body via `next/font`).
- Postgres via Drizzle ORM + `pg` (works with Neon / Vercel Postgres pooled connection strings and local Postgres). Schema in `src/db/schema.ts`, migrations in `drizzle/`.
- PDF: `@react-pdf/renderer`, server-side in `src/app/(app)/assessments/[assessmentId]/report/route.ts` (Node runtime; `serverExternalPackages` in `next.config.ts`).
- Charts: plain SVG (`Gauge.tsx`, `RangeBar.tsx`).
- Derived values are computed on read, never stored, except the release snapshot.
- Phase 2 hooks already in the data model: `advisor_id`/`owner_id` everywhere, `assessments.status`, `owners.email`.

## Open items for David (spec Section 12)

1. Transaction-multiple data source and whether its license permits client-facing display.
2. EPI permission or rewording of factor text.
3. EBITDA vs SDE default (Settings → Defaults has the switch and an informational SDE revenue threshold).
4. Whether Personal Readiness should gate anything (currently display-only).
5. `am-i-bankable` uses no ORM (Upstash Redis) and no PDF library (print CSS), so this repo chose Drizzle + @react-pdf/renderer.
