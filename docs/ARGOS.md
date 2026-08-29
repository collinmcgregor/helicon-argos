# ARGOS — Build Document (v1)

The working document for the 4-hour Helicon work trial. It supersedes the ordering in
`PLAN.md`/`README.md` where they conflict; ontology and scope rules there still hold.
Everything below marked **verified** was computed directly from `manufacturing_events.jsonl`.

---

## 1. What the data actually says (verified)

These findings reshape the plan — several P0 assumptions in PLAN.md don't survive contact
with the data.

1. **There is no "bad asset" quality story.** Inspection failure rate is flat everywhere:
   45.8–47.0% across all six presses (attributed through the job→cycle join), 44–49% across
   tools, 45.6–47.5% across all 8 materials, both facilities, and every inspector — and flat
   week over week (47% → 45%). A "rank machines by failure rate" page demos as a wall of 46%s.
2. **The QC-station trap.** Inspection events carry `machine_id = qc_01/qc_02` — QC *stations*,
   not production machines — and no `tool_id`. Asset quality attribution must go through the
   job→cycle join and be labeled **derived** in the UI (this is also the chance to show off the
   derived-vs-raw-edge discipline from PLAN.md).
3. **The real asset signals are throughput, not quality:**
   - **press_03 — silent degradation.** Median cycle 1,294s vs a 949–1,056s fleet band
     (~25–35% slower), drifting +6% (1,243s → 1,322s first/second half), with **zero
     maintenance events recorded**. Alert text: *"press_03 median cycle 25% above fleet and
     rising; no maintenance recorded."*
   - **press_06 — acute spike with a paper trail.** Weekly median doubled 957s → 1,810s in the
     first week of August, immediately after a pressure `sensor_glitch` (Jul 24) and
     `maintenance_ping` (Jul 25) on that machine, then recovered. This is the
     signal → evidence → impact demo in one machine.
4. **$590K revenue at risk** — 26 jobs overdue and incomplete at frozen-now, valued at
   `unit_price_estimate × target_quantity`. Plus 9 jobs ending blocked/held.
5. **Blocks are a tooling problem:** `missing_tool` is the top block reason (28 of 68).
6. **Quality is systemic, not asset-local:** `voids` is the #1 defect (827, ~35% of failures)
   **in every one of the 8 materials** — pointing at a shared process step (cure/vacuum/debulk),
   not a machine. Scrap at completion is 8.8%; final yield on completed jobs is 91% despite the
   46% per-cycle inspection failure rate (inspections are per-cycle sampling, not final QC).
7. **Traceability thread:** `job_0152` is both terminally blocked *and* one of only 14
   lot-scanned jobs (`lot_6626`, carbon_fiber_epoxy) — a ready-made Job → Lot → Material →
   Customer click path. Caption honestly: lot coverage is 14 of 312 jobs.
8. **Frozen clock:** events span 2026-07-03 → 2026-08-13. Hardcode
   `NOW = 2026-08-13T23:06:33Z` as a single constant in minute 0, or every open job reads
   overdue and the risk model looks broken.

Object counts for validation after ingest: 19,519 events · 312 jobs · 12,965 cycles ·
5,153 inspections · 10 machines · 25 tools · 8 materials · 16 customers · 2 facilities.

---

## 2. Product spine

One workflow, built exceptionally:

```
Needs-attention queue → alert evidence → job / machine detail → affected work
```

The scripted second act is the **press_03 / press_06 cycle-time investigation**. Every other
page exists to feed or decorate that spine.

### Ontology (implemented shape — 6 tables/views, not 14)

`Event` stays the immutable source of truth; every derived number drills to `event_id`s.

| Table/view | Feeds |
| --- | --- |
| `events` (flattened metadata) | timelines, evidence drill-down |
| `jobs_current` (latest state + qtys + risk) | overview tiles, explorer, job detail, alerts |
| `cycles` | machine stats, timelines |
| `inspections` | defect Pareto, quality attribution |
| `machine_stats` (median cycle, drift, counts) | machine detail, cycle-time alert |
| `alerts` (view over the above) | needs-attention queue |

Person, Facility, Customer, Part are columns + GROUP BYs, not tables. Relationship rules from
PLAN.md apply verbatim: solid edges only for recorded facts; inspection→machine, tool→machine,
and all risk states are **derived** and badged as such in the UI.

---

## 3. Feature plan, ranked for the 240-minute box

