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
- Theming (retheme): light "paper/bone" is the default; dark overrides live under
  `:root[data-theme='dark']` in `app/globals.css` — any new color token must be defined in
  BOTH blocks (both hold ≥4.5:1 AA for text on bg-0..3; keep it that way). The attribute is
  set pre-paint by the inline script in `app/layout.tsx` (`argos-theme` in localStorage);
  `components/ThemeToggle.tsx` holds no theme state — its active segment is styled from
  `html[data-theme]` in globals.css. Never hardcode a hex in components; use `--color-*`.

## Page queries & tests (W1)

- Two working patterns for testing a `server-only` data path: overview passes the postgres
  `Sql` client as each query function's first argument (DI; `lib/queries/overview.ts`);
  jobs imports `lib/db.ts` directly and its test does `vi.mock('server-only', () => ({}))`,
  importing `tests/helpers` *before* the module (dotenv must run before db init) and
  `.end()`ing both clients in `afterAll` (`tests/queries/jobs.test.ts`).
- postgres.js rows: timestamptz columns come back as `Date` objects, `count(*)`/`sum()` as
  strings — convert at the query-module boundary.
- Smoke sections: `npm run check` runs vitest *before* `next build`, so no server exists
  during the gate. overview gates HTTP checks on `SMOKE_BASE_URL` (`describe.runIf`) and
  rechecks render inputs via SQL; jobs boots its own `next dev` on a task-unique port in
  `beforeAll` (honoring `SMOKE_BASE_URL` when set) and retries fetches because transient
  pooler auth timeouts (EAUTHTIMEOUT) can stream an error fallback.
- The Supabase session pool is 15: don't run `npm run check` while a local `next start` is
  up (EMAXCONNSESSION).
- `notFound()` on a streamed page still returns HTTP 200 — assert body content, not status.
  SSR splits JSX interpolations with `<!-- -->`; never assert a string crossing a `{value}`
  boundary.
- Extra named exports from a `page.tsx` fail Next's page-export typecheck — put shared page
  helpers in a sibling non-route file (e.g. `app/jobs/format.ts`).
- Overview alert selection is URL state: `/?alert=<alert_id>` re-renders the Selected
  investigation panel server-side (rows link there, not to their destinations).
## Ontology Control (W1-admin)

- `ontology_*` config tables are append-only by convention: edit/archive INSERT a new
  version linked via `prior_version_id` (never UPDATE/DELETE); "current" = latest version
  per key (`DISTINCT ON (key) … ORDER BY key, version DESC`), archived = latest version
  has `status='archived'`. `lib/queries/ontology.ts` is the only writer.
- Map node record counts come from `recordCounts()`'s fixed allowlist keyed by
  `source_mapping` (`APPROVED_SOURCES` in the same file); an unknown mapping renders a
  ghost node, so a new approved source must be added in both places.
- `tests/queries/ontology.test.ts` writes rows keyed `w1admin_test_*` to the shared DB and
  deletes them in before/afterAll; `validate.sql` uses `>=` counts so leftovers can't break
  it, but keep test keys prefixed.

## Display layer (W2 polish-display)

- Everything user-visible formats through `lib/display.ts`: entity ids
  (press_03 → "Press 3", la_01 → "LA 1", job_0276 → "0276", cust_x → title case), snake
  labels, seconds → minutes (`formatMinutes`), and Pacific-time dates
  (`EVENT_HORIZON_DISPLAY`, `formatDate`/`formatStamp` — date-only strings format in UTC so
  the calendar day never shifts). `humanizeText()` prettifies query-built prose (alert
  copy) at render. Raw `evt_*` ids are the audit key — never prettified — and URLs/query
  params stay raw (`/jobs/job_0276`, `?facility=la_01`); smoke markers rely on both.
- Native `<select>` is banned in UI (OS-styled popup): use `components/Listbox.tsx` —
  controlled (value/onChange) for URL-state filters, form mode (name/defaultValue renders a
  hidden input) inside server-action forms.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
