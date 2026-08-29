# Page: Machine Detail

| | |
| --- | --- |
| **Route** | `/machines/:machineId` |
| **Build task** | W1-machines (with optional `alerts.md`) |
| **Query module** | `lib/queries/machines.ts` |
| **Test file** | `tests/queries/machines.test.ts` |
| **Key verified numbers** | press_03: 1,294s median, 25% above 949–1,056s fleet band, +6% drift, zero maintenance · press_06: 957s → 1,810s spike after Jul 24 sensor_glitch / Jul 25 maintenance_ping |

Global shell, states, and cross-cutting rules: `../DESIGN.md`.

## Purpose

Let a user validate a throughput concern and identify which work may be exposed. This page must
not claim QC data is direct machine-quality data.

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
