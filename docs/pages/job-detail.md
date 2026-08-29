# Page: Job Detail

| | |
| --- | --- |
| **Route** | `/jobs/:jobId` |
| **Build task** | W1-jobs (with `jobs-explorer.md`) — **the non-negotiable page** |
| **Query module** | `lib/queries/jobs.ts` |
| **Test file** | `tests/queries/jobs.test.ts` |
| **Key demo object** | `job_0152` — blocked **and** lot-scanned (`lot_6626`); lot coverage 14 / 312 jobs |

Global shell, states, and cross-cutting rules: `../DESIGN.md`. Data contract and linked
evidence: `../DATA-FLOWS.md`.

## Purpose

Prove Argos's ontology and source discipline. This is the most important detail screen.

## Exact layout

```text
┌──────────────┬──────────────────────────────────────────────────────────────┐
│ HELICON /    │ OPERATE / JOBS / job_0152                   [All facilities] │
│ ARGOS v0.0   ├──────────────────────────────────────────────────────────────┤
│              │ job_0152                     ✕ BLOCKED   ∣ OVERDUE           │
│ OPERATE      │ cust_… · part_… · la_01 · carbon_fiber_epoxy · normal        │
│   Overview   │ due 2026-07-28 · target 240 · ply bar ▰▰▰▰▰▱▱▱ 61%          │
│ ▌ Jobs       │ ━ amber seam ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│              │ ┌ EVENT TIMELINE (dominant) ────────┐ ┌ CONNECTED CONTEXT ──┐│
│ INVESTIGATE  │ │ [chronological ⇅]                 │ │ MACHINES & TOOLS    ││
│   Alerts     │ │ 07-28 14:02 ■ job_blocked        │ │  press_02 · tool_09 ││
│   Machines   │ │   missing_tool        evt_014521 │ │ INSPECTIONS         ││
│              │ │ 07-27 09:14 ■ cycle_completed    │ │  41 pass · 38 fail  ││
│ ADMIN        │ │   press_02 · qty 12   evt_014202 │ │  voids · dimensional││
│   Ontology   │ │ 07-25 16:40 ■ material_lot_scan  │ │ BLOCKERS            ││
│              │ │   lot_6626            evt_013877 │ │  missing_tool, open ││
│              │ │ … 32px log rows · square nodes   │ │ MATERIAL LOT        ││
│              │ │   event_id click-to-copy         │ │  lot_6626 · 14/312  ││
│              │ └──────────────────────────────────┘ └─────────────────────┘│
└──────────────┴──────────────────────────────────────────────────────────────┘
```

## Header

- Breadcrumb: `JOBS / job_0152`
- Status and risk badge.
- Customer, part, facility, material, priority, due date.
- Target quantity, completion quantity, good/scrap outcome when present.
- A thin ply-stack yield bar only when completion quantities exist.
- Production activity is separate: cycle count and cumulative cycle quantity are context, never
  a percent-complete bar.

## Body: two columns

**Left, dominant: Event timeline**

- Every source event for this job, newest first or chronological with a clear sort switch.
- Timestamp, event type, a plain-language event summary, relevant machine/tool/quantity, and
  `event_id`.
- The raw `event_id` can be copied or expanded; never hide it behind a generic "activity"
  label.

**Right: Connected context**

- Machines and tools used by the job (historical event relationship).
- Inspection summary: pass/fail quantities, defects, inspectors.
- Blocking/hold reasons and whether an unblock followed.
- Material-lot scan, when present, with the honest coverage label:
  `Lot-scanned data available for 14 / 312 jobs`.
- Context links: machine IDs go to `/machines/:machineId`; source event IDs can reveal a
  compact event record.

## Page data and links

- Reads one `jobs_current` object plus linked `events`, `cycles`, `inspections`, and observed
  lot scans keyed by `job_id`.
- Machine IDs link to `/machines/:machineId`; never fabricate a direct inspection-to-machine edge
  because inspections occur at QC stations.
- `job_0152` demonstrates blocked work plus an observed material-lot scan (`lot_6626`). It is a
  sparse-lineage example, not a blast-radius example: each observed lot maps to one job.
- When a source anomaly affects interpretation, display it beside derived state without hiding the
  original timeline events.
