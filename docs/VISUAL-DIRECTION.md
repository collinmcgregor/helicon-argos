# Visual Direction Override — Foundry Light / Operational Clarity

This document supersedes the dark “Laminate” styling in `ARGOS.md §5` for visual direction. It
does not change the product/data contracts in the other documents.

## Design intent

Argos should feel like a precise operations workspace: calm, light, and information-dense without
being loud. Take inspiration from Foundry’s clean working surfaces and structured configuration
screens—not its branding. The visual hierarchy should make the next decision obvious in two
seconds.

### Principles

1. **Neutral workspace first.** Information earns color; the application chrome does not.
2. **One decision per region.** A panel may answer one question, not repeat the same metric in a
   chart, card, alert, and recommendation.
3. **Evidence before decoration.** Use compact labels, tables, and inline comparisons rather
   than hero metrics, gradients, texture, or ornamental status cards.
4. **Color identifies a type of work, never the entire UI.** Pair every color with a text label
   and a glyph; never rely on red/green traffic-light interpretation.

## Light theme tokens

```text
canvas              #F7F8FA
surface             #FFFFFF
surface-subtle      #F1F3F6
surface-selected    #EEF3F8
border              #DCE1E7
border-strong       #C8D0D9
ink                 #17212B
ink-secondary       #56616D
ink-muted           #7D8792
action              #245B8F       // links, focus, selected navigation
action-subtle       #EAF1F8

flow                #536B8A       // throughput / cycle-time work
constraint          #7B5A7A       // blocked / tooling work
delivery            #76534B       // overdue / commercial exposure
quality             #3D766E       // inspection / process context
evidence            #65727F       // source-event and provenance context
```

Use these as subtle label, glyph, or 2px indicator colors only. Do not fill large cards with
status colors. Avoid amber seams, brown surfaces, bright red danger states, saturated blue
buttons, gradients, shadows, glass effects, and patterned backgrounds.

Typography: Inter for labels/text; IBM Plex Mono only for IDs, timestamps, numeric values, and
event codes. Use 14px body text, 12px metadata, 11px column labels, and a restrained 22px page
title. Keep radii at 4px or less.

## Application shell

- 216px left rail: white, quiet, thin right border; grouped navigation with one selected row.
- Top bar: white, 48px, breadcrumb left and facility filter/right-side data freshness right.
- Page canvas: off-white with a max-width content column; no full-bleed colored dashboard.
- A thin indigo action mark identifies the active navigation item. `ADMIN` is a quiet text label,
  not a colored badge.

## Overview: simplify to three decision regions

```text
Operations Overview                         All facilities · data through Aug 13, 23:06

[ Active jobs ] [ Blocked / held ] [ Overdue value ]        ← compact metric strip

Needs attention (dominant, 2/3)            Factory pulse (1/3)
1  press_03 cycle-time drift               LA-01  open · blocked · recent activity
2  overdue incomplete work                 LA-02  open · blocked · recent activity
3  missing-tool constraint

Selected investigation
Why it matters · evidence · affected work · one next action

System insight: voids are systemic across all materials; do not blame one press.
```

- Keep exactly **three** top metrics: Active jobs, Blocked/Held, Overdue Value. Quality is an
  investigative insight, not an executive tile.
- Keep exactly **three** open alerts visible; link to Alerts for the rest.
- Keep Facility Pulse as two compact rows/cards; each has only open work, blocked work, and
  recent activity. Move “highest-value overdue work” to the selected investigation or Jobs page.
- Put the selected investigation directly under the queue, full width. It contains explanation,
  supporting evidence, affected-job count/value, and one route-level action.
- Replace the separate recommended-actions panel with the single “next action” inside each
  selected investigation. Remove duplicated information.
- Remove the machine strip from Overview. Machine comparison belongs in Machines/its detail view.
- Keep at most one small sparkline in the selected investigation; do not show overview trend
  charts in v0.0. The detail pages own trends.
- Render the systemic-quality finding as one low-emphasis, full-width insight line.

## Jobs Explorer: optimize for scanning, not metrics

- One title line, one concise filter row, then the table. Do not add KPI cards.
- Table columns: `Status`, `Job`, `Customer / Part`, `Due`, `Reason`, `Outcome`.
- Show facility and material in muted secondary text beneath Job.
- `Outcome` means final good/scrap when present; otherwise `—`. Never show a speculative progress
  percentage based on cycle quantity.
- Make the whole row clickable with a quiet right-arrow on hover. Filters should look like compact
  text selects, not large pills.

## Job Detail: the event log is the hero

- Use a compact header with status, due date, customer/part, and completion outcome.
- Put the source-event timeline at 70% width and connected context at 30% width.
- Do not create a grid of stat cards. Group context into three small sections: `Assets`,
  `Inspection`, `Constraints & lineage`.
- Use provenance labels inline: `OBSERVED`, `DERIVED`, and coverage notes; never decorate the
  whole panel with status color.

## Machine Detail: one question, one chart

- Header: machine name, location, current finding, one cycle-time comparison.
- The weekly cycle-time chart occupies the main content width and is the page’s only visual
  focus. Use a dark slate line for fleet reference and one muted indigo line for selected machine.
- Put sensor/maintenance facts as small annotated event markers below the chart, not a separate
  colored alert panel.
- Below: two compact sections, `Evidence` and `Affected jobs`.
- Move derived quality attribution into a collapsed/context section. It is supporting context,
  not the main reason users opened this page.

## Alerts: a focused work queue

- If shipped, this is a plain, filterable queue—not another dashboard.
- Each row: work-type glyph, rule, one-sentence reason, affected-work count/value, destination.
- Use left-edge category markers in `flow`, `constraint`, or `delivery`; avoid red/orange alert
  chrome. Rows remain mostly white.

## Ontology Control: configuration over spectacle

- Start with the object/relationship/field catalogue and selected-definition editor.
- Keep the ontology map compact and secondary, below or behind an “Overview” tab. It is useful
  confirmation, not the admin’s primary working surface.
- Source mapping, provenance, change history, and explicit caveats are the visual proof of a
  serious ontology product.

## Responsive rule

On narrow screens: hide/collapse the rail, stack the three overview regions in order (metrics →
queue → facility pulse → selected investigation), keep primary actions visible, and make tables
show identity/status/due before allowing horizontal scroll.
