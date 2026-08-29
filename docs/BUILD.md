# BUILD — Requirements & Firstmate Crew Plan

How the 4-hour build is executed: hard requirements, the file-ownership contracts that make
parallel agents safe, and the wave-by-wave firstmate dispatch plan.

Companion docs: `ARGOS.md` (what & why, ranked features, data findings), `DESIGN.md`
(overarching design: IA, shell, cross-cutting rules) with per-page specs in `pages/*.md`,
`PLAN.md` (ontology rules), `TESTING.md` (test layers, layout, and the `npm run check` gate
every task ships against).

---

## 1. Build requirements

### Stack (decided, not revisitable mid-build)

- Next.js (App Router, TS) + Tailwind v4 · Supabase Postgres (data) · Vercel (deploy)
- No Supabase Auth. Password gate = Next.js middleware reading `APP_PASSWORD` env var.
- Server components query Postgres with the service-role key **server-side only**.

### Hard invariants (every task inherits these; violating one is a failed task)

1. `NOW = 2026-08-13T23:06:33Z` — a single exported constant in `lib/constants.ts`. No task
   ever calls the wall clock for business logic.
2. Never attribute inspections to `qc_01`/`qc_02` as production machines. Asset quality goes
   through the job→cycle join and is badged **derived** in the UI.
3. Every derived number must be drillable to `event_id`s.
4. Ingest is `psql \copy` from `manufacturing_events_table.csv` — never row-by-row supabase-js.
5. Design tokens and shared components come from Wave 0 and are **frozen**: page tasks consume
   them, never edit them (escalate to the first mate if a change is truly needed).
6. The vibe-code blacklist in `DESIGN.md`/`ARGOS.md §5` is review criteria.
7. Validation gates: after ingest, counts must equal 312 jobs / 12,965 cycles /
   5,153 inspections / 19,519 events. No UI work on unvalidated counts.
8. **Tests ship with the code, per `TESTING.md`.** Every ship task ends with
   `npm run check` green in its worktree (`validate.sql` + vitest query/smoke tests +
   `next build`). Merge authority is mechanical: check green + ownership map respected.
   No `.skip`, no flaky tests merged — with a static dataset, any flake is a real bug.
9. TDD-lite ordering: the failing assertion for a page's headline numbers (already known —
   `ARGOS.md §1`) is written before the page that renders them.

### Environment / secrets

- Supabase project created by the captain before dispatch; `DATABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` (gitignored) and in
  Vercel env vars. Crewmates get read access via the checked-in `.env.example` names only.
- All crewmates hit the **same** Supabase instance (it's read-only product data; no collision).

### Repo layout contract (the merge-safety map)

```
app/layout.tsx, app/globals.css      Wave 0B (frozen after)
components/*                         Wave 0B (frozen after)
lib/constants.ts, lib/db.ts,
lib/types.ts                         Wave 0B (frozen after)
supabase/schema.sql, scripts/ingest*,
scripts/validate.sql                 Wave 0A (frozen after)
tests/helpers.ts, vitest.config.ts   Wave 0B (frozen after)
lib/queries/overview.ts + app/page.tsx
  + tests/queries/overview.test.ts                         Task W1-overview
lib/queries/jobs.ts + app/jobs/**
  + tests/queries/jobs.test.ts                             Task W1-jobs   (explorer + detail)
lib/queries/machines.ts + app/machines/** (+ app/alerts)
  + tests/queries/machines.test.ts                         Task W1-machines
lib/queries/ontology.ts + app/admin/ontology/**
  + tests/queries/ontology.test.ts                          Task W1-admin
tests/smoke/routes.test.ts           shared, append-only sections per task; captain owns final
middleware.ts, README.md, vercel wiring                    Wave 2 (captain)
```

One owner per path. Per-page queries live in per-task files under `lib/queries/` precisely so
no two crewmates touch the same file. Cross-links between pages use the route map from
`DESIGN.md` — link to a route you don't own, never edit it.

---

## 2. Firstmate crew plan

Run the first mate from `~/firstmate` (`cd ~/firstmate && claude`). Register this repo as a
project in **`local-only` mode `+yolo`** — no PR ceremony, first mate fast-forward-merges
approved worktrees; four hours does not pay for the `no-mistakes` pipeline. Crewmates run in
treehouse worktrees, so parallel work never collides in the checkout — the layout contract
above is what keeps the *merges* trivial.

**Total: 7 tasks in 3 waves (6 ship + 1 scout).** More crew than this and coordination costs
exceed the parallelism gains in a 4-hour box.

### Wave 0 — foundation (two parallel ship tasks, after a 10-min captain scaffold)

Captain (or the first pre-task) scaffolds the bare Next.js app + commits, so both Wave 0 tasks
fork from a repo that builds. Then dispatch in parallel:

- **W0-A · data-foundation (ship, ~35 min)** — `supabase/schema.sql`, including versioned
  ontology configuration tables, ingest script via
  `\copy`, derived views (`jobs_current`, `cycles`, `inspections`, `machine_stats`, `alerts`),
  and `scripts/validate.sql` (TESTING.md layer 1: count gates + headline-number asserts +
  the no-QC-station invariant). Done = `npm run validate` green; alerts view returns the
  press_03/press_06/overdue/blocked rows described in `ARGOS.md §1`.
- **W0-B · app-shell (ship, ~40 min)** — Laminate tokens in `globals.css`, fonts, app shell
  (nav rail, top bar, weave texture), and the shared component kit: `Panel`, `SectionLabel`,
  `StatusBadge`, `AngleGlyph`, `PlyBar`, `KpiTile`, empty/skeleton states; `lib/constants.ts`,
  `lib/db.ts`, `lib/types.ts`; the test harness (`vitest.config.ts`, `tests/helpers.ts`,
  the `test` / `validate` / `check` npm scripts). Done = `/kitchen-sink` dev route rendering
  every component (deleted in Wave 2) and `npm run check` runs end to end. Include the ADMIN
  nav section/indicator but leave the route body to W1-admin.

Merge both to main before Wave 1 (the only serialization point that matters).

### Wave 1 — pages (four parallel ship tasks, ~40–50 min each)

Each task's prompt includes: its `pages/<page>.md` spec verbatim (plus `DESIGN.md` for shell
and cross-cutting rules), the invariants above, its
file-ownership row (code **and** test files), the relevant `ARGOS.md` insight moments to
hard-wire, and the TDD-lite ordering: failing query test first, page second, smoke entry last.

