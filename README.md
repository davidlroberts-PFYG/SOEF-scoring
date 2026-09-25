# Value Gap Dashboard

Advisor tool for Plan For Your Goals, LLC (Secure On Every Front). Grade a business owner's company on Business Readiness (22 factors) and Personal Readiness (11 factors), position the business inside its sector's range of value, and show the estimated dollar gap to best-in-class — plus the five factors where most of that gap lives.

> Everything this tool produces is an **estimate**. It is not a business appraisal, valuation opinion, or offer to purchase. The required disclosure appears on every dashboard and on every page of the PDF.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind 4 · Drizzle ORM + Postgres (Neon / Vercel Postgres / local) · @react-pdf/renderer · Vitest. Deploys to Vercel.

## Local setup

```bash
npm install
cp .env.example .env.local        # fill in DATABASE_URL, AUTH_SECRET, ADMIN_*
npm run hash-password -- 'choose a password'   # paste into ADMIN_PASSWORD_HASH
npm run db:setup                  # migrate + seed (scorecards, bands, sectors, disclosure)
npm run dev                       # http://localhost:3000
```

For local development only, `ADMIN_PASSWORD=plaintext` works instead of the hash; it is ignored when `NODE_ENV=production`.

Local Postgres example: `createdb value_gap` then `DATABASE_URL=postgres://postgres@localhost:5432/value_gap`.

## First run checklist

1. Sign in with `ADMIN_EMAIL` and your password.
2. **Settings → Sector benchmarks**: every sector ships with blank multiples and a "SOURCE NEEDED" flag. Enter low/high multiples from a licensed data source (DealStats, BizBuySell Insight, Peercomps) or your own experience, with a source note and review date. The valuation panel stays blocked until a sector has multiples or the assessment has an override.
3. **Settings → Factors & weights**: weights default to 1.0 so totals match the paper worksheets (132 / 66). Labels and hints are editable here (see the IP note in `CLAUDE.md`).
4. **Settings → Disclosure & brand**: review the disclosure text. The editor rejects "fee-only".
5. Create a client, start an assessment, score the two tabs, enter financials, open the dashboard, export the PDF, and **Release** to freeze the result.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Engine math, PDF footer-on-every-page, forbidden-copy grep |
| `npm run typecheck` / `lint` | `tsc --noEmit` / `eslint .` |
| `npm run db:generate` | Generate a Drizzle migration from `src/db/schema.ts` |
| `npm run db:migrate` / `db:seed` / `db:setup` | Apply migrations / seed / both |
| `npm run hash-password -- 'pw'` | scrypt hash for `ADMIN_PASSWORD_HASH` |

## Deploy to Vercel

1. Create a Neon (or Vercel Postgres) database and copy the **pooled** connection string.
2. Import this repo into Vercel. Set env vars: `DATABASE_URL`, `AUTH_SECRET` (`openssl rand -base64 32`), `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD_HASH`.
3. Run migrations and seed once from your machine against the production URL: `DATABASE_URL=... npm run db:setup`.
4. Deploy. Smoke test with one fictional client.

## Project layout

```
content/seed/        factor lists, rating key, bands, sectors, disclosure (seed DATA, editable in Settings)
src/engine/          pure scoring + value-gap engine (no React/Next/DB) + narrative
src/db/              Drizzle schema, client, seed
src/lib/             auth, data access, settings, formatting
src/actions/         server actions (autosave, release, settings)
src/app/             routes: /login, /clients, /assessments/[id], /assessments/[id]/edit, /assessments/[id]/report, /settings/*
src/components/      gauges, range bar, editor, tables
src/pdf/             @react-pdf report document
tests/               vitest suites
```

See `CLAUDE.md` for the scoring math, value-gap formulas, compliance rules, and open items.
