# Helicon Argos (v0.0) — Build Plan

> **Status: partially superseded.** The ontology, modeling rules, and relationship rules here
> remain authoritative. Feature priority and data findings now live in `ARGOS.md`; execution
> in `BUILD.md`; page specs in `DESIGN.md` + `pages/`. Known deltas decided after this doc:
> Supabase Auth is **cut** (password middleware instead); the standalone asset-quality ranking
> page is **cut** (failure rate is flat — see `ARGOS.md §1`); Ontology Control
> (`/admin/ontology`) was **added**.

## Product definition

Helicon Argos is a manufacturing operations digital twin built from `manufacturing_events.jsonl`, a 19,519-row synthetic event log. It is not a 3D factory visualizer and not a generic BI dashboard. It is an operational system that turns fragmented historical events into connected, current-state objects and an explainable exception workflow.

The central user journey is:

```text
Signal → investigate evidence → understand impacted work → take an action
```

### MVP decision

Build **one exceptional investigation workflow well**:

> A user opens a quality or delivery-risk alert, sees why it was triggered, navigates to the implicated job/machine/tool, and sees the affected work and raw-event evidence.

The dashboard exists to drive users into this flow. Do not spend MVP time on full simulation, machine learning, arbitrary graph exploration, or workflow features that cannot be persisted meaningfully.

## Source of truth and modeling rules

`manufacturing_events.jsonl` is the sole source of truth. Preserve raw events and make every derived number, relationship, and alert drillable to supporting event IDs.

### Raw schema

Every event has:

```text
event_id, timestamp, event_type, job_id, part_id, customer_id,
machine_id, material, quantity, metadata
```

`metadata` contains only these observed keys:

```text
facility, tool_id, cycle_time_seconds, inspector_id, defect_code,
operator_id, good_quantity, scrap_quantity, priority, target_due_at,
target_quantity, unit_price_estimate, reason, lot_id, signal
```

### Observed objects

| Object | Count | Raw source |
| --- | ---: | --- |
| Event | 19,519 | Every JSONL row |
| Job | 312 | `job_id` |
| Part | 25 | `part_id` |
| Customer | 16 | `customer_id` |
| Facility | 2 | `metadata.facility` |
| Material | 8 | `material` |
| Machine | 10 | `machine_id` |
| Tool | 25 | `metadata.tool_id` |
| Production Cycle | 12,965 | `cycle_completed` |
| Inspection | 5,153 | inspection events |
| Material Lot | 14 | `material_lot_scan` / `lot_id` |
| Operator | 24 | `operator_id` |
| Inspector | 12 | `inspector_id` |
| Asset Event | 32 | maintenance and sensor events |

### Derived object

`OperationalIssue` is an Argos-created object, backed by source events. It can be created from a blocked/held job, a failed inspection, or an asset event. In v0.0, it may be read-only and generated at query time; do not fabricate a permanent source ID for it.

### Relationship rules

Use solid relationship edges only for facts directly recorded by an event:

```text
Customer → Job → Part / Facility / Material
Job → Production Cycle → Machine / Tool / Material
Job → Inspection → Inspector
Material Lot → Job
```

Mark these as derived/inferred in both code and UI:

- inspection to a specific production cycle (only the shared job and event time are known)
- tool-to-machine as a permanent assignment (only historical co-occurrence is known)
- issue-to-machine/tool impact
- delivery risk, quality risk, anomaly, and current job status

Do not connect `Operator` to a Production Cycle. Operators only appear in 243 `job_started` events, so the accurate relationship is **Operator → started/handled → Job**.

## Product scope

### P0: required MVP features

#### 1. Ingestion and materialized ontology

Implement a repeatable script that reads JSONL and creates queryable tables/views for:

- raw events, with flattened metadata columns
- jobs and latest job state
- production cycles
- inspections
- machines and tools
- asset events
- material lots
- derived alert candidates

Requirements:

- Raw `event_id` must be retained everywhere for audit/drill-down.
- Never mutate or overwrite the source JSONL.
- The output should be deterministic and runnable from a single command.

#### 2. Operations overview

Build one landing page with:

- job state counts: active, blocked/held, completed, at-risk
- a compact LA-01 / LA-02 recent-activity comparison
- a systemic-quality evidence note, not an asset-quality ranking
- a ranked, clickable “Needs attention” list

Keep the page operational. Every chart/card should lead to a filtered list or investigation.

#### 3. Job explorer

Build a sortable/filterable job table. Show:

- job, customer, part, facility, material
- status, priority, target due date, target quantity
- authoritative completion outcome (good/scrap quantity and yield when a completion exists)
- production activity (cycle count and cumulative cycle quantity), kept separate from completion
- linked machine/tool history
- risk/reason

Filters: facility, customer, status, priority, material, due-date/risk state.

#### 4. Job detail / evidence timeline

Selecting a job should show:

- current status and derived metrics
- chronological raw-event timeline
- production cycles and total quantity
- inspection outcomes and defect codes
- linked machines, tools, lot scans, and blockers/holds
- clear links/identifiers back to raw events

#### 5. Asset-quality investigation

Build a machine-performance investigation that exposes:

- cycle-time median, fleet comparison, and time trend
- cycle count / production activity
- machine sensor and maintenance evidence
- affected jobs and latest relevant events

The investigation must be able to start from an alert and reach its evidence and affected jobs.
Do not rank assets by inspection failure rate: inspection events occur at QC stations and the
observed failure rate is flat across the candidate production dimensions.

#### 6. Explainable alert candidates

