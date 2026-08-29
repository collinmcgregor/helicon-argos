# Page: Alerts List (optional P0 route)

| | |
| --- | --- |
| **Route** | `/alerts` |
| **Build task** | W1-machines (optional add-on; skip freely) |
| **Query module** | reuses the `alerts` view via `lib/queries/machines.ts` |
| **Test file** | covered by `tests/queries/machines.test.ts` + smoke |

Global shell, states, and cross-cutting rules: `../DESIGN.md`.

Do not build a separate alert object page unless the overview queue has already shipped. If it
does ship, use it only as an expanded, filterable version of the queue. Alerts remain
query-time derived objects with source-event evidence, not editable tickets — every row carries
rule name, severity, human explanation, implicated object IDs, and supporting `event_id`s.
