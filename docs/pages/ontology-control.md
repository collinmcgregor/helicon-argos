# Page: Ontology Control (admin)

| | |
| --- | --- |
| **Route** | `/admin/ontology` |
| **Build task** | W1-admin |
| **Query module** | `lib/queries/ontology.ts` |
| **Test file** | `tests/queries/ontology.test.ts` |
| **Data** | versioned ontology-configuration tables (Wave 0-A schema); never source events |

Global shell, states, and cross-cutting rules: `../DESIGN.md`. Cut-line note: this is the
newest scope — first task cut under schedule pressure (`../BUILD.md`).

## Purpose

Show that Argos is an extensible operating model, not a one-off dashboard. The demo
administrator can evolve semantic configuration without changing raw source events.

## Layout

A master/detail configuration screen, not a graph canvas:

```text
Ontology Control                                      [ADMIN]
Define how Argos interprets factory data.

[Objects] [Relationships] [Fields]                    [+ Add object]

Object catalogue                  Selected object: Job
─────────────────                 ────────────────────────────────────
Job             observed          Label, plural label, description
Machine         observed          ID field: job_id
Inspection      observed          Source: jobs_current (materialized)
Operational Issue derived         Fields: status, priority, due date …
                                  [Edit] [Archive]
```

## Admin operations and guardrails

| Admin action | Inputs | Result |
| --- | --- | --- |
| Add object | label, plural label, ID field, description, source mapping | Adds a configured object definition. |
| Add field | object, label, type, mapping, provenance | Adds a documented field definition. |
| Add relationship | from, relationship label, to, mapping, provenance, caveat | Adds a documented edge definition. |
| Edit/archive | existing definition | Creates a versioned configuration change; never deletes evidence. |

Every relationship visibly carries `OBSERVED`, `DERIVED`, or `EXTERNAL`; a derived relationship
requires a method/caveat. A newly configured object with no imported/materialized data says:
**Configured; no records are currently available from a source.** The forms select approved
raw/view fields and do not run arbitrary SQL.

Do **not** build: a graph canvas, an arbitrary SQL editor, or a dynamic ingestion builder.
