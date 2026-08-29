# DATA FLOWS — Source, Derived State, Evidence, and Navigation

`manufacturing_events.jsonl` is immutable source evidence. Every product view reads either a
materialized object/view derived from that evidence or an administrator-managed ontology
definition. No page mutates source events.

## Canonical data path

```text
JSONL Event
  → events (flattened, event_id retained)
  → jobs_current / cycles / inspections / machine_stats / alerts
  → page query
  → linked object/detail page
  → supporting event_id evidence
```

## Materialized model contract

| Model | Grain | Source events | Used by |
| --- | --- | --- | --- |
| `events` | one raw event | all events | timelines and evidence logs |
| `jobs_current` | one job | lifecycle + completion events | overview, Jobs Explorer, Job Detail, alerts |
| `cycles` | one `cycle_completed` event | cycles | machine trend, Job Detail, affected-work links |
| `inspections` | one inspection event | inspection pass/fail | Job Detail, systemic-quality evidence |
| `machine_stats` | one production machine + time window | cycles; asset events as annotations | Machine Detail, cycle-time alerts |
| `alerts` | one derived rule finding | jobs_current, machine_stats, supporting events | Overview queue, optional Alerts page |
| `ontology_*` | one configuration definition/version | admin-authored configuration only | Ontology Control |
| `investigations` | one user-created follow-up | alert reference + selected evidence IDs | investigation drawer/detail, P1 |

## Semantic definitions that cannot be improvised in UI

| Concept | Definition | Caveat |
| --- | --- | --- |
| Frozen now | `2026-08-13T23:06:33Z` | Never use wall-clock time for business status. |
| Completed | job has a `job_completed` event after lifecycle replay/deduplication | Preserve duplicate source events; display a data-quality note when relevant. |
| Blocked/held | latest applicable lifecycle event is `job_blocked` or `job_hold`, not superseded by `job_unblocked`/completion | Derived state, not a raw column. |
| Active | created/started, not terminally completed, and not currently blocked/held | Derived state. |
| Overdue | target due date is before frozen now and job is not completed | Estimated order value must disclose unit-price coverage. |
| Completion outcome | `good_quantity` and `scrap_quantity` from completion event | Authoritative outcome when available. |
| Production activity | cycle count and sum of `cycle_completed.quantity` | Never label this as completion progress; 237 completed jobs have cycle total ≠ target. |
| In-process inspection failure | failed inspection quantity / all inspected quantity | Not final yield; inspections happen at QC stations. |
| Machine quality attribution | job → cycle association joined to job inspections | Always show `DERIVED`; never treat `qc_01`/`qc_02` as production machines. |
| Recent facility activity | completed-cycle quantity in final 24 hours before frozen now | It is not a “currently running” signal. |

## Route-to-data and drill-through matrix

| Page | Reads | Primary click | Destination receives | Evidence shown |
| --- | --- | --- | --- | --- |
| Overview | jobs_current, machine_stats, alerts, inspections summary | alert row | rule + object ID + facility/window filters | alert’s supporting event IDs in selected panel |
| Overview | facility summary | facility pulse | `facility` query parameter | latest facility event timestamp |
| Jobs Explorer | jobs_current | job row | `jobId` route parameter | risk/reason and derived-state explanation |
| Job Detail | jobs_current, events, cycles, inspections, lot scans | machine ID | `machineId`; optional time window | job’s raw timeline/event IDs |
| Machine Detail | machine_stats, cycles, asset events, affected jobs | affected job row | `jobId` | cycle, sensor, maintenance event IDs |
| Alerts (optional) | alerts | alert row | same object/filter destination as Overview | supporting event IDs |
| Ontology Control | ontology_* definitions | object/field/relationship definition | configuration ID | source mapping, provenance, editor/timestamp |
| Investigation (P1) | alerts plus selected source IDs | start/continue investigation | investigation ID | immutable evidence ID set + note history |

## Data confidence requirements

- Show lot coverage: `14 / 312 jobs`; do not claim lot blast radius because each observed lot maps to one job.
- Show price coverage wherever using money: `150 / 312 jobs` have `unit_price_estimate`.
- Preserve and surface data anomalies when they affect interpretation, including the duplicate completion for `job_0293`.
- Source event IDs are the audit key; derived links always expose their method.
