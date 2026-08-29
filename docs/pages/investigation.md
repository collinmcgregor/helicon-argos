# Page: Investigation (P1 action layer)

| | |
| --- | --- |
| **Route** | `/investigations/:investigationId` or right-side detail drawer |
| **Build task** | P1; do not delay the alert → evidence MVP |
| **Query module** | `lib/queries/investigations.ts` |
| **Data** | separate `investigations` and `investigation_evidence` records; raw events remain immutable |

Global shell, states, and source/evidence contract: `../DESIGN.md` and `../DATA-FLOWS.md`.

## Purpose

Close the operational loop after Argos finds a risk. An investigation records that a person saw a
specific derived alert, which evidence they relied on, and the next intended action. It is not a
replacement for a CMMS, ticket system, or modification of factory history.

## Create flow

An alert-selected panel offers **Start investigation**. The form is prefilled with:

- alert rule, severity, explanation, and implicated object ID
- linked job/machine context
- supporting `event_id`s
- the frozen event horizon/time window

The user adds only an owner and concise note/action. On save, Argos stores references to the
immutable evidence set and opens the investigation detail.

## Detail layout

```text
Investigation INV-0042                     OPEN · owner: Factory Admin
press_03 cycle-time drift

Why this exists        Evidence retained                 Impacted work
25% above fleet        evt_… cycle samples               job_…  overdue
rising; no maint.      no maintenance events             job_…  active

Next action
Schedule press_03 inspection before next shift.          [Update note]
```

## Guardrails

- Never permit editing, deleting, or relabeling raw events.
- Preserve the evidence event ID set that existed when the investigation was created.
- Derived alerts may change on recomputation; the investigation retains its original rule and
  evidence snapshot with a “current alert state” comparison.
- v0.0 may omit comments, attachments, workflow automation, notification routing, and complex
  state machines.
