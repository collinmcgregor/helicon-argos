# Helicon Argos (v0.0) — Product Design Specification

## Product principle

Argos is an **exception console**, not a reporting dashboard. Its homepage answers one question:

> Where should an operations lead look first, and what evidence supports that priority?

The core interaction is always:

```text
Exception → explanation → implicated object → source-event evidence → affected work
```

Do not add a visual unless it helps users make one of these decisions: where to investigate, what is affected, or whether evidence supports an action.

## Information architecture

Ship four navigable views, plus a login gate.

```text
Password gate
  └─ Overview (/)
       ├─ Alerts list (/alerts) [optional as a full page; overview queue is sufficient initially]
       ├─ Jobs explorer (/jobs)
       │    └─ Job detail (/jobs/:jobId)
       └─ Machine detail (/machines/:machineId)
```

There is deliberately no standalone ontology graph, facility page, customer page, quality-rankings page, tool page, or material-lot page in v0.0. Those concepts appear as linked context in job and machine views.

### Global shell

- Fixed left rail: `Overview`, `Jobs`, `Alerts`, `Machines`.
- Top bar: breadcrumb and facility selector (`All facilities`, `LA-01`, `LA-02`).
- `HELICON / ARGOS v0.0` wordmark with a restrained resin-amber mark.
- Dark “Laminate” design system from `ARGOS.md`: flat panels, 1px borders, no shadows, no rounded/pill-heavy consumer-app styling.
- Inter for written labels; IBM Plex Mono for IDs, dates, quantities, and all KPI values.

The selected facility must affect every count, list, and chart in the current view. It should persist in the URL query string.

## Overview page (`/`)

### Purpose

Prioritize investigation. It is not a chart gallery and it should not require users to decide which filter or report to open first.

### Exact layout

```text
┌──────────────┬─────────────────────────────────────────────────────────┐
│ HELICON /    │ OPERATE / OVERVIEW                      [All facilities] │
│ ARGOS v0.0   ├─────────────────────────────────────────────────────────┤
│              │ Operations overview                                      │
│ OPERATE      │ Factory state at 2026-08-13 23:06 UTC                    │
│ ▌ Overview   │ ━ amber seam ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│   Jobs       │                                                         │
│              │ [Active] [Blocked / Held] [Overdue value] [Quality]    │
│ INVESTIGATE  │                                                         │
│   Alerts     │ Needs attention                    Selected investigation│
│   Machines   │ ┌──────────────────────────────┐  ┌───────────────────┐ │
│              │ │ press_03: slowing cycle time  │  │ rule / explanation│ │
│              │ │ overdue incomplete work       │  │ evidence summary  │ │
│              │ │ missing tooling constraint    │  │ open destination  │ │
│              │ │ press_06: recovered incident  │  └───────────────────┘ │
│              │ └──────────────────────────────┘                         │
│              │ Quality is systemic: voids lead all materials …          │
└──────────────┴─────────────────────────────────────────────────────────┘
```

### Header

- Title: **Operations overview**
- Context line: **Factory state at 2026-08-13 23:06 UTC**.
- The timestamp is frozen to the final event horizon—not the user’s wall clock—so “overdue” remains meaningful in the historical dataset.

### Four clickable KPI tiles

| Tile | Display | Click destination | Why it earns its space |
| --- | --- | --- | --- |
| Active jobs | Count of open/in-progress jobs | `/jobs?status=active` | Gives the operational workload. |
| Blocked / held | Current count; secondary copy: `28 blocks cite missing tools` | `/jobs?status=blocked-held` | Reveals stranded work and the leading constraint. |
| Overdue value | `$590K`; secondary copy: `26 incomplete jobs` | `/jobs?risk=overdue` | Makes delivery risk concrete. |
| Inspection fail rate | `46%`; secondary copy: `systemic across assets` | `/jobs?quality=failed-inspection` or filtered alert context | Prevents misreading quality as a single bad machine. |

Avoid making “press_03 cycle time” a fifth tile. It is an investigation, not a whole-factory KPI, and belongs at the top of the queue.

### Needs-attention queue

This is the dominant component: ranked rows, not charts. Each row includes severity, rule name, a one-sentence explanation, IDs/metrics, and its destination.

| Priority | Alert row | Destination |
| ---: | --- | --- |
| 1 | **Slowing cycle time — press_03**. `1,294s median; 25% above fleet; rising; no maintenance recorded.` | `/machines/press_03` |
| 2 | **Overdue incomplete work**. `26 jobs; $590K estimated order value.` | `/jobs?risk=overdue` |
| 3 | **Tooling constraint**. `missing_tool: 28 of 68 blocks; 9 currently blocked/held.` | `/jobs?status=blocked-held&reason=missing_tool` |
| 4 | **Recovered asset incident — press_06**. `Pressure signal + maintenance preceded temporary cycle-time spike.` | `/machines/press_06?window=2026-07-20..2026-08-03` |

Selecting a row updates the right-hand **Selected investigation** panel without navigation. The panel repeats the rule, the human explanation, three evidence facts, and one clear action: **Open machine investigation** or **Open filtered jobs**. Clicking that action navigates.

### Systemic-quality note

Use a compact, non-clickable evidence strip below the queue:

> **Quality signal:** Voids are the top defect in all eight materials. Inspection failure rates are flat across presses, tools, facilities, and inspectors. Investigate a shared process step—not a single asset.

