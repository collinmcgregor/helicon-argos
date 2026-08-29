# Helicon Argos (v0.0)

A digital factory twin for composite manufacturing

## Live app

**https://helicon-argos-collinmcgregors-projects.vercel.app**

password: `argos-demo-2026`

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16 (App Router, React Server Components, TypeScript), Tailwind CSS v4, custom "Laminate" design system (light + dark themes) |
| Backend | Next.js server components + route handlers on Vercel; all SQL behind typed query modules (`lib/queries/*`) |
| Database | Supabase Postgres — raw immutable `events` table + derived views (`jobs_current`, `cycles`, `machine_stats`, `alerts`…) + versioned `ontology_*` config tables; bulk `psql \copy` ingest |
| Auth | Deliberate minimal password gate in Next.js middleware (`APP_PASSWORD` env var, cookie session) — per the brief's "basic auth password"; no user accounts by design |
| Testing | Three layers — SQL validation gates (`npm run validate`), exact-value query tests + route smoke tests (vitest), `npm run check` as the single ship gate; plus an independent JSONL recompute audit (0 mismatches) |
| Deploy | Vercel (functions pinned to `pdx1`, same region as the database) |

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