Implement three transparent alert rules—not ML:

- **Blocked / held job:** latest lifecycle state is blocked or held.
- **Due-date risk:** target date has passed while the job is not completed; optionally flag near-due, incomplete jobs.
- **Cycle-time signal:** a machine/tool’s recent cycle time exceeds its historical baseline, subject to a minimum sample size.

Each alert must include: rule name, severity/priority, a human-readable explanation, implicated object IDs, and supporting event IDs.

Inspection failure composition, maintenance pings, and sensor glitches are evidence that enriches
an investigation; they are not generic alerts in v0.0. The known `press_06` event chain is an
exception because it supports a specific cycle-time investigation.

#### 7. Admin ontology control

For this demo, the password-gated factory user is an administrator. Add an **Ontology Control** screen that lets that user evolve Argos’s semantic configuration without changing the immutable raw-event log.

The admin can create, edit, or archive object definitions (label, plural label, ID field, description, source type), field definitions (label, type, source mapping, description, visibility), and relationship definitions (from/to object, relationship label, source mapping, provenance).

Persist definitions in Supabase configuration tables and show them immediately in the object catalogue. Every configured field and relationship must declare `observed`, `derived`, or `external` provenance and a source mapping. Adding a definition must never imply that source data was created.

**v0.0 boundary:** the admin may map to known raw fields, approved materialized-view fields, or a future external source—not add raw-event columns, execute arbitrary SQL, or assert unproven relationships. A configured object with no imported records shows an explicit empty state.

### P1: only after P0 is complete

- Asset, tool, facility, and customer detail pages.
- Material-lot impact view; clearly show that lot data is sparse (14 scans).
- Derived issue view grouping related alert evidence.
- Shift handoff summary using the 17 handoff events plus open risks.
- CSV export and URL-persisted filters.
- Basic acknowledgement / owner / note state for issues.
- A lightweight investigation action that records a selected alert/evidence set, owner, and note
  without mutating raw events.

### P2: backlog

- Capacity and due-date forecasting based on remaining work and observed yield.
- Root-cause comparison view: compare before/after a defect or throughput change.
- Statistical anomaly detection with configurable baselines.
- What-if scheduling and machine-load simulation.
- Real-time ingestion, notifications, integrations with MES/ERP/CMMS.
- Role-based access, audit logs, comments, and alert routing.
- Complete material genealogy / recall workflow, contingent on richer lot data.

## Chosen implementation architecture

```text
manufacturing_events.jsonl
          ↓
TypeScript or Python ingestion / transformation
          ↓
Supabase Postgres: raw events + materialized ontology tables
          ↕
Ontology configuration tables (admin-managed definitions)
          ↓
Next.js server components / route handlers
          ↓
Next.js / React UI
          ↓
Password gate + Vercel deployment
```

### Why this choice

Use Supabase rather than DuckDB as the deployed application database. The dataset is small (19,519 events), relational, and stable enough that Postgres is more than sufficient. Supabase removes the need to separately build hosted persistence; Vercel makes Next.js deployment and environment-variable management straightforward.

DuckDB is excellent for local exploration, but it adds a second data system without giving the MVP a user-facing benefit. It is optional for ad hoc analysis only, not part of the deployed path.

### Supabase responsibilities

- **Postgres:** tables for raw events and materialized ontology objects/summary views.
- **Ontology configuration:** versioned object, field, and relationship definitions, including editor and timestamp.
- **Migrations/seeds:** commit schema migrations and a repeatable JSONL ingestion command; never commit Supabase secrets.

### Vercel responsibilities

- Deploy the Next.js app from the `main` branch.
- Store Supabase URL/key and any app-password secrets as deployment environment variables.
- Provide the public deployed URL.

### Authentication decision

Use a minimal server-side password gate in Next.js middleware, backed by an `APP_PASSWORD` deployment environment variable. It directly satisfies the take-home’s “basic auth password” requirement and avoids consuming the time budget on email confirmation, sessions, and RLS debugging.

For the demo, a user who passes this gate is an administrator. Display an `ADMIN` indicator and gate `/admin/ontology` behind that state. In a production multi-user version, replace the gate with Supabase Auth, role claims/profiles, and Row Level Security policies. Do not place the password in client-side code or the repository.

Suggested UI libraries: Tailwind CSS, TanStack Table, Recharts. Prioritize simple, well-labeled interaction over complex visual effects.

## Suggested implementation order

### Phase 1 — data foundation

1. Scaffold app structure and development commands.
2. Implement JSONL ingestion plus flattened raw-events table.
3. Build and test materialized job/cycle/inspection/asset tables.
4. Add deterministic alert-candidate queries.
5. Validate counts against this document.

### Phase 2 — MVP interface

1. Implement operations overview and alert queue.
2. Implement job list with filters and drill-down.
3. Implement job detail timeline/evidence.
4. Implement asset ranking/investigation.
5. Connect every primary UI item to evidence.

### Phase 3 — hardening and delivery

1. Add loading, empty, and error states.
2. Check displayed totals against DuckDB queries.
3. Add basic auth and deployment configuration.
4. Write local-run and deployment instructions.
5. Commit coherent milestones and verify the deployed workflow.

## Definition of done for v0.0

- A user can open a deployed, basic-auth-protected URL.
- The dashboard shows real values derived from the supplied JSONL.
- A user can identify a risky job or asset, open its detail view, and inspect the raw evidence behind it.
- The ontology honors known data limitations; derived/inferred relationships are never represented as raw facts.
- The repo has readable setup instructions and commit history.