- **W1-overview** — `/`: 4 KPI tiles, facility-pulse strip (LA-01/LA-02 cards), needs-attention
  queue with selected-investigation panel, systemic-quality note. Must surface: $590K/26
  overdue, 9 blocked, press_03 + press_06 alerts, voids Pareto note. Tests:
  `tests/queries/overview.test.ts` asserting those exact values.
- **W1-jobs** — `/jobs` explorer (lean: status/facility/customer filters) + `/jobs/:jobId`
  evidence timeline (the non-negotiable page). Must make the `job_0152` → `lot_6626`
  traceability thread work — and its test proves the thread from the query layer.
- **W1-machines** — `/machines/:machineId` with the cycle-time trend chart (the one chart that
  matters) + derived failure attribution with caveat badge; optional thin `/alerts` list.
  Tests assert press_03 median > 1,250s and that attribution never contains a QC station.
- **W1-admin — Ontology Control (`/admin/ontology`)**: the admin route added in `DESIGN.md`.
  It persists semantic configuration only, never source events. Build a compact object/field/
  relationship master-detail editor with observed/derived/external provenance. Do not build a
  graph canvas, arbitrary SQL editor, or dynamic ingestion builder.

### Wave 2 — integration & delivery (captain + one scout)

- **Captain (first-mate-supervised, ~35 min):** merge Wave 1, wire cross-links, delete
  kitchen-sink, password middleware, Vercel deploy, README — then run the smoke suite against
  the **deployed** URL (`SMOKE_BASE_URL`, TESTING.md layer 3) and walk the demo path
  (alert → job_0152 → evidence; overview → press_03 → affected jobs).
- **W2-verify (scout, parallel with captain's deploy):** independently recompute the displayed
  headline numbers from the raw JSONL — a second implementation path, not reusing the SQL
  views — and diff against the running app; report discrepancies at `data/<id>/report.md`.
  This catches shared-logic bugs the unit tests can't, because those test the views against
  themselves.

### Timeline vs the ARGOS solo schedule

```
min   0–10   captain: scaffold + commit + register project + dispatch W0
min  10–50   W0-A ∥ W0-B
min  50–60   merge W0, dispatch W1
min  60–110  W1-overview ∥ W1-jobs ∥ W1-machines ∥ W1-admin
min 110–125  merge W1, dispatch W2-verify
min 125–160  captain: integration, middleware, deploy   ∥   W2-verify scout
min 160–180  fix verify findings, final commit, README polish
```

Parallelism buys ~60 min of slack vs the 240-min solo plan in `ARGOS.md §3` — spend it on the
checkpoints, not on new scope.

### Cut lines under crew failure

- A Wave 1 task stalls or ships broken → apply the ARGOS checkpoint rules in priority order:
  **Ontology Control dies first** (newest scope), then the machines page, then the explorer
  thins to a plain table; the job-detail timeline is never cut.
- Merge conflict appears → the layout contract was violated; the first mate resolves by
  reverting the non-owner's edit, not by hand-merging.
- Supabase itself misbehaves → fall back to reading a pre-materialized JSON summary generated
  by W0-A's script; pages consume `lib/queries/*` so the swap is contained.

### Prompt skeleton for every ship task

> Role, page/scope · owned paths (exclusive) · frozen paths (read-only) · the task's
> `pages/<page>.md` spec pasted verbatim + `DESIGN.md` shell/cross-cutting rules ·
> invariants 1–9 · the verified numbers this page must show · done-criteria incl.
> `npm run check` green · "do not touch anything outside your owned paths."
