import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from '../helpers';

// Layer 2 query contract for Ontology Control (pages/ontology-control.md).
// Config rows are append-only: edits insert a new version linked via
// prior_version_id; archive inserts an archived version; nothing is deleted.
// The lifecycle exercised here mirrors lib/queries/ontology.ts, which tests
// cannot import (lib/db.ts is server-only).

const KEY = 'w1admin_test_widget';

async function cleanup() {
  await sql`DELETE FROM ontology_object_defs WHERE key = ${KEY}`;
  await sql`DELETE FROM ontology_relationship_defs WHERE key = ${KEY}`;
}

beforeAll(cleanup);
afterAll(async () => {
  await cleanup();
  await sql.end();
});

describe('seeded ontology catalogue', () => {
  it('has the 12 seeded active object definitions, latest version per key', async () => {
    const rows = await sql<{ key: string; provenance: string }[]>`
      SELECT DISTINCT ON (key) key, provenance
      FROM ontology_object_defs
      WHERE key NOT LIKE 'w1admin_test_%'
      ORDER BY key, version DESC`;
    expect(rows.length).toBe(12);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.provenance]));
    expect(byKey['job']).toBe('observed');
    expect(byKey['raw_event']).toBe('observed');
    expect(byKey['operational_issue']).toBe('derived');
  });

  it('every derived relationship carries a caveat', async () => {
    const bad = await sql<{ key: string }[]>`
      SELECT key FROM ontology_relationship_defs
      WHERE provenance = 'derived' AND caveat IS NULL`;
    expect(bad).toEqual([]);
  });

  it('never shows inspection evaluated by a production machine as observed', async () => {
    const [row] = await sql<{ provenance: string; caveat: string | null }[]>`
      SELECT DISTINCT ON (key) provenance, caveat
      FROM ontology_relationship_defs
      WHERE from_object = 'machine' AND to_object = 'inspection'
      ORDER BY key, version DESC`;
    expect(row.provenance).toBe('derived');
    expect(row.caveat).toMatch(/qc_01\/qc_02/);
  });
});

describe('provenance guardrails', () => {
  it('rejects a provenance value outside observed|derived|external', async () => {
    await expect(
      sql`INSERT INTO ontology_object_defs (key, label, provenance)
          VALUES (${KEY}, 'Widget', 'guessed')`
    ).rejects.toThrow(/provenance/);
  });

  it('rejects a derived relationship without a caveat', async () => {
    await expect(
      sql`INSERT INTO ontology_relationship_defs (key, from_object, verb, to_object, provenance)
          VALUES (${KEY}, 'job', 'tests', 'machine', 'derived')`
    ).rejects.toThrow(/derived_needs_caveat/);
  });
});

describe('config CRUD round-trip and versioning', () => {
  it('create → edit (new version) → archive (never deletes)', async () => {
    const [v1] = await sql<{ id: number }[]>`
      INSERT INTO ontology_object_defs (key, version, label, plural_label, id_field, source_mapping, description, provenance, editor)
      VALUES (${KEY}, 1, 'Test Widget', 'Test Widgets', 'widget_id', NULL, 'crud round-trip', 'external', 'admin')
      RETURNING id`;

    // edit = insert version 2 linked to prior; version 1 row is untouched
    await sql`
      INSERT INTO ontology_object_defs (key, version, label, plural_label, id_field, source_mapping, description, provenance, editor, prior_version_id)
      VALUES (${KEY}, 2, 'Test Widget (renamed)', 'Test Widgets', 'widget_id', NULL, 'crud round-trip', 'external', 'admin', ${v1.id})`;

    const [latest] = await sql<{ label: string; version: number; status: string }[]>`
      SELECT label, version, status FROM ontology_object_defs
      WHERE key = ${KEY} ORDER BY version DESC LIMIT 1`;
    expect(latest.version).toBe(2);
    expect(latest.label).toBe('Test Widget (renamed)');
    expect(latest.status).toBe('active');

    // archive = insert version 3 with status archived; all prior rows survive
    await sql`
      INSERT INTO ontology_object_defs (key, version, label, plural_label, id_field, source_mapping, description, provenance, editor, status, prior_version_id)
      SELECT key, 3, label, plural_label, id_field, source_mapping, description, provenance, 'admin', 'archived', id
      FROM ontology_object_defs WHERE key = ${KEY} AND version = 2`;

    const rows = await sql<{ version: number; status: string }[]>`
      SELECT version, status FROM ontology_object_defs
      WHERE key = ${KEY} ORDER BY version`;
    expect(rows.map((r) => r.version)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.status)).toEqual(['active', 'active', 'archived']);
  });
});

describe('event tables stay untouched', () => {
  it('config writes never change the source event count', async () => {
    const [{ n }] = await sql<{ n: string }[]>`SELECT count(*) AS n FROM events`;
    expect(Number(n)).toBe(19_519);
  });

  it('ontology tables reference no event rows (config-only persistence)', async () => {
    const [{ n }] = await sql<{ n: string }[]>`
      SELECT count(*) AS n FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu USING (constraint_name)
      WHERE tc.table_name LIKE 'ontology_%'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'events'`;
    expect(Number(n)).toBe(0);
  });
});
