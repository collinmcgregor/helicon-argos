# Page: Ontology Control (admin)

| | |
| --- | --- |
| **Route** | `/admin/ontology` |
| **Build task** | W1-admin |
| **Query module** | `lib/queries/ontology.ts` |
| **Test file** | `tests/queries/ontology.test.ts` |
| **Data** | versioned ontology-configuration tables (Wave 0-A schema); never source events |

Global shell, states, and cross-cutting rules: `../DESIGN.md`. Data contract and provenance
rules: `../DATA-FLOWS.md`.

## Purpose

Show that Argos is an extensible operating model, not a one-off dashboard. The demo
administrator can evolve semantic configuration without changing raw source events.

## Layout

Two stacked sections: the **Ontology map** (read-only visualization) on top, the
**master/detail configuration editor** below. The map visualizes; the forms edit.

### Ontology map (pipeline-builder-style, read-only)

A layered node-link diagram of the configured ontology, rendered **from the configuration
tables** — so an admin edit (add object/relationship) visibly changes the map on save. Styled
like Foundry's pipeline builder, flowing left → right:

```text
┌ ONTOLOGY MAP ──────────────────────────────── OBSERVED ─ DERIVED ─ EXTERNAL ┐
│                                                                             │
│  ┌─────────────┐     Customer ──places──▶ Job ──produces──▶ Part            │
│  │ Raw Event   │╌╌╌▶     Job ──contains──▶ Production Cycle ──uses──▶ Tool  │
│  │ Log         │╌╌╌▶     Cycle ──runs on──▶ Machine   Lot ─observed on─▶ Job │
│  │ (19,519)    │╌╌╌▶     Job ──has──▶ Inspection ◀──performs── Inspector    │
│  └─────────────┘         Inspection ╌may create╌▶ Operational Issue         │
│     materializes         Machine/Sensor Event ╌affects╌▶ Operational Issue  │
└─────────────────────────────────────────────────────────────────────────────┘
```

Rules:

- **Fixed layered layout** (columns: source → core objects → assets/quality → derived), not
  force-directed. Node positions come from a small layout map in code; edges are one SVG layer
  with computed anchors. **No react-flow, no d3, no drag** — this is a diagram, not a canvas.
- Nodes: Laminate panels (flat, 1px border, mono record count from the live views, e.g.
  `Job · 312`). Provenance color-codes the border/label: observed (cobalt), derived (resin
  amber), external (muted). The Raw Event Log node anchors the left edge — everything
  visibly materializes from it (dashed edges), mirroring the source-of-truth principle.
- Edges: solid for observed relationships, dashed for derived/`may create`, each with its
  verb label (`places`, `contains`, `runs on`…). Derived edges show their caveat on hover.
- Clicking a node or edge **selects it in the editor below** (master/detail); it does not open
  a modal or navigate.
- A definition with no materialized data renders as a ghost node:
  `Configured · no records available from a source`.
- Archived definitions are hidden from the map, listed only in the catalogue.
- The map must never show an inspection directly evaluated by a production machine; that edge is
  only a derived Job → Cycle association and is labeled/caveated if displayed.

This map is the page's demo moment: add a relationship in the form, save, watch it appear.

### Configuration editor (master/detail)

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

Do **not** build: an interactive graph *editor* (drag-to-position, drag-to-wire — the map is
read-only and edits happen in the forms), an arbitrary SQL editor, or a dynamic ingestion
builder.

## Page data and links

- Reads/writes only versioned `ontology_*` configuration tables; raw events and materialized
  production views remain read-only on this screen.
- Each source mapping links to its source model/field description. Saving a definition updates
  the catalogue and read-only map, but never claims to create underlying event records.
- Changes display editor, timestamp, active/archive state, and prior version so an administrator
  can explain how the semantic model evolved.

## Build order within the task

Config tables + editor forms first (the persistence story), then the map (the visual story).
If the task runs long, the map ships with fewer edge labels before the editor loses any
guardrail. Both halves stay behind the `ADMIN` nav section.
