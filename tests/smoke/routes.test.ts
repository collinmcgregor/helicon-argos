import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
describe('w1-jobs routes', () => {
  // Without SMOKE_BASE_URL there is no server during `npm test` (next build
  // runs after vitest in `npm run check`), so this section boots its own
  // next dev on a task-unique port and tears it down.
  const jobsBase = process.env.SMOKE_BASE_URL ?? 'http://localhost:3452';
  let jobsServer: ReturnType<typeof import('node:child_process').spawn> | undefined;

  beforeAll(async () => {
    if (process.env.SMOKE_BASE_URL) return;
    const { spawn } = await import('node:child_process');
    jobsServer = spawn('npx', ['next', 'dev', '-p', '3452'], {
      stdio: 'ignore',
      detached: true,
    });
    const deadline = Date.now() + 110_000;
    for (;;) {
      try {
        const res = await fetch(`${jobsBase}/jobs`);
        if (res.status === 200) return;
      } catch {
        /* not up yet */
      }
      if (Date.now() > deadline) throw new Error('next dev did not become ready');
      await new Promise((r) => setTimeout(r, 1000));
    }
  }, 120_000);

  afterAll(() => {
    if (jobsServer?.pid) process.kill(-jobsServer.pid, 'SIGTERM');
  });

  // Transient pooler auth timeouts (EAUTHTIMEOUT) can stream an error fallback
  // instead of data; retry until the marker renders — with a static dataset a
  // persistent absence is a real failure, not a flake.
  async function fetchPage(path: string, marker: string): Promise<string> {
    const deadline = Date.now() + 30_000;
    for (;;) {
      try {
        const res = await fetch(`${jobsBase}${path}`);
        if (res.status === 200) {
          const html = await res.text();
          if (html.includes(marker)) return html;
        }
      } catch {
        /* transient */
      }
      if (Date.now() > deadline) throw new Error(`${path} did not render "${marker}" in 30s`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  it('GET /jobs renders the explorer', async () => {
    const html = await fetchPage('/jobs', 'job_0152');
    expect(html).toContain('Jobs');
    expect(html).toContain('jobs_current');
  }, 40_000);

  it('GET /jobs?risk=overdue echoes the filter with honest money coverage', async () => {
    const html = await fetchPage('/jobs?risk=overdue', '$590,465');
    expect(html).toContain('Overdue incomplete jobs');
    expect(html).toContain('unit-price coverage');
    expect(html).toContain('Clear filters');
  }, 40_000);

  it('GET /jobs/job_0152 shows the blocked + lot-scanned evidence timeline', async () => {
    const html = await fetchPage('/jobs/job_0152', 'lot_6626');
    expect(html).toContain('engineering_hold');
    expect(html).toContain('evt_011481'); // lot-scan source event
    expect(html).toContain('evt_011504'); // open block source event
    expect(html).toContain('Lot-scanned data available for');
  }, 40_000);

  it('GET /jobs/job_0293 surfaces the duplicate completion without hiding raw events', async () => {
    const html = await fetchPage('/jobs/job_0293', 'job_completed in source');
    expect(html.split('evt_001862').length - 1).toBeGreaterThanOrEqual(2);
  }, 40_000);
});

// ---------------------------------------------------------------------------
// W1-machines · routes: /machines/:machineId, /alerts            (append here)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// W1-admin · routes: /admin/ontology            (append here)
// ---------------------------------------------------------------------------
describe('w1-admin /admin/ontology', () => {
  it('map has a definition for every hand-placed layout node', async () => {
    const placed = [
      'raw_event', 'customer', 'material_lot', 'facility', 'job', 'part',
      'production_cycle', 'inspection', 'tool', 'machine', 'inspector', 'operational_issue',
    ];
    const rows = await sql<{ key: string }[]>`
      SELECT DISTINCT ON (key) key FROM ontology_object_defs
      WHERE status = 'active' ORDER BY key, version DESC`;
    const keys = new Set(rows.map((r) => r.key));
    for (const k of placed) expect(keys, `missing seeded object ${k}`).toContain(k);
  });

  it('map node record counts resolve for the seeded source mappings', async () => {
    const [c] = await sql<{ events: string; jobs: string; cycles: string; inspections: string }[]>`
      SELECT (SELECT count(*) FROM events) AS events,
             (SELECT count(*) FROM jobs_current) AS jobs,
             (SELECT count(*) FROM cycles) AS cycles,
             (SELECT count(*) FROM inspections) AS inspections`;
    expect(Number(c.events)).toBe(19_519);
    expect(Number(c.jobs)).toBe(312);
    expect(Number(c.cycles)).toBe(12_965);
    expect(Number(c.inspections)).toBe(5_153);
  });
});


// ---------------------------------------------------------------------------
// Wave 2 · captain: deployed-URL smoke (SMOKE_BASE_URL)            (append here)
// ---------------------------------------------------------------------------