| Rank | Feature | Est. | Verdict |
| --- | --- | ---: | --- |
| 1 | Ingest + 6 tables/views (use `psql \copy` from the existing CSV, **not** row-by-row supabase-js) | 45 min | Build first; validate counts before any UI |
| 2 | **Job detail / evidence timeline** | 40 min | Non-negotiable. If only one detail page ships, it's this |
| 3 | Ops overview: 4 stat tiles (active · blocked · overdue+$ at risk · fail rate) + needs-attention list | 35 min | Build. Tiles+list before any chart |
| 4 | Explainable alerts — **3 rules only**: overdue-incomplete, blocked/held, cycle-time-vs-baseline | 25 min | Build. Cut the per-asset quality rule (fires nothing — verified) and the generic asset-event rule |
| 5 | Job explorer (plain table; filters: status, facility, customer only) | 25 min | Build lean. No TanStack Table |
| 6 | Machine detail: cycle-time trend chart + derived failure attribution w/ caveat badge | 30 min | Build if on schedule at min 140 |
| 7 | Overview trend row (throughput + pass rate) + machine strip + derived action list | 25 min | Folded into W1-overview scope (`pages/overview.md`); its cuttable tail if that task runs long. The pass-rate chart's flatness *is* the systemic-quality evidence |
| 8 | Password gate + deploy + README | 35 min | Reserved; never cut |
| 9 | Ontology Control (`/admin/ontology`) — added after v1 of this doc | 40 min | Crew-plan scope only (`BUILD.md` W1-admin); viable because parallelism funds it. **First cut under schedule pressure.** Spec: `pages/ontology-control.md` |

Also added after v1: the overview facility-pulse strip (LA-01/LA-02 cards) — part of
W1-overview, spec in `pages/overview.md`.

### Ruthless cuts from the old P0

- **Supabase Auth entirely** → 15-line middleware password gate reading an env var (the brief
  asked for "basic auth password," not an identity system). Saves 30–45 min of churn.
- **Standalone asset-quality ranking page** → folded into one machine detail page reached from
  the press_03 alert (the ranking is flat — verified).
- Tool/lot pages, RLS ceremony, migrations ceremony, TanStack Table, 4 of 7 planned filters,
  sensor/maintenance alert rule, all of P1.

### Build sequence with checkpoints

```
min   0– 20  Scaffold Next.js, link Supabase, schema.sql, freeze NOW constant
min  20– 50  Ingest via \copy + derived views; validate counts (312 / 12,965 / 5,153)
min  50– 90  Ops overview: tiles + needs-attention list
min  90–140  Job explorer (thin) + job detail evidence timeline (thick)
min 140–175  Machine detail w/ cycle-time trend; wire press alerts → machine → affected jobs
min 175–200  Alert polish, drill-through links, empty/loading states
min 200–235  Password middleware, Vercel deploy, smoke-test demo path end to end
min 235–240  README + final commit
```

- **Min 45:** ingest not validated → drop `machine_stats`; compute in-page later. No UI on
  unvalidated counts.
- **Min 90:** overview incomplete → ship tiles + list; delete charts from scope permanently.
- **Min 140:** job detail not done → **cut the machine page**; the press story survives as an
  alert card whose explanation contains the numbers.
- **Min 200:** hard stop, deploy whatever exists. A deployed 3-page app beats an undeployed
  5-page app.

---

## 4. Demo script — five verified insight moments

1. **The exoneration.** "Your 46% failure rate is systemic, not a bad machine — press-by-press
   it's 45.8–47.0%, flat across tools, materials, facilities, weeks. Argos tells you where
   *not* to spend a maintenance shutdown." Then the defect Pareto: voids lead in all 8
   materials → shared process step (cure/vacuum/debulk), not an asset. The most senior-sounding
   30 seconds of the demo.
2. **press_03 is silently degrading** — 25% slower than fleet and rising, zero maintenance on
   record. (And press_06's acute spike traces to its Jul 24 sensor glitch — evidence chain
   included.)
3. **$590K behind 26 overdue jobs** — the money tile; works only because NOW is frozen.
4. **Work is stuck on missing tools** — 28 of 68 blocks; nine jobs currently stranded.
5. **The traceability thread** — blocked alert → `job_0152` timeline → `lot_6626` scan →
   observed Job → Lot → Material → Customer lineage, with the honest sparse-data caption:
   each of the 14 observed lots currently maps to one job, so this is lineage rather than a
   blast-radius claim.

**Do not** leave "find the bad tool live on stage" in the script — the discriminating signal
isn't there (verified). Script these five; they're all true.

---

## 5. Design system — "Laminate"

An operational console the color of cured carbon fiber: flat 1px-bordered layers (plies),
Foundry cobalt for interaction, **resin amber** as the identity accent. Dense,
monospace-forward, zero decoration. Composites identity comes from structure, not texture.

### Tokens (dark is the only theme; ~30 lines in `globals.css` `@theme`)

**Background plies:** `--bg-0 #0B0E12` page · `--bg-1 #10151B` shell · `--bg-2 #151B22`
panels · `--bg-3 #1A222B` hover/active · `--bg-inset #0D1116` ID wells & timeline gutter.

**Borders:** `--border #232C36` · `--border-strong #33404D` · `--border-faint #1A222B`.

**Text:** `--text-primary #E8EDF2` · `--text-secondary #9AA7B4` · `--text-muted #5C6B7A`.

**Accents:** `--accent #4C90F0` (cobalt — links, selection, focus, buttons) ·
`--accent-resin #E8A33D` (brand mark, active-nav tick, KPI emphasis — chrome only, never a
button fill).

