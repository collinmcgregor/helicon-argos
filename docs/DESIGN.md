# Helicon Argos (v0.0) — Product Design Specification

The overarching design document: product principle, information architecture, global shell,
and the cross-cutting rules every screen obeys. **Per-page specs live in `pages/`** — one
document per route, each carrying its route, build task, query module, test file, and the
verified numbers it must display. The visual system ("Laminate": tokens, type, components,
blacklist) is specified in `ARGOS.md §5`; build sequencing and task ownership in `BUILD.md`.

## Product principle

Argos is an **exception console**, not a reporting dashboard. Its homepage answers one question:

> Where should an operations lead look first, and what evidence supports that priority?

The core interaction is always:

```text
Exception → explanation → implicated object → source-event evidence → affected work
```

Do not add a visual unless it helps users make one of these decisions: where to investigate,
what is affected, or whether evidence supports an action.

## Information architecture

Ship five navigable views plus a login gate.

```text
Password gate
  └─ Overview (/)
       ├─ Alerts list (/alerts) [optional page; overview queue is sufficient initially]
       ├─ Jobs explorer (/jobs)
       │    └─ Job detail (/jobs/:jobId)
       ├─ Machine detail (/machines/:machineId)
       └─ Ontology Control (/admin/ontology) [administrator only]
```

| Route | Page spec | Build task |
| --- | --- | --- |
| `/` | [`pages/overview.md`](pages/overview.md) | W1-overview |
| `/jobs` | [`pages/jobs-explorer.md`](pages/jobs-explorer.md) | W1-jobs |
| `/jobs/:jobId` | [`pages/job-detail.md`](pages/job-detail.md) | W1-jobs |
| `/machines/:machineId` | [`pages/machine-detail.md`](pages/machine-detail.md) | W1-machines |
| `/alerts` (optional) | [`pages/alerts.md`](pages/alerts.md) | W1-machines |
| `/admin/ontology` | [`pages/ontology-control.md`](pages/ontology-control.md) | W1-admin |

There is deliberately no standalone ontology graph, facility page, customer page,
quality-rankings page, tool page, or material-lot page in v0.0. Those concepts appear as linked
context in job and machine views. Ontology Control changes semantic configuration, never raw
source events.

### Global shell

- Fixed left rail: `Overview`, `Jobs`, `Alerts`, `Machines`; an `ADMIN` section contains
  `Ontology Control`.
- Top bar: breadcrumb and facility selector (`All facilities`, `LA-01`, `LA-02`).
- `HELICON / ARGOS v0.0` wordmark with a restrained resin-amber mark.
- Show an `ADMIN` indicator in the top bar for the demo account.
- Dark "Laminate" design system from `ARGOS.md §5`: flat panels, 1px borders, no shadows, no
  rounded/pill-heavy consumer-app styling.
- Inter for written labels; IBM Plex Mono for IDs, dates, quantities, and all KPI values.

The selected facility must affect every count, list, and chart in the current view. It should
persist in the URL query string.

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

## Cross-cutting decisions (locked)

1. **Data freshness/provenance:** show the frozen event horizon (`2026-08-13 23:06 UTC`) and
   latest source event in page context. Every alert/detail screen needs a visible evidence
   path to event IDs.
2. **URL state:** facility, job filters, and machine time windows belong in query parameters so
   investigations are shareable and refresh-safe.
3. **Metric definitions:** define active, blocked/held, overdue, yield, recent activity, and
   cycle-time baseline at query level before implementing tiles.
4. **Role state:** the demo account is an admin. Make that status visible but do not pretend it
   is production multi-tenant authorization.
5. **Drill-through consistency:** every summary has one destination; its destination title
   echoes the originating filter/rule.
6. **Sparse-data honesty:** show coverage for material lots (14 scans), unit-price estimates,
   and missing machine IDs rather than displaying misleading zeroes.

## Build order

Sequencing, ownership, waves, and cut lines are owned by `BUILD.md`; this document and the
`pages/` specs define *what* each screen is, not *when* it is built.

## Acceptance test: the demo path

1. Open Overview and select the `press_03` alert.
2. Read the rule and evidence; open `press_03` machine detail.
3. See the slow/rising cycle-time trend and affected jobs.
4. Open an affected job and inspect its raw event timeline.
5. Return to Overview, open overdue work, and use the filtered Job explorer.
6. Open `job_0152` to demonstrate a blocked job with an observed material-lot scan.

If this path is fast, clear, and source-traceable, v0.0 succeeds.
