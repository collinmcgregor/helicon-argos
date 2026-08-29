# Page: Operations Overview

| | |
| --- | --- |
| **Route** | `/` |
| **Build task** | W1-overview |
| **Query module** | `lib/queries/overview.ts` |
| **Test file** | `tests/queries/overview.test.ts` |
| **Key verified numbers** | $590,465 / 26 overdue · 9 blocked/held · 46% fail rate · voids 827 (35%) · press_03 1,294s median · press_06 spike week |

Global shell, states, and cross-cutting rules: `../DESIGN.md`. Data contract and navigation
payloads: `../DATA-FLOWS.md`. Visual system: `../ARGOS.md §5`.

## Purpose

A Foundry-grade operations console in one screen: current factory state, the trends behind it,
the most pressing issues, their **business implications in dollars and customers**, and a
concrete action list. It prioritizes investigation — every element leads somewhere; nothing is
decoration.

## Exact layout

```text
┌──────────────┬──────────────────────────────────────────────────────────────┐
│ HELICON /    │ OPERATE / OVERVIEW           [All facilities] [CM · ADMIN ▾] │
│ ARGOS v0.0   ├──────────────────────────────────────────────────────────────┤
│              │ Operations overview                                          │
│ OPERATE      │ Factory state at 2026-08-13 23:06 UTC                        │
│ ▌ Overview   │ ━ amber seam ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│   Jobs       │ [Active] [Blocked / Held] [Overdue value] [Quality]          │
│              │                                                              │
│ INVESTIGATE  │ ┌ Throughput (daily good qty) ┐ ┌ Quality (pass rate) ─────┐ │
│   Alerts     │ │ ▁▂▃▅▄▅▆▅▆▇▆▅  area chart    │ │ ─────────── flat ~54%    │ │
│   Machines   │ └─────────────────────────────┘ └──────────────────────────┘ │
│              │ ┌ Factory ──────────────────────────────────────────────────┐ │
│ ADMIN        │ │ LA-01 pulse · LA-02 pulse │ press_01…06 machine strip     │ │
│   Ontology   │ └───────────────────────────────────────────────────────────┘ │
│              │ Needs attention                        Selected investigation │
│              │ ┌────────────────────────────────┐  ┌───────────────────────┐ │
│              │ │ press_03: slowing cycle time    │  │ rule / explanation    │ │
│              │ │ overdue incomplete work         │  │ business impact ($)   │ │
│              │ │ missing tooling constraint      │  │ evidence facts        │ │
│              │ │ press_06: recovered incident    │  │ recommended action →  │ │
│              │ └────────────────────────────────┘  └───────────────────────┘ │
│              │ Recommended actions (derived from open alerts)                │
│              │ Quality is systemic: voids ▮▮▮▮ 827 · delam ▮▮ 421 · dim ▮▮  │
│              │ ─ 19,519 events · horizon 2026-08-13 23:06 · la_01 92% ─      │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

## Header

- Title: **Operations overview**
- Context line: **Factory state at 2026-08-13 23:06 UTC** — frozen to the final event horizon,
  not the user's wall clock, so "overdue" remains meaningful in the historical dataset.

## Four clickable KPI tiles

| Tile | Display | Click destination | Why it earns its space |
| --- | --- | --- | --- |
| Active jobs | Count of open/in-progress jobs | `/jobs?status=active` | Gives the operational workload. |
| Blocked / held | Current count; secondary copy: `28 blocks cite missing tools` | `/jobs?status=blocked-held` | Reveals stranded work and the leading constraint. |
| Overdue value | `$590K`; secondary copy: `26 incomplete jobs` | `/jobs?risk=overdue` | Makes delivery risk concrete. |
| In-process inspection fail rate | `46%`; secondary copy: `final completed-job yield: 91%` | filtered inspection context | Distinguishes sampled in-process inspection from final acceptance. |

Avoid making "press_03 cycle time" a fifth tile. It is an investigation, not a whole-factory
KPI, and belongs at the top of the queue.

## Trend row (two charts, dense, evidence-first)

Side-by-side compact charts (~180px tall), Laminate chart rules (`../ARGOS.md §5`), daily
resolution over the full event window (Jul 3 – Aug 13):

1. **Throughput** — daily completed-cycle quantity, single-series area chart in `--series-1`.
   Facility-filter aware. Click → `/jobs?status=active`.
2. **Quality** — daily inspection pass rate, single line using status colors; a muted
   reference band at the 54% overall pass rate. Caption: `flat across assets — see quality
   note below`. The chart's *flatness is the finding*; it visually backs the systemic-quality
   strip. Click → filtered alert context.

No third chart. The cycle-time chart lives on machine detail, where its investigation is.

## Factory panel (facility pulse + machine strip)

One panel, two rows — this is the "factory overview":

- **Facility pulse cards** (`LA-01`, `LA-02`): open jobs, blocked/held count, recent
  completed-cycle quantity (final 24h of the event horizon, window shown in the footer),
  highest-priority overdue work, latest observed event timestamp. Click →
  `/jobs?facility=…`. Use **Recent activity**, never "currently running" — the log records
  completed cycles, not authoritative machine start/stop state.
- **Machine strip**: one compact cell per press (`press_01…press_06`): machine ID (mono),
  median cycle time, tiny 8-week sparkline, and a fiber-angle status glyph (warn on press_03,
  info-with-history on press_06, ok elsewhere). Click → `/machines/:machineId`. This is where
  press_03 becomes *visible* before the user even reads the queue.

When a specific facility is selected, show that facility's card + machines and an unobtrusive
link back to the all-facility comparison.

## Needs-attention queue

Still the dominant component: ranked rows, not charts. Each row: severity, rule name, a
one-sentence explanation, **a business-impact line**, IDs/metrics, destination.

| Priority | Alert row | Business impact line | Destination |
| ---: | --- | --- | --- |
| 1 | **Slowing cycle time — press_03**. `1,294s median; 25% above fleet; rising; no maintenance recorded.` | `~25% capacity loss on 1 of 6 presses; open jobs routed here at risk` | `/machines/press_03` |
| 2 | **Overdue incomplete work**. `26 jobs; $590K estimated order value.` | `$590K order value late; N customers affected` | `/jobs?risk=overdue` |
| 3 | **Tooling constraint**. `missing_tool: 28 of 68 blocks; 9 currently blocked/held.` | `$ value of blocked jobs; leading single cause of stranded work` | `/jobs?status=blocked-held&reason=missing_tool` |
| 4 | **Recovered asset incident — press_06**. `Pressure signal + maintenance preceded temporary cycle-time spike.` | `recovered; validates sensor→throughput correlation` | `/machines/press_06?window=2026-07-20..2026-08-03` |

Business-impact figures are computed (sum of `unit_price_estimate × target_quantity` over the
implicated jobs; distinct customer count) — never hand-written copy. Where price estimates are
missing, show coverage honestly (`$ over N of M jobs with price data`).

Selecting a row updates the right-hand **Selected investigation** panel without navigation:
rule, human explanation, business impact, three evidence facts, and one action button —
**Open machine investigation** or **Open filtered jobs**.

If P1 investigation actions ship, the same panel adds **Start investigation**. It creates a
separate follow-up record containing the alert rule, implicated object, and selected event IDs;
it never edits source events.

## Recommended actions

A compact panel under the queue — the alert queue translated into an operator to-do list.
Derived at query time from open alerts (read-only in v0.0; no fake workflow state):

| Derived action | Source alert |
| --- | --- |
| `Schedule inspection of press_03 — cycle time 25% above fleet and rising, no maintenance on record` | press_03 |
| `Expedite or re-commit 26 overdue jobs ($590K) — start with highest-value customers` | overdue |
| `Source missing tooling — 28 of 68 blocks cite missing_tool; 9 jobs stranded now` | tooling |
| `Investigate shared cure/vacuum/debulk process — voids lead defects in all 8 materials` | systemic quality |

Each action links to the same destination as its alert. Label the panel `DERIVED — generated
from open alerts`. No checkboxes, owners, or acknowledgement in v0.0 (that is P1 workflow
state; do not fake it).

## Systemic-quality note (with defect mini-Pareto)

A compact, non-clickable evidence strip at the bottom — one sentence plus inline mini-bars:

> **Quality signal:** Voids are the top defect in all eight materials. Inspection failure rates
> are flat across presses, tools, facilities, and inspectors. Investigate a shared process
> step—not a single asset.
>
> `voids ▮▮▮▮▮ 827 · delamination ▮▮ 421 · dimensional ▮▮ 347 · surface ▮▮ 337 · resin_rich ▮ 244 · other ▮ 212`

The mini-Pareto is thin horizontal bars in `--status-critical` at reduced opacity with mono
counts — a PlyBar-style flex div, not a chart component. It turns the strip's claim into
visible evidence for ~10 lines of JSX.

## Status footer

A single quiet provenance line closing the page, 11px mono, `--text-muted`:

`19,519 events · horizon 2026-08-13 23:06 UTC · la_01 92% / la_02 8% of activity · source: manufacturing_events.jsonl`

Non-clickable. It grounds every number above in the source log — the cheapest possible
credibility signal, and it restates the frozen clock where an evaluator will notice it.

## Top bar (page-level notes)

The shell's facility selector and user chip (`../DESIGN.md` global shell) sit top-right. On
this page the chip shows the demo account's mono initials + `ADMIN` tag; its only menu action
is sign out. Identity indicator, not an account system — no profile page exists.

## Page data and links

- Reads `jobs_current` for state/economic metrics, `alerts` for queue/action rows,
  `machine_stats` for press findings, `inspections` aggregates for quality, and `events` for
  freshness/event evidence.
- Facility cards pass `facility=la_01` or `facility=la_02` to Jobs Explorer; every alert passes
  its exact rule, object ID, time window, and supporting event IDs per `../DATA-FLOWS.md`.
- The overdue-value tile and business-impact lines disclose price coverage (`150 / 312 jobs`) in
  their detail/tooltip; missing estimates are not treated as zero-value orders.

## What to exclude

- No map/3D factory image; no generic "machine health score."
- No failure-rate-by-machine ranking: it would misattribute QC-station events and presents a
  flat result.
- No job table on the homepage; users reach it via a purposeful filter.
- No third chart, no dual-axis charts, no sparkline farms beyond the machine strip.
- No editable workflow state on the action list (v0.0 is read-only derived).
- No notifications bell, settings page, profile page, or any account feature beyond the user
  chip + sign out — fake doors read as vibe-coded instantly.

## Build order within the task (checkpoint-friendly)

Tiles + queue + investigation panel first (the P0 core) → factory panel → trend row →
recommended actions. If the task runs long, the trend row and action list are the cuttable
tail, per `../BUILD.md` cut lines.
