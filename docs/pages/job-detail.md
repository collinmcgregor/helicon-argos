# Page: Job Detail

| | |
| --- | --- |
| **Route** | `/jobs/:jobId` |
| **Build task** | W1-jobs (with `jobs-explorer.md`) — **the non-negotiable page** |
| **Query module** | `lib/queries/jobs.ts` |
| **Test file** | `tests/queries/jobs.test.ts` |
| **Key demo object** | `job_0152` — blocked **and** lot-scanned (`lot_6626`); lot coverage 14 / 312 jobs |

Global shell, states, and cross-cutting rules: `../DESIGN.md`.

## Purpose

Prove Argos's ontology and source discipline. This is the most important detail screen.

## Header

- Breadcrumb: `JOBS / job_0152`
- Status and risk badge.
- Customer, part, facility, material, priority, due date.
- Target quantity, completion quantity, good/scrap outcome when present.
- A thin ply-stack yield bar only when completion quantities exist.

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

`job_0152` should be easy to find, because it demonstrates blocked work plus a material-lot
trace — the traceability thread in the demo script (`../ARGOS.md §4`).
