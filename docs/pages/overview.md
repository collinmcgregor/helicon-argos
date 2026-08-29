# Page: Operations Overview

| | |
| --- | --- |
| **Route** | `/` |
| **Build task** | W1-overview |
| **Query module** | `lib/queries/overview.ts` |
| **Test file** | `tests/queries/overview.test.ts` |
| **Key verified numbers** | $590,465 / 26 overdue · 9 blocked/held · 46% fail rate · voids 827 (35%) · press_03 1,294s median · press_06 spike week |

Global shell, states, and cross-cutting rules: `../DESIGN.md`. Visual system: `../ARGOS.md §5`.

## Purpose

Prioritize investigation. It is not a chart gallery and it should not require users to decide
which filter or report to open first.

## Exact layout

```text
┌──────────────┬─────────────────────────────────────────────────────────┐
│ HELICON /    │ OPERATE / OVERVIEW                      [All facilities] │
│ ARGOS v0.0   ├─────────────────────────────────────────────────────────┤
│              │ Operations overview                                      │
│ OPERATE      │ Factory state at 2026-08-13 23:06 UTC                    │
│ ▌ Overview   │ ━ amber seam ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│   Jobs       │ [LA-01 pulse] [LA-02 pulse]                             │
│              │ [Active] [Blocked / Held] [Overdue value] [Quality]    │
│ INVESTIGATE  │                                                         │
│   Alerts     │ Needs attention                    Selected investigation│
│   Machines   │ ┌──────────────────────────────┐  ┌───────────────────┐ │
│              │ │ press_03: slowing cycle time  │  │ rule / explanation│ │
│ ADMIN        │ │ overdue incomplete work       │  │ evidence summary  │ │
│   Ontology   │ │ missing tooling constraint    │  │ open destination  │ │
│              │ │ press_06: recovered incident  │  └───────────────────┘ │
│              │ └──────────────────────────────┘                         │
│              │ Quality is systemic: voids lead all materials …          │
└──────────────┴─────────────────────────────────────────────────────────┘
```

## Header

- Title: **Operations overview**
- Context line: **Factory state at 2026-08-13 23:06 UTC** — frozen to the final event horizon,
  not the user's wall clock, so "overdue" remains meaningful in the historical dataset.

## Facility pulse: both factories at a glance

A compact two-card strip between the title/context and the global KPI row. It answers "what is
each facility doing?" without turning the Overview into a facility dashboard.

| Facility pulse card | Content | Click destination |
| --- | --- | --- |
| `LA-01` | Open jobs, blocked/held count, recent completed-cycle quantity, highest-priority overdue work, latest observed event timestamp | `/jobs?facility=la_01` |
| `LA-02` | The same five measures | `/jobs?facility=la_02` |

Use **Recent activity** rather than "currently running" — the log records completed cycles and
lifecycle events, not authoritative machine start/stop state. Recent activity = the final 24
hours of the frozen event horizon; display that window in the card footer. Quiet comparison
cards, not a second set of oversized KPI tiles.

When `All facilities` is selected, show both cards. When a specific facility is selected, show
that one card and an unobtrusive link back to all-facility comparison.

## Four clickable KPI tiles

| Tile | Display | Click destination | Why it earns its space |
| --- | --- | --- | --- |
| Active jobs | Count of open/in-progress jobs | `/jobs?status=active` | Gives the operational workload. |
| Blocked / held | Current count; secondary copy: `28 blocks cite missing tools` | `/jobs?status=blocked-held` | Reveals stranded work and the leading constraint. |
| Overdue value | `$590K`; secondary copy: `26 incomplete jobs` | `/jobs?risk=overdue` | Makes delivery risk concrete. |
| Inspection fail rate | `46%`; secondary copy: `systemic across assets` | `/jobs?quality=failed-inspection` or filtered alert context | Prevents misreading quality as a single bad machine. |

Avoid making "press_03 cycle time" a fifth tile. It is an investigation, not a whole-factory
KPI, and belongs at the top of the queue.

## Needs-attention queue

The dominant component: ranked rows, not charts. Each row includes severity, rule name, a
one-sentence explanation, IDs/metrics, and its destination.

| Priority | Alert row | Destination |
| ---: | --- | --- |
| 1 | **Slowing cycle time — press_03**. `1,294s median; 25% above fleet; rising; no maintenance recorded.` | `/machines/press_03` |
| 2 | **Overdue incomplete work**. `26 jobs; $590K estimated order value.` | `/jobs?risk=overdue` |
| 3 | **Tooling constraint**. `missing_tool: 28 of 68 blocks; 9 currently blocked/held.` | `/jobs?status=blocked-held&reason=missing_tool` |
| 4 | **Recovered asset incident — press_06**. `Pressure signal + maintenance preceded temporary cycle-time spike.` | `/machines/press_06?window=2026-07-20..2026-08-03` |

Selecting a row updates the right-hand **Selected investigation** panel without navigation. The
panel repeats the rule, the human explanation, three evidence facts, and one clear action:
**Open machine investigation** or **Open filtered jobs**. Clicking that action navigates.

## Systemic-quality note

A compact, non-clickable evidence strip below the queue:

> **Quality signal:** Voids are the top defect in all eight materials. Inspection failure rates
> are flat across presses, tools, facilities, and inspectors. Investigate a shared process
> step—not a single asset.

Strategically valuable because it demonstrates Argos can disprove a tempting but incorrect
asset hypothesis. Not a chart, because the UI does not yet offer a shared-process workflow.

## What to exclude

- No map/3D factory image; no generic "machine health score."
- No failure-rate-by-machine ranking: it would misattribute QC-station events and presents a
  flat result.
- No job table on the homepage; users reach it via a purposeful filter.
- No trend charts before the queue and drill-throughs work. The single cycle-time chart
  belongs on machine detail.