This is strategically valuable because it demonstrates that Argos can disprove a tempting but incorrect asset hypothesis. It is not a chart because the UI does not yet offer a dedicated shared-process workflow.

### What to exclude from the overview

- No map/3D factory image.
- No generic “machine health score.”
- No failure-rate-by-machine ranking: it would misattribute QC-station events and presents a flat result.
- No job table on the homepage; users reach it via a purposeful filter.
- No trend charts before the queue and drill-throughs work. A single cycle-time chart belongs on machine detail.

## Jobs explorer (`/jobs`)

### Purpose

Turn an alert into a manageable list of work. This is a triage table, not a spreadsheet replacement.

### Layout and controls

- Title changes with context: e.g. **Overdue incomplete jobs**; otherwise **Jobs**.
- One-line applied-filter summary and a visible **Clear filters** action.
- Filters only: facility, status, customer. Alert links may supply `risk` and `reason` as read-only applied filters.
- Default sort: risk/urgency first, then target due date ascending.

### Table columns

| Column | Meaning |
| --- | --- |
| Status | Glyph + label; never color alone |
| Job | Mono ID; click opens job detail |
| Customer / Part | Context for escalation |
| Due | Target due date; overdue indicator only where warranted |
| Progress | Target vs. derived cycle quantity or completion outcome; label caveats where needed |
| Yield | Good vs. scrap only when completion data exists |
| Risk / reason | Why this row is in the current queue |

For compactness, facility and material appear in a second muted line under Job or in a detail drawer—not as extra desktop columns.

## Job detail (`/jobs/:jobId`)

### Purpose

Prove Argos’s ontology and source discipline. This is the most important detail screen.

### Header

- Breadcrumb: `JOBS / job_0152`
- Status and risk badge.
- Customer, part, facility, material, priority, due date.
- Target quantity, completion quantity, good/scrap outcome when present.
- A thin ply-stack yield bar only when completion quantities exist.

### Body: two columns

**Left, dominant: Event timeline**

- Every source event for this job, newest first or chronological with a clear sort switch.
- Timestamp, event type, a plain-language event summary, relevant machine/tool/quantity, and `event_id`.
- The raw `event_id` can be copied or expanded; never hide it behind a generic “activity” label.

**Right: Connected context**

- Machines and tools used by the job (historical event relationship).
- Inspection summary: pass/fail quantities, defects, inspectors.
- Blocking/hold reasons and whether an unblock followed.
- Material-lot scan, when present, with the honest coverage label: `Lot-scanned data available for 14 / 312 jobs`.
- Context links: machine IDs go to `/machines/:machineId`; source event IDs can reveal a compact event record.

`job_0152` should be easy to find, because it demonstrates blocked work plus a material-lot trace.

## Machine detail (`/machines/:machineId`)

### Purpose

Let a user validate a throughput concern and identify which work may be exposed. This page must not claim QC data is direct machine-quality data.

### Header

- Machine ID, facility context, cycle count, median cycle time, fleet comparison, and current alert state.
- For `press_03`, explicitly show: `25% above fleet · rising trend · no maintenance recorded`.

### Body

1. **Cycle-time trend** — the only P0 chart. Weekly median duration; show fleet median as reference. Annotate the press_06 sensor/maintenance events only on press_06.
2. **Evidence log** — relevant cycle, sensor, and maintenance events, with event IDs.
3. **Affected work** — jobs that ran on this machine, sorted by open/risk state. Links to Job detail.
4. **Derived quality attribution** — a compact section only when useful, labeled `Derived from Job → Cycle association`. It must never imply the QC station is the press.

## Alert detail (`/alerts`) — optional P0 route

Do not build a separate alert object page unless the overview queue has already shipped. If it does ship, use it only as an expanded, filterable version of the queue. Alerts remain query-time derived objects with source-event evidence, not editable tickets.

## Interaction and state requirements

Every designed screen needs these states before build:

| State | Required behavior |
| --- | --- |
| Loading | Quiet panel/table skeletons; preserve shell and page title. |
| Empty | Say what filter produced no results and provide one action to clear filters. |
| Error | State that source-derived data could not load; offer retry. |
| Derived relationship | Show a `DERIVED` badge plus a one-line method/caveat. |
| Raw evidence | Expose `event_id`, timestamp, type, and relevant source values. |
| Narrow screen | Collapse rail, stack overview queue/detail, let job table scroll horizontally only as a last resort. |

## Final build order

1. Finalize data contract and query results that power every value above.
2. Build global shell and password gate.
3. Build Overview, including queue selection and exact destinations.
4. Build Jobs explorer with alert-supplied URL filters.
5. Build Job detail timeline and context panel.
6. Build Machine detail chart, evidence, and affected-work list.
7. Add the optional alerts route only if the four core views are polished and deployed.

## Acceptance test: the demo path

1. Open Overview and select the `press_03` alert.
2. Read the rule and evidence; open `press_03` machine detail.
3. See the slow/rising cycle-time trend and affected jobs.
4. Open an affected job and inspect its raw event timeline.
5. Return to Overview, open overdue work, and use the filtered Job explorer.
6. Open `job_0152` to demonstrate a blocked job with an observed material-lot scan.

If this path is fast, clear, and source-traceable, v0.0 succeeds.
