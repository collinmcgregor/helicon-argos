import { describe, it, expect, vi, afterAll } from 'vitest';
// lib/db.ts is `server-only`; neutralize the guard so the real query module
// runs here against the live DB (helpers loads .env.local before db init).
vi.mock('server-only', () => ({}));
import { sql as testSql, NOW } from '../helpers';
import { sql as dbSql } from '../../lib/db';
import { listJobs, listCustomers, getJob } from '../../lib/queries/jobs';

afterAll(async () => {
  await Promise.all([testSql.end(), dbSql.end()]);
});

describe('listJobs', () => {
  it('returns 312 jobs with the verified status distribution', async () => {
    const jobs = await listJobs();
    expect(jobs).toHaveLength(312);
    const by = (s: string) => jobs.filter((j) => j.status === s).length;
    expect(by('completed')).toBe(281);
    expect(by('in_progress')).toBe(15);
    expect(by('blocked') + by('held')).toBe(9);
    expect(by('created')).toBe(7);
  });

  it('derives 26 overdue jobs worth ~$590,465, with 150/312 priced', async () => {
    const jobs = await listJobs();
    const overdue = jobs.filter((j) => j.deliveryRisk === 'overdue');
    expect(overdue).toHaveLength(26);
    expect(overdue.every((j) => j.status !== 'completed')).toBe(true);
    const value = overdue.reduce((sum, j) => sum + (j.valueAtRisk ?? 0), 0);
    expect(Math.abs(value - 590465)).toBeLessThanOrEqual(1);
    expect(jobs.filter((j) => j.unit_price_estimate !== null)).toHaveLength(150);
  });

  it('filters by risk, status, facility, and customer', async () => {
    const overdue = await listJobs({ risk: 'overdue' });
    expect(overdue).toHaveLength(26);

    const blockedHeld = await listJobs({ status: 'blocked-held' });
    expect(blockedHeld).toHaveLength(9);
    expect(blockedHeld.every((j) => j.status === 'blocked' || j.status === 'held')).toBe(true);

    const la01 = await listJobs({ facility: 'la_01' });
    const la02 = await listJobs({ facility: 'la_02' });
    expect(la01.length + la02.length).toBe(312);
    expect(la01.every((j) => j.facility_id === 'la_01')).toBe(true);

    const helix = await listJobs({ customer: 'cust_helix' });
    expect(helix.length).toBeGreaterThan(0);
    expect(helix.every((j) => j.customer_id === 'cust_helix')).toBe(true);
    expect(helix.some((j) => j.job_id === 'job_0152')).toBe(true);
  });

  it('sorts risk first, then due date ascending, and respects invariants', async () => {
    const jobs = await listJobs();
    const statuses = new Set(['created', 'in_progress', 'blocked', 'held', 'completed']);
    expect(jobs.every((j) => statuses.has(j.status))).toBe(true);
    expect(jobs.every((j) => new Date(j.created_at) <= NOW)).toBe(true);

    const lastOverdue = jobs.map((j) => j.deliveryRisk).lastIndexOf('overdue');
    const firstOnTrack = jobs.map((j) => j.deliveryRisk).indexOf('on_track');
    expect(lastOverdue).toBeLessThan(firstOnTrack);
    const overdueDues = jobs.filter((j) => j.deliveryRisk === 'overdue').map((j) => j.due_date);
    expect(overdueDues).toEqual([...overdueDues].sort());
  });

  it('surfaces the job_0293 duplicate-completion anomaly', async () => {
    const jobs = await listJobs();
    const j = jobs.find((x) => x.job_id === 'job_0293');
    expect(j?.status).toBe('completed');
    expect(j?.completionEventCount).toBe(2);
  });

  it('lists the 16 distinct customers', async () => {
    const customers = await listCustomers();
    expect(customers).toHaveLength(16);
    expect(customers).toContain('cust_helix');
  });
});

describe('getJob(job_0152) — blocked + lot-scanned traceability thread', () => {
  it('replays lifecycle to blocked/overdue with the open block reason', async () => {
    const detail = await getJob('job_0152');
    expect(detail).not.toBeNull();
    expect(detail?.job.status).toBe('blocked');
    expect(detail?.job.block_reason).toBe('engineering_hold');
    expect(detail?.job.deliveryRisk).toBe('overdue');
    const block = detail?.blocks.find((b) => b.event_type === 'job_blocked');
    expect(block?.event_id).toBe('evt_011504');
    expect(detail?.blocks.some((b) => b.event_type === 'job_unblocked')).toBe(false);
  });

  it('threads job → material lot with source-event evidence and honest coverage', async () => {
    const detail = await getJob('job_0152');
    expect(detail?.lot).toEqual({
      lot_id: 'lot_6626',
      material: 'carbon_fiber_epoxy',
      event_id: 'evt_011481',
      scanned_at: expect.any(String),
    });
    const scan = detail?.timeline.find((e) => e.event_type === 'material_lot_scan');
    expect(scan?.event_id).toBe('evt_011481');
    expect(scan?.lot_id).toBe('lot_6626');
    expect(detail?.lotCoverage).toEqual({ scannedJobs: 14, totalJobs: 312 });
  });

  it('links production context: press_03 cycles, tool_29, activity ≠ progress', async () => {
    const detail = await getJob('job_0152');
    expect(detail?.machines).toEqual([{ machine_id: 'press_03', cycleCount: 14 }]);
    expect(detail?.tools).toEqual(['tool_29']);
    expect(detail?.job.cycleCount).toBe(14);
    expect(detail?.job.cycleQuantity).toBe(86);
  });

  it('keeps the timeline chronological and inside the frozen horizon', async () => {
    const detail = await getJob('job_0152');
    const times = detail?.timeline.map((e) => e.timestamp) ?? [];
    expect(times.length).toBeGreaterThan(0);
    expect(times).toEqual([...times].sort());
    expect(times.every((t) => new Date(t) <= NOW)).toBe(true);
  });
});

describe('getJob(job_0293) — duplicate completion preserved', () => {
  it('keeps both raw job_completed events and flags the anomaly', async () => {
    const detail = await getJob('job_0293');
    expect(detail?.job.status).toBe('completed');
    expect(detail?.job.completionEventCount).toBe(2);
    expect(detail?.job.completed_quantity).toBe(241);
    expect(detail?.job.scrap_quantity).toBe(26);
    const completions = detail?.timeline.filter((e) => e.event_type === 'job_completed');
    expect(completions).toHaveLength(2);
    expect(completions?.map((e) => e.event_id)).toEqual(['evt_001862', 'evt_001862']);
  });
});

describe('getJob(unknown)', () => {
  it('returns null, not a fabricated job', async () => {
    expect(await getJob('job_9999')).toBeNull();
  });
});
