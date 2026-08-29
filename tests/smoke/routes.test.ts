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