**Status** (each with a 12% alpha `-dim` background; color never carries meaning alone —
always glyph + label): ok `#3FB950` · warn `#E8A33D` (deliberately = resin amber) ·
critical `#F0564A` · info `#4C90F0`.

**Chart series** (fixed order, CVD-validated): `#3987E5 #D95926 #199E70 #C98500 #D55181
#9085E9`. Quality charts may use ok/critical instead (state, not identity). Grid `#1A222B`,
axis text muted 11px mono.

### Typography

- **Inter** (400/500/600) for anything a human wrote; **IBM Plex Mono** (400/500,
  `tabular-nums`) for anything a machine emitted: IDs, timestamps, quantities, KPI values,
  numeric columns, defect codes.
- Page title 18/600 · small-caps section labels 11/600 `+0.08em` muted · body/cell 13 ·
  numeric/ID cells 12.5 mono · KPI value 28/500 mono · timestamps 11 mono muted · badges 11/500.

### Layout

- Fixed left nav rail 220px on `--bg-0`; wordmark `HELICON / ARGOS` with a resin-amber `⟋`
  glyph; active item gets `--bg-3` + **2px resin-amber left tick**; sections "OPERATE" /
  "INVESTIGATE". Top bar 48px with breadcrumb (mono IDs) + facility filter.
- 4px spacing base, 16px panel padding, 12px panel gaps. Panels: flat `--bg-2`, 1px border,
  **radius ≤ 2px, no shadows anywhere**; 36px headers with small-caps label left, mono count
  right. The page reads as an instrument cluster.
- Tables: sticky small-caps header, 36px rows, 1px faint separators (no zebra), numeric columns
  right-aligned mono, whole row clickable, hover `--bg-3`.

### Signature touches (<15 min each)

1. **Ply-stack yield bar** — yield rendered as thin 4px "plies" with 1px gaps (laminate
   cross-section): good ok-green, scrap critical-red, remaining `--bg-3`. Job table + job header.
2. **Fiber-angle status glyphs** — statuses are line segments at layup angles, not dots:
   ok `—` (0°), info `⟋` (45°), warn `∣` (90°), critical `✕` (crossed ±45°). One rotated SVG line.
3. **Weave header texture** — barely-visible twill via two repeating-linear-gradients on the
   top bar only. Never on data surfaces.
4. **Resin seam** — page titles sit above a 2px rule that's `--border` except the first 32px in
   resin amber; KPI tiles repeat it as a 2px top border in the metric's status color.

### Component rules

- **Badges:** 20px, 2px radius, glyph + UPPERCASE label, `-dim` background, status-color text,
  1px border at 25% alpha. No pills.
- **Alert rows:** 3px full-height left border in severity color · badge · rule name ·
  human explanation · implicated IDs as mono chips on `--bg-inset` · relative time right, mono.
  Whole row navigates to evidence.
- **Event timeline:** 24px gutter on `--bg-inset`, single 1px vertical line, 4px **square**
  nodes in status color; rows = fixed-width mono timestamp · event_type mono chip · summary ·
  muted `event_id` click-to-copy. 32px rows — it's a log, render it like one.
- **KPI tiles:** flat panel, 2px status-colored top border, small-caps label, 28px mono value,
  11px mono delta line. 4-up, ~84px tall, every tile links to a filtered list.
- **Empty states:** muted fiber-angle glyph + one secondary line + optional mono query context.
  No illustrations. **Loading:** `--bg-3` skeletons, opacity pulse only.

### The vibe-code blacklist

No gradients, glassmorphism, or shadows · radius ≤ 2px, no pills · no purple accents, no emoji ·
no hero sections, 48px+ headings, or `py-24` spacing · strip shadcn's default radius/shadow skin ·
no count-ups, confetti, or spring transitions (100ms opacity/background only) · never a
proportional font on numbers · never a dual-axis chart · never chart colors outside the series
order.

---

## 6. Risks / time-sinks (avoid on sight)

1. **Wall-clock NOW** — hardcode the frozen constant in minute 0.
2. **Row-by-row Supabase inserts** — 19.5k rows through supabase-js can eat 30 min; use
   `psql \copy` from `manufacturing_events_table.csv`.
3. **Auth/RLS churn** — email confirmation settings and default-deny RLS silently blanking
   server queries are 15-minute sinkholes each. Service-role key server-side + password
   middleware, done.
4. **Over-modeling** — 6 tables/views, not 14 object types.
5. **Chart fiddling** — one chart matters (machine cycle-time trend); the fail-rate trend is flat.
6. **Naive failure-rate-by-machine** — shows two QC stations at 46%; always attribute through
   the job join and badge it derived.
7. **Demo-time analysis gambling** — the five scripted moments are verified; don't improvise
   new ones on stage.

## Definition of done (unchanged from PLAN.md)

Deployed, password-protected URL · real values from the JSONL · a user can go alert → detail →
raw evidence · derived relationships never shown as raw facts · readable README and commit
history.
