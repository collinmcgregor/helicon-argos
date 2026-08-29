# Page: Machine Detail

| | |
| --- | --- |
| **Route** | `/machines/:machineId` |
| **Build task** | W1-machines (with optional `alerts.md`) |
| **Query module** | `lib/queries/machines.ts` |
| **Test file** | `tests/queries/machines.test.ts` |
| **Key verified numbers** | press_03: 1,294s median, 25% above 949–1,056s fleet band, +6% drift, zero maintenance · press_06: 957s → 1,810s spike after Jul 24 sensor_glitch / Jul 25 maintenance_ping |

Global shell, states, and cross-cutting rules: `../DESIGN.md`. Data contract and linked evidence:
`../DATA-FLOWS.md`.

## Purpose

Let a user validate a throughput concern and identify which work may be exposed. This page must
not claim QC data is direct machine-quality data.

## Exact layout

```text
┌──────────────┬──────────────────────────────────────────────────────────────┐
│ HELICON /    │ INVESTIGATE / MACHINES / press_03           [All facilities] │
│ ARGOS v0.0   ├──────────────────────────────────────────────────────────────┤
│              │ press_03                              ∣ CYCLE-TIME ALERT     │
│ OPERATE      │ la_01 · 2,247 cycles · median 1,294s                         │
│   Overview   │ 25% above fleet · rising trend · no maintenance recorded     │
│   Jobs       │ ━ amber seam ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│              │ ┌ CYCLE-TIME TREND · weekly median ─────────────────────────┐│
│ INVESTIGATE  │ │ 1400s ─                    ╭──╮   ── press_03             ││
│   Alerts     │ │ 1200s ─  ╭────╮──╭────────╯                              ││
│ ▌ Machines   │ │ 1000s ─ ─┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  ┄┄ fleet median         ││
│              │ │         w1   w2   w3   w4   w5    window in URL (?window=)││
│ ADMIN        │ └───────────────────────────────────────────────────────────┘│
│   Ontology   │ ┌ EVIDENCE LOG ──────────────┐ ┌ AFFECTED WORK ─────────────┐│
│              │ │ cycle / sensor / maint     │ │ jobs on this machine,      ││
│              │ │ events with event_ids      │ │ open/risk first → detail   ││
│              │ └────────────────────────────┘ └────────────────────────────┘│
│              │ ┌ QUALITY ATTRIBUTION · DERIVED from Job → Cycle assoc. ────┐│
│              │ │ 46% attributed fail rate — in line with fleet (flat)      ││
│              │ └───────────────────────────────────────────────────────────┘│
└──────────────┴──────────────────────────────────────────────────────────────┘
```

## Header

- Machine ID, facility context, cycle count, median cycle time, fleet comparison, and current
  alert state.
- For `press_03`, explicitly show: `25% above fleet · rising trend · no maintenance recorded`.

## Body

1. **Cycle-time trend** — the only P0 chart. Weekly median duration; show fleet median as
   reference. Annotate the press_06 sensor/maintenance events only on press_06. Time window in
   the URL (`?window=`) so alert links can scope it.
2. **Evidence log** — relevant cycle, sensor, and maintenance events, with event IDs.
3. **Affected work** — jobs that ran on this machine, sorted by open/risk state. Links to Job
   detail.
4. **Derived quality attribution** — a compact section only when useful, labeled
   `Derived from Job → Cycle association`. It must never imply the QC station is the press.
   Attribution queries must never contain `qc_01`/`qc_02` (tested).

## Page data and links

- Reads `machine_stats` and `cycles` for production-machine timing; joins asset events only as
  timestamped annotations, not proof of causality.
- Reads `jobs_current` for affected work. Each job row links to `/jobs/:jobId`, preserving the
  originating machine/time-window context in the back-link.
- The evidence log exposes supporting `event_id`s. For `press_06`, say a pressure signal and
  maintenance ping were *followed by* a spike, never that either event caused it.
