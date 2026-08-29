# Helicon Argos (v0.0)

A digital factory twin for composite manufacturing

## Live app

**https://helicon-argos-collinmcgregors-projects.vercel.app**

password: `argos-demo-2026`

### What the app evaluates

| Element | What it represents | How it is calculated / used |
| --- | --- | --- |
| Job | One customer production order | Lifecycle events establish its current state: created, in progress, blocked, held, or completed. |
| Production cycle | A completed unit of machine work | Used for cycle-time trends and machine workload; it is context, not completion progress. |
| Inspection | A QC pass or failure | Recorded at QC stations. Quality is associated with a production press through the shared job, so the UI labels it **derived**. |
| Machine | A production press | Median cycle time, drift, maintenance signals, and affected jobs are computed from its cycles and events. |
| Facility | LA 1 or LA 2 | Aggregates open, blocked, and overdue work to give a location-level status snapshot. |
| Alert | A calculated operational finding | A rule with a business-impact statement, supporting source events, and a route to investigate. |
| Ontology configuration | Admin-managed definitions of objects, fields, and relationships | Versioned configuration only; it never changes source events or analytical facts. |

### Alert criteria

| Finding | Rule | What the operator should do |
| --- | --- | --- |
| Slow press | A press’s median cycle time is more than 15% above the median of the other production presses. Drift compares its first and second half of observed cycles. | Open the press investigation, examine the trend and raw cycles, then schedule or verify maintenance. |
| Overdue customer work | A job is past its due date at the frozen event horizon and its lifecycle is not completed. | Open the overdue jobs list and prioritize recovery by value, customer, and blockage. |
| Blocked work | A job’s latest lifecycle state is `blocked` or `held`. Missing tools are highlighted when they are the leading recorded block reason. | Resolve the tooling constraint first, then confirm affected jobs resume. |
| Recovered machine incident | A sensor glitch is followed by maintenance within three days, a later cycle-time spike, and then recovery. | Review as evidence of a possible sensor-to-throughput relationship, not as proof of causality. |
| Systemic quality signal | Inspection failure rates remain similar across presses, tools, facilities, and inspectors; defects recur across materials. | Investigate the shared process step rather than treating one machine as the cause. |

## Page guide

| Page | Primary question | Key elements | Where it leads |
| --- | --- | --- | --- |
| **Overview** (`/`) | What needs attention first? | KPI tiles, labeled factory status, priority queue, selected investigation | Overdue jobs, machine investigation, or filtered blocked work |
| **Jobs** (`/jobs`) | Which orders need action? | Filterable current-state job table, due-date and value-at-risk context | Job detail |
| **Job detail** (`/jobs/:jobId`) | What happened to this order? | Lifecycle and production timeline, machines/tools, inspections, blockers, material-lot traceability | Linked machines and raw timeline evidence |
| **Machines** (`/machines`) | Which press needs investigation? | Fleet comparison table with cycle-time and drift signals | Machine detail |
| **Machine detail** (`/machines/:machineId`) | Is this press underperforming, and why? | Performance strip, weekly cycle-time chart, affected work, readable raw-event table, quality-rate chart and raw inspection evidence | Specific jobs and event records |
| **Alerts** (`/alerts`) | What rules are currently firing? | All derived findings with business impact and evidence links | The relevant job or machine investigation |
| **Ontology Control** (`/admin/ontology`) | How does Argos interpret the factory? | Versioned object, field, and relationship definitions; ontology map | Admin configuration history |

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16 (App Router, React Server Components, TypeScript), Tailwind CSS v4, custom "Laminate" design system (light + dark themes) |
| Backend | Next.js server components + route handlers on Vercel; all SQL behind typed query modules (`lib/queries/*`) |
| Database | Supabase Postgres — raw immutable `events` table + derived views (`jobs_current`, `cycles`, `machine_stats`, `alerts`…) + versioned `ontology_*` config tables; bulk `psql \copy` ingest |
| Auth | Deliberate minimal password gate in Next.js middleware (`APP_PASSWORD` env var, cookie session) — per the brief's "basic auth password"; no user accounts by design |
| Testing | Three layers — SQL validation gates (`npm run validate`), exact-value query tests + route smoke tests (vitest), `npm run check` as the single ship gate; plus an independent JSONL recompute audit (0 mismatches) |
| Deploy | Vercel (functions pinned to `pdx1`, same region as the database) |

## Repo tour

```
supabase/schema.sql       tables + derived views (jobs_current, cycles, machine_stats, alerts…)
scripts/ingest.sh         repeatable JSONL → Postgres bulk load
scripts/validate.sql      layer-1 data gates (run: npm run validate)
lib/queries/*.ts          the only code that touches SQL; typed domain results
app/                      overview · jobs explorer · job detail · machine detail · alerts · /admin/ontology
components/               "Laminate" kit: panels, badges, ply bars, timeline, tiles
docs/                     product plan, design system, data contract, per-page specs
tests/                    query-layer exact-value tests + route smoke tests
```


