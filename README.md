# Helicon Argos (v0.0)

An exception console for composite manufacturing, built from a 19,519-event
production log. Argos turns the raw event stream into connected current-state
objects (jobs, cycles, inspections, machines, alerts) and one investigation
workflow:

> **Needs-attention queue → alert evidence → job / machine detail → affected work**

Every derived number on every screen drills down to raw `event_id`s, and every
derived relationship is badged as such — source truth is never overwritten.

## Live app

**https://helicon-argos-collinmcgregors-projects.vercel.app**

Access password: `argos-demo-2026` (this is a work-trial demo; the password in
the README is deliberate). The signed-in demo user is an admin.

## Demo path

Two suggested walks through the console:

1. **The degrading press** — open the `press_03` alert on the overview →
   machine detail (cycle-time trend, zero maintenance on record) → affected
   jobs → `job_0152` timeline → traced material `lot_6626`.
2. **The late money** — overview → overdue tile ($590K) → jobs explorer,
   filtered to overdue incomplete jobs.

## The five findings the console surfaces (all computed, none hand-written)

1. **Quality is systemic, not asset-local** — the 46% in-process inspection fail
   rate is flat across all presses, tools, materials, facilities, and weeks;
   `voids` leads defects in all 8 materials → look at the shared cure/vacuum/
   debulk step, not a machine.
2. **press_03 is silently degrading** — median cycle 1,294s, 25% above fleet and
   rising, with zero maintenance on record.
3. **$590K of order value is late** — 26 overdue incomplete jobs (price coverage
   disclosed: 150/312 jobs carry estimates).
4. **Work is stranded on tooling** — `missing_tool` causes 28 of 68 blocks; 9
   jobs are blocked/held right now.
5. **Traceability works end to end** — `job_0152` is blocked *and* lot-scanned:
   alert → timeline → `lot_6626` → material → customer (honest caveat: 14/312
   jobs have lot scans).

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16 (App Router, React Server Components, TypeScript), Tailwind CSS v4, custom "Laminate" design system (light + dark themes) |
| Backend | Next.js server components + route handlers on Vercel; all SQL behind typed query modules (`lib/queries/*`) |
| Database | Supabase Postgres — raw immutable `events` table + derived views (`jobs_current`, `cycles`, `machine_stats`, `alerts`…) + versioned `ontology_*` config tables; bulk `psql \copy` ingest |
| Auth | Deliberate minimal password gate in Next.js middleware (`APP_PASSWORD` env var, cookie session) — per the brief's "basic auth password"; no user accounts by design |
| Testing | Three layers — SQL validation gates (`npm run validate`), exact-value query tests + route smoke tests (vitest), `npm run check` as the single ship gate; plus an independent JSONL recompute audit (0 mismatches) |
| Deploy | Vercel (functions pinned to `pdx1`, same region as the database) |

The clock is frozen to the event horizon (`2026-08-13T23:06:33Z`,
`lib/constants.ts` / `frozen_now()` in SQL) so "overdue" stays meaningful on a
historical dataset.

## Run it locally

```bash
cp .env.example .env.local   # fill in DATABASE_URL, SUPABASE_*, APP_PASSWORD
npm install
npm run ingest               # one command: schema + bulk \copy load + derived views
npm run validate             # 18 hard asserts: counts, $590,465, press_03, QC guard
npm run dev
```

`npm run check` = validate + vitest (query + smoke layers) + `next build` —
the ship gate used throughout the build.

### Environment variables (`.env.example`)

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Supabase pooler connection string. On Vercel use port **6543** (transaction mode); locally use port **5432** (session mode). |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase key. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `APP_PASSWORD` | Password for the middleware gate (the live demo uses `argos-demo-2026`). |

## Repo tour

```
supabase/schema.sql       tables + derived views (jobs_current, cycles, machine_stats, alerts…)
scripts/ingest.sh         repeatable JSONL → Postgres bulk load
scripts/validate.sql      layer-1 data gates (run: npm run validate)
lib/queries/*.ts          the only code that touches SQL; typed domain results
app/                      overview · jobs explorer · job detail · machine detail · alerts · /admin/ontology
components/               "Laminate" kit: panels, badges, ply bars, timeline, tiles
docs/                     product plan, design system, data contract, per-page specs
tests/                    query-layer exact-value tests + route smoke tests
```

`/admin/ontology` edits versioned semantic configuration (objects, fields,
relationships with observed/derived/external provenance) and renders the
read-only ontology map from it — configuration changes never touch source
events.

An independent audit recomputed every headline number straight from the JSONL
(no shared code with the SQL layer) and matched the UI exactly, 0 mismatches.
