# Page: Alerts List (optional P0 route)

| | |
| --- | --- |
| **Route** | `/alerts` |
| **Build task** | W1-machines (optional add-on; skip freely) |
| **Query module** | reuses the `alerts` view via `lib/queries/machines.ts` |
| **Test file** | covered by `tests/queries/machines.test.ts` + smoke |

Global shell, states, and cross-cutting rules: `../DESIGN.md`. Data contract and destinations:
`../DATA-FLOWS.md`.

## Exact layout

```text
┌──────────────┬──────────────────────────────────────────────────────────────┐
│ HELICON /    │ INVESTIGATE / ALERTS                        [All facilities] │
│ ARGOS v0.0   ├──────────────────────────────────────────────────────────────┤
│              │ Alerts                                [Severity ▾] [Rule ▾]  │
│ OPERATE      │ ━ amber seam ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│   Overview   │ ┃ ✕ CRITICAL  Slowing cycle time — press_03                  │
│   Jobs       │ ┃   1,294s median · 25% above fleet · rising    → machine    │
│              │ ┃ ∣ WARN      Overdue incomplete work                        │
│ INVESTIGATE  │ ┃   26 jobs · $590K order value                 → jobs       │
│ ▌ Alerts     │ ┃ ∣ WARN      Tooling constraint                             │
│   Machines   │ ┃   missing_tool 28/68 · 9 stranded             → jobs       │
│              │ ┃ ⟋ INFO      Recovered incident — press_06                  │
│ ADMIN        │ ┃   sensor + maintenance → temporary spike      → machine    │
│   Ontology   │ ┃  3px severity left-border rows · evidence event_ids inline │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

Do not build a separate alert object page unless the overview queue has already shipped. If it
does ship, use it only as an expanded, filterable version of the queue. Alerts remain
query-time derived objects with source-event evidence, not editable tickets — every row carries
rule name, severity, human explanation, implicated object IDs, and supporting `event_id`s.

Rows use the same destinations as Overview: machine cycle-time findings open Machine Detail;
overdue and tooling findings open Jobs Explorer with supplied filters. If P1 investigation
actions ship, an alert can be linked to an investigation record, while the alert itself remains
derived and immutable.
