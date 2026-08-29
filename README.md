# Helicon Argos (v0.0)

**Helicon Argos** is an operations digital twin for discrete manufacturing. It turns a raw, append-only event log into a connected representation of factory work, assets, quality, and delivery risk—so an operations team can move from a signal to evidence to action.

The starting data is `manufacturing_events.jsonl`, a synthetic manufacturing-event log with 19,519 events. It records job lifecycle changes, production cycles, inspection outcomes, tooling, machine signals, materials, facilities, and quantities.

## Product purpose

A spreadsheet can summarize what happened. It cannot reliably maintain current operational state, connect related entities, detect cross-event patterns, or give a team a shared workflow for resolving exceptions.

Dragonfly will answer:

- Which jobs are active, blocked, late, or likely to miss their due date?
- Which machines, tools, materials, or defects are associated with quality and throughput risk?
- If an asset or material is suspect, which jobs, parts, and customers are affected?
- What is the evidence behind an operational alert, and what should happen next?

The product is an **operational digital twin**, not a 3D model of a factory. The twin maintains the changing business state of the production system from its immutable source events.

## Ontology

### Source of truth

`Event` is the immutable source record:

| Field | Role |
| --- | --- |
| `event_id`, `timestamp`, `event_type` | event identity, occurrence time, and classification |
| `job_id`, `part_id`, `customer_id` | work-order, product, and customer relationships |
| `machine_id`, `metadata.tool_id` | asset relationships |
| `material`, `metadata.lot_id` | material traceability |
| `quantity`, cycle/inspection/completion metadata | operational measurements and outcomes |
| `metadata.facility`, people IDs, reason, signal | location, responsibility, explanations, and evidence |

### Core objects

| Object | Key properties | Primary relationships |
| --- | --- | --- |
| `Job` | status, due date, priority, target/good/scrap quantity, delivery risk | customer, part, facility, cycles, inspections, issues |
| `ProductionCycle` | occurred at, quantity, duration | job, machine, tool, material, lot, operator |
| `Inspection` | result, defect code, occurred at | job/cycle, inspector, issue |
| `Machine` | facility, utilization, throughput, quality metrics | cycles, tools, machine events, issues |
| `Tool` | performance and quality metrics | cycles, machines, issues |
| `Material` / `MaterialLot` | material name, lot ID | jobs and cycles |
| `Part`, `Customer`, `Facility`, `Person` | identifiers and aggregate metrics | jobs, activity, assets |
| `OperationalIssue` | type, reason, severity, state, evidence | affected jobs, machines, tools |

```text
Customer → Job → Part
                 ├→ Production Cycle → Machine / Tool / Material / Lot
                 ├→ Inspection → Defect / Operational Issue
                 └→ Facility

Machine or sensor event → Operational Issue → affected jobs, machines, tools
```

### Derived state

The ingestion layer materializes current objects and derived metrics from events:

- job lifecycle and current status
- completed, good, and scrap quantity; yield
- inspection pass/fail and defect-rate rollups
- throughput and cycle-time baselines by asset/material/part
- due-date risk, blocked/held work, and revenue at risk
- traceability from an anomalous tool, machine, or material lot to affected jobs

## Primary workflow

**Signal → investigation → affected work → recommended action.**

An operator sees a quality or delivery-risk alert, opens its evidence, traverses to the implicated machine/tool/material and affected jobs, and records/acknowledges the issue. This produces a shared operational queue rather than another passive dashboard.

## Feature plan

### P0 — build first (time-boxed MVP)

1. **Repeatable event ingestion and ontology materialization**
   - Parse JSONL into analytical tables and derived job, cycle, inspection, and asset summaries.
   - Preserve raw events as drill-down evidence.

2. **Operations overview**
   - Active, blocked, completed, and delivery-risk jobs.
   - Throughput, quality/yield, and inspection-failure trends.
   - A ranked “needs attention” queue.

3. **Job explorer and timeline**
   - Filter/sort jobs by facility, customer, status, priority, due date, material, and risk.
   - Show lifecycle history, quantities, linked assets, inspections, and blockers for a selected job.

4. **Asset-quality investigation**
   - Rank machines/tools by cycle-time deviation and inspection failures.
   - Link a suspect asset to its evidence and affected jobs.

5. **Simple explainable alerts**
   - Near/overdue unfinished job.
   - Blocked or held job.
   - Unusually high inspection failure rate or cycle duration relative to historical baseline.
   - Machine/sensor/maintenance event followed by relevant quality or throughput degradation.

6. **Delivery essentials**
   - Basic-auth-protected deployed app, concise README, reproducible local setup, and committed source history.

### P1 — if time remains

- Impact / “blast radius” traversal for a material lot, tool, or machine.
- An issue detail view with acknowledgement, owner, notes, and resolution state.
- Shift-handoff summary of changed conditions, open risks, and priorities.
- Exportable filtered reports and deep links into a job/asset investigation.
- Customer and facility drill-down pages.

### P2 — backlog

- Better due-date forecasting based on remaining work, yield, queues, and capacity.
- Statistical anomaly detection with configurable thresholds and seasonality.
- Root-cause comparison workspace: before/after a quality or throughput change.
- Capacity simulation and what-if schedule reallocation.
- Real-time event ingestion and notifications.
- Role-based access, alert routing, comments, audit trail, and integrations with MES/ERP/CMMS systems.
- Material genealogy and formal quality-containment / recall workflow.

## Proposed technical approach

- **Data/model:** Python ingestion plus DuckDB for fast local analytical queries and materialized ontology tables.
- **API:** FastAPI endpoints for jobs, assets, alerts, timelines, and graph-style relationships.
- **UI:** Next.js/React, TypeScript, Tailwind, TanStack Table, and Recharts.
- **Deployment:** a small cloud deployment with basic-auth middleware; exact host selected during implementation.

This split keeps the demo fast and reproducible: the raw log remains auditable, while the UI queries product-level objects rather than scanning JSONL in the browser.

## Implementation sequence

1. Profile event types and create the reproducible ingestion/model layer.
2. Define summary tables and alert rules, validating them against raw events.
3. Build the overview and job explorer.
4. Add the asset-quality investigation and evidence drill-down.
5. Polish the primary workflow, add basic auth, deploy, and document the result.
