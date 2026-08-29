import { describe, it, expect } from 'vitest';
import { sql, NOW_ISO } from '../helpers';

// Layer 3 smoke suite (TESTING.md). Append-only: each task adds its own marked
// section below; the captain owns the final form and points BASE at the
// deployed URL via SMOKE_BASE_URL in Wave 2.
export const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';

// ---------------------------------------------------------------------------
// W0-B · harness wiring (do not edit; append your section below)
// ---------------------------------------------------------------------------
describe('w0-b harness', () => {
  it('freezes NOW to the event horizon', () => {
    expect(NOW_ISO).toBe('2026-08-13T23:06:33Z');
  });

  it('connects to the database', async () => {
    const [row] = await sql<{ ok: number }[]>`select 1 as ok`;
    expect(row.ok).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// W1-overview · routes: /            (append here)
// ---------------------------------------------------------------------------
describe('w1-overview route /', () => {
  // no server runs during `npm run check` (build comes after vitest), so the
  // always-on assertions recheck the route's render inputs straight from SQL;
  // HTTP checks arm when the captain sets SMOKE_BASE_URL in Wave 2.
  it('serves the overview headline numbers', async () => {
    const [row] = await sql<
      { overdue: number; value: number; blocked_held: number; press03_median: number }[]
    >`
      select (select count(*) from jobs_current where overdue)::int as overdue,
             (select round(sum(revenue_at_risk)) from jobs_current where overdue)::int as value,
             (select count(*) from jobs_current where status in ('blocked','held'))::int as blocked_held,
             (select round(median_cycle_seconds) from machine_stats where machine_id = 'press_03')::int as press03_median`;
    expect(row.overdue).toBe(26);
    expect(row.value).toBe(590465);
    expect(row.blocked_held).toBe(9);
    expect(row.press03_median).toBe(1294);
  });

  describe.runIf(!!process.env.SMOKE_BASE_URL)('deployed', () => {
    it('GET / renders KPIs, queue, and provenance footer', async () => {
      const res = await fetch(`${BASE}/`);
      expect(res.status).toBe(200);
      const html = await res.text();
      // the DerivedBadge label is lowercase in markup, uppercased by CSS
      for (const key of ['Operations overview', '590,465', 'press_03', '1,294', 'voids', '19,519', 'derived']) {
        expect(html).toContain(key);
      }
    });

    it('GET /?alert=ovw_press_06_incident exposes the incident evidence event_ids', async () => {
      const html = await (await fetch(`${BASE}/?alert=ovw_press_06_incident`)).text();
      expect(html).toContain('evt_010715');
      expect(html).toContain('evt_011175');
    });
  });
});

// ---------------------------------------------------------------------------
// W1-jobs · routes: /jobs, /jobs/:jobId            (append here)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// W1-machines · routes: /machines/:machineId, /alerts            (append here)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// W1-admin · routes: /admin/ontology            (append here)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Wave 2 · captain: deployed-URL smoke (SMOKE_BASE_URL)            (append here)
// ---------------------------------------------------------------------------
