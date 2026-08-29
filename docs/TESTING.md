# TESTING — Strategy & Layout

How Argos stays correct while being built by parallel agents in 4 hours. The principle:
**test the numbers, not the pixels.** A demo dies from a wrong join, not a misaligned badge —
so the test budget goes almost entirely to data correctness, in that order of value.

The dataset is a gift for testing: static, deterministic, fully profiled. Every headline
number is known in advance (see `ARGOS.md §1`), so tests assert **exact values against the
real database** — no mocks, no fixtures, no factories. If a test needs a mock, it's testing
the wrong layer.

---

## The three layers (and what we deliberately skip)

### Layer 1 — data validation (SQL, owned by W0-A)

`scripts/validate.sql`, run after ingest and re-runnable anytime (`npm run validate`).
Hard asserts (query returns a row named `FAIL ...` on any mismatch):

- Row counts: 19,519 events · 312 jobs · 12,965 cycles · 5,153 inspections · 14 lot scans.
- `jobs_current` status distribution: 281 completed · 15 in_progress · 9 blocked/held · 7 created.
- Alert view: exactly 26 overdue-incomplete jobs; revenue at risk ≈ $590,465 (±$1).
- press_03 median cycle in `machine_stats` > 1,250s; fleet band sanity (949–1,056s others).
- No `qc_01`/`qc_02` ever appears in any production-machine attribution column.
- Every derived row carries at least one supporting `event_id`.

**Gate:** Wave 1 does not dispatch until this passes. This file is the single source of truth
for "the data layer is right."

### Layer 2 — query unit tests (vitest, owned by each W1 task)

`tests/queries/<page>.test.ts`, one file per query module, same ownership as the module
(W1-overview owns `tests/queries/overview.test.ts`, etc.). They run against the live Supabase
(read-only, fast) and assert:

- Exact headline values the page will display: overdue count = 26, blocked = 9,
  fail rate = 46.3%, voids = 827, `job_0152` is blocked and linked to `lot_6626`.
- Shape/invariant checks: statuses come from the known enum; timestamps ≤ frozen `NOW`;
  yields ∈ [0,1]; machine attribution excludes QC stations; every alert has rule name,
  explanation, implicated IDs, and supporting `event_id`s.
- The demo path's data exists: press_03 alert row present, press_06 spike week present.

Write the assertion **before** wiring the page (TDD-lite: the test is the page's spec —
`ARGOS.md` already tells you the expected value, so the test costs one minute).

### Layer 3 — route smoke tests (vitest + fetch, owned by W1 tasks + captain)

`tests/smoke/routes.test.ts`: boot `next start`, fetch each route (including
`/admin/ontology`), assert HTTP 200 and that key strings appear in the HTML: `press_03`,
`$590K` (or the exact figure), `job_0152`, `BLOCKED`, the derived-badge label. Each W1 task adds its routes; the captain re-points the
same suite at the **deployed** URL in Wave 2 (`SMOKE_BASE_URL` env var) as the final
pre-submission check.

### Deliberately skipped (do not let a crewmate "improve" this)

- Component/snapshot/pixel tests, Storybook, visual regression — zero demo value in 4h.
- Playwright/browser e2e — the smoke layer covers routing + data for a fraction of the cost.
- Mocked-database tests — the real DB is deterministic and read-only; mocks only add drift.
- Coverage targets — coverage is not the goal; the ~25 assertions above are.

---

## Repo layout

```
scripts/validate.sql          Layer 1 (W0-A)
tests/queries/overview.test.ts   Layer 2 (W1-overview)
tests/queries/jobs.test.ts       Layer 2 (W1-jobs)
tests/queries/machines.test.ts   Layer 2 (W1-machines)
tests/queries/ontology.test.ts   Layer 2 (W1-admin: config CRUD round-trip, versioning,
                                 provenance enum, never touches event tables)
tests/smoke/routes.test.ts       Layer 3 (shared file, append-only sections per task,
                                 clearly marked; captain owns final form)
tests/helpers.ts                 W0-B (db client for tests, NOW re-export)
vitest.config.ts                 W0-B
```

`npm test` runs layers 2–3; `npm run validate` runs layer 1; `npm run check` runs both plus
`next build`. **`npm run check` green is the ship criterion for every task** — it replaces
"build green" everywhere in `BUILD.md`.

---

## Fast + good habits: the actual mechanics

Speed and rigor don't trade off here because the habits are chosen to be self-enforcing:

1. **Tests are the task spec.** Each dispatch prompt includes the exact expected numbers;
   the crewmate's first commit is the failing test, the last is `npm run check` green. No
   separate "QA phase" to compress later.
2. **Gates, not review.** Nobody reads crewmate diffs line-by-line mid-build; the merge
   authority is mechanical: `npm run check` green + ownership map respected. Human judgment
   is spent only at wave boundaries.
3. **One command.** If verifying takes more than `npm run check`, agents will skip it.
   W0-B wires the scripts; after that, discipline is free.
4. **No flaky, no skipped.** A `.skip` or intermittent test never merges — with a static
   dataset, any flake is a real bug (usually a wall-clock leak; see invariant 1).
5. **Commit per gate.** Coherent history comes from committing at green checkpoints, not from
   crafting messages: `w0-a: ingest + views, validate green`, `w1-jobs: explorer + detail,
   check green`. The evaluator reads the log as evidence of process.
6. **The scout is the audit.** W2-verify recomputes displayed numbers from the raw JSONL
   *independently of the SQL layer* — a second implementation path that catches shared-logic
   bugs the unit tests can't. Its report is the final sign-off artifact.
