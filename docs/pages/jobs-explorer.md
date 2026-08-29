# Page: Jobs Explorer

| | |
| --- | --- |
| **Route** | `/jobs` |
| **Build task** | W1-jobs (with `job-detail.md`) |
| **Query module** | `lib/queries/jobs.ts` |
| **Test file** | `tests/queries/jobs.test.ts` |
| **Key verified numbers** | 312 jobs · 281 completed · 15 in_progress · 9 blocked/held · 7 created · 26 overdue |

Global shell, states, and cross-cutting rules: `../DESIGN.md`.

## Purpose

Turn an alert into a manageable list of work. This is a triage table, not a spreadsheet
replacement.

## Layout and controls

- Title changes with context: e.g. **Overdue incomplete jobs**; otherwise **Jobs**.
- One-line applied-filter summary and a visible **Clear filters** action.
- Filters only: facility, status, customer. Alert links may supply `risk` and `reason` as
  read-only applied filters.
- Default sort: risk/urgency first, then target due date ascending.
- All filter state lives in the URL query string (shareable, refresh-safe).

## Table columns

| Column | Meaning |
| --- | --- |
| Status | Glyph + label; never color alone |
| Job | Mono ID; click opens job detail |
| Customer / Part | Context for escalation |
| Due | Target due date; overdue indicator only where warranted |
| Progress | Target vs. derived cycle quantity or completion outcome; label caveats where needed |
| Yield | Good vs. scrap only when completion data exists |
| Risk / reason | Why this row is in the current queue |

For compactness, facility and material appear in a second muted line under Job or in a detail
drawer — not as extra desktop columns.
