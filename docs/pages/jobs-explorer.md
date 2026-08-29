# Page: Jobs Explorer

| | |
| --- | --- |
| **Route** | `/jobs` |
| **Build task** | W1-jobs (with `job-detail.md`) |
| **Query module** | `lib/queries/jobs.ts` |
| **Test file** | `tests/queries/jobs.test.ts` |
| **Key verified numbers** | 312 jobs · 281 completed · 15 in_progress · 9 blocked/held · 7 created · 26 overdue |

Global shell, states, and cross-cutting rules: `../DESIGN.md`. Data contract and navigation
payloads: `../DATA-FLOWS.md`.

## Purpose

Turn an alert into a manageable list of work. This is a triage table, not a spreadsheet
replacement.

## Exact layout

```text
┌──────────────┬──────────────────────────────────────────────────────────────┐
│ HELICON /    │ OPERATE / JOBS                              [All facilities] │
│ ARGOS v0.0   ├──────────────────────────────────────────────────────────────┤
│              │ Overdue incomplete jobs            ← title echoes the filter │
│ OPERATE      │ 26 jobs · risk=overdue · $590K value          [Clear filters]│
│   Overview   │ ━ amber seam ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ ▌ Jobs       │ [Facility ▾] [Status ▾] [Customer ▾]      risk=overdue (ro) │
│              │ ┌───────────────────────────────────────────────────────────┐│
│ INVESTIGATE  │ │ STATUS   JOB       CUSTOMER/PART   DUE      PROGRESS YIELD││
│   Alerts     │ │ ─────────────────────────────────────────────────────────││
│   Machines   │ │ ✕ BLOCKED job_0152 cust_… part_…  Jul 28 ▲ ▂▂▂░░ 61%  — ││
│              │ │   la_01 · carbon_fiber_epoxy          missing_tool        ││
│ ADMIN        │ │ ∣ AT RISK job_0087 cust_… part_…  Aug 02 ▲ ▂▂▂▂░ 78%  — ││
│   Ontology   │ │   la_01 · phenolic_prepreg            overdue · $12.4K    ││
│              │ │ … 36px rows · whole row → /jobs/:jobId · sorted by risk   ││
│              │ └───────────────────────────────────────────────────────────┘│
└──────────────┴──────────────────────────────────────────────────────────────┘
```

## Layout and controls

- Title changes with context: e.g. **Overdue incomplete jobs**; otherwise **Jobs**.
- One-line applied-filter summary and a visible **Clear filters** action.
- Filters only: facility, status, customer. Alert links may supply `risk` and `reason` as
  read-only applied filters.
- Default sort: risk/urgency first, then target due date ascending.
- All filter state lives in the URL query string (shareable, refresh-safe).

## Table columns

| Column | Meaning |
| --- | --- |
| Status | Glyph + label; never color alone |
| Job | Mono ID; click opens job detail |
| Customer / Part | Context for escalation |
| Due | Target due date; overdue indicator only where warranted |
| Completion outcome | Good/scrap quantity and yield only when a completion event exists |
| Production activity | Cycle count and cumulative cycle quantity; never displayed as completion progress |
| Risk / reason | Why this row is in the current queue |

For compactness, facility and material appear in a second muted line under Job or in a detail
drawer — not as extra desktop columns.

## Page data and links

- Reads `jobs_current`; alert-driven query parameters are preserved and rendered in the title.
- Each Job row links to `/jobs/:jobId` using stable `job_id`, not a transient table-row index.
- State/reason cells explain derived lifecycle status where relevant. `job_0293` may carry a
  compact data-quality indicator because its source history includes duplicate completion events.
- Money/risk filters disclose unit-price coverage rather than treating missing estimates as
  zero-value jobs.
