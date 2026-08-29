# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Data layer (W0-A)

- Ingest is one command, `./scripts/ingest.sh`: drops/recreates everything in
  `supabase/schema.sql`, regenerates a complete TSV from `manufacturing_events.jsonl`
  (the repo CSV is missing 5 metadata columns), bulk-loads via `psql \copy`.
  `npm run validate` runs the Layer-1 asserts in `scripts/validate.sql` (fails nonzero).
- Sharp edge: `event_id` is NOT unique in the source JSONL — 19 duplicated ids
  (14 fully identical lines), incl. `job_0293`'s duplicate completion `evt_001862` x2.
  All 19,519 rows are preserved; `events.seq` is the physical-row key. Never PK on event_id.
- Frozen clock lives in one place: SQL function `frozen_now()` = `2026-08-13T23:06:33Z`.
  Use it in any new SQL; never `now()` in views.
- Inspection events carry QC-station ids (`qc_01`/`qc_02`) in `machine_id`; production-machine
  quality goes through `machine_quality_attribution` (job→cycle join, badge DERIVED in UI).
- Docs are authoritative for semantics: `docs/DATA-FLOWS.md` (definitions), `docs/ARGOS.md` §1
  (verified numbers), `docs/TESTING.md` (test layers and expected values).

## App shell & kit (W0-B)

- All UI composes the frozen Laminate kit in `components/*` (spec: `docs/ARGOS.md` §5);
  tokens live in `app/globals.css` `@theme` as `--color-*` Tailwind utilities
  (`bg-bg-2`, `text-text-muted`, `border-border`, `bg-status-warn-dim`, `font-mono`…).
  `/kitchen-sink` renders every component with static props (deleted in Wave 2).
- Frozen NOW for TypeScript: `NOW`/`NOW_ISO` in `lib/constants.ts` (SQL twin: `frozen_now()`).
- `lib/db.ts` is `server-only`; tests can't import it — use the client re-exported from
  `tests/helpers.ts`, which loads `.env.local` via dotenv (`@next/env` skips `.env.local`
  under vitest's `NODE_ENV=test`).
- The shell (NavRail/TopBar) keeps `?facility=` in the URL and forwards it on nav links;
  page queries must honor it. `tests/smoke/routes.test.ts` is append-only per task —
  add your section under your marked heading, never edit others'.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
