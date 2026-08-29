import { sql } from '@/lib/db';
import type { Provenance } from '@/lib/types';

// Ontology Control persistence: versioned ontology_* config tables only.
// Append-only by construction — edit inserts version n+1 linked via
// prior_version_id, archive inserts an archived version; no UPDATE/DELETE,
// and source events / materialized views are never written here.

export interface ObjectDef {
  id: number;
  key: string;
  version: number;
  label: string;
  plural_label: string | null;
  id_field: string | null;
  source_mapping: string | null;
  description: string | null;
  provenance: Provenance;
  editor: string;
  status: 'active' | 'archived';
  prior_version_id: number | null;
  created_at: string;
}

export interface FieldDef {
  id: number;
  object_key: string;
  key: string;
  version: number;
  label: string;
  field_type: string;
  source_mapping: string | null;
  description: string | null;
  provenance: Provenance;
  caveat: string | null;
  editor: string;
  status: 'active' | 'archived';
  prior_version_id: number | null;
  created_at: string;
}

export interface RelationshipDef {
  id: number;
  key: string;
  version: number;
  from_object: string;
  verb: string;
  to_object: string;
  source_mapping: string | null;
  provenance: Provenance;
  caveat: string | null;
  editor: string;
  status: 'active' | 'archived';
  prior_version_id: number | null;
  created_at: string;
}

const OBJECT_COLS = sql`id, key, version, label, plural_label, id_field, source_mapping,
  description, provenance, editor, status, prior_version_id, created_at::text AS created_at`;

export async function listObjectDefs(): Promise<ObjectDef[]> {
  return sql<ObjectDef[]>`
    SELECT DISTINCT ON (key) ${OBJECT_COLS}
    FROM ontology_object_defs ORDER BY key, version DESC`;
}

export async function listFieldDefs(): Promise<FieldDef[]> {
  return sql<FieldDef[]>`
    SELECT DISTINCT ON (object_key, key) id, object_key, key, version, label, field_type,
      source_mapping, description, provenance, caveat, editor, status, prior_version_id,
      created_at::text AS created_at
    FROM ontology_field_defs ORDER BY object_key, key, version DESC`;
}

export async function listRelationshipDefs(): Promise<RelationshipDef[]> {
  return sql<RelationshipDef[]>`
    SELECT DISTINCT ON (key) id, key, version, from_object, verb, to_object, source_mapping,
      provenance, caveat, editor, status, prior_version_id, created_at::text AS created_at
    FROM ontology_relationship_defs ORDER BY key, version DESC`;
}

export async function objectHistory(key: string): Promise<ObjectDef[]> {
  return sql<ObjectDef[]>`
    SELECT ${OBJECT_COLS} FROM ontology_object_defs
    WHERE key = ${key} ORDER BY version DESC`;
}

export async function relationshipHistory(key: string): Promise<RelationshipDef[]> {
  return sql<RelationshipDef[]>`
    SELECT id, key, version, from_object, verb, to_object, source_mapping, provenance, caveat,
      editor, status, prior_version_id, created_at::text AS created_at
    FROM ontology_relationship_defs WHERE key = ${key} ORDER BY version DESC`;
}

export async function fieldHistory(objectKey: string, key: string): Promise<FieldDef[]> {
  return sql<FieldDef[]>`
    SELECT id, object_key, key, version, label, field_type, source_mapping, description,
      provenance, caveat, editor, status, prior_version_id, created_at::text AS created_at
    FROM ontology_field_defs WHERE object_key = ${objectKey} AND key = ${key}
    ORDER BY version DESC`;
}

export interface ObjectInput {
  key: string;
  label: string;
  plural_label: string | null;
  id_field: string | null;
  source_mapping: string | null;
  description: string | null;
  provenance: Provenance;
}

export async function createObjectDef(input: ObjectInput, editor: string): Promise<void> {
  await sql`
    INSERT INTO ontology_object_defs (key, version, label, plural_label, id_field, source_mapping, description, provenance, editor)
    VALUES (${input.key}, 1, ${input.label}, ${input.plural_label}, ${input.id_field},
            ${input.source_mapping}, ${input.description}, ${input.provenance}, ${editor})`;
}

export async function editObjectDef(input: ObjectInput, editor: string): Promise<void> {
  await sql`
    INSERT INTO ontology_object_defs (key, version, label, plural_label, id_field, source_mapping, description, provenance, editor, prior_version_id)
    SELECT key, version + 1, ${input.label}, ${input.plural_label}, ${input.id_field},
           ${input.source_mapping}, ${input.description}, ${input.provenance}, ${editor}, id
    FROM ontology_object_defs WHERE key = ${input.key}
    ORDER BY version DESC LIMIT 1`;
}

export async function setObjectStatus(
  key: string,
  status: 'active' | 'archived',
  editor: string
): Promise<void> {
  await sql`
    INSERT INTO ontology_object_defs (key, version, label, plural_label, id_field, source_mapping, description, provenance, editor, status, prior_version_id)
    SELECT key, version + 1, label, plural_label, id_field, source_mapping, description, provenance, ${editor}, ${status}, id
    FROM ontology_object_defs WHERE key = ${key}
    ORDER BY version DESC LIMIT 1`;
}

export interface RelationshipInput {
  key: string;
  from_object: string;
  verb: string;
  to_object: string;
  source_mapping: string | null;
  provenance: Provenance;
  caveat: string | null;
}

export async function createRelationshipDef(input: RelationshipInput, editor: string): Promise<void> {
  await sql`
    INSERT INTO ontology_relationship_defs (key, version, from_object, verb, to_object, source_mapping, provenance, caveat, editor)
    VALUES (${input.key}, 1, ${input.from_object}, ${input.verb}, ${input.to_object},
            ${input.source_mapping}, ${input.provenance}, ${input.caveat}, ${editor})`;
}

export async function editRelationshipDef(input: RelationshipInput, editor: string): Promise<void> {
  await sql`
    INSERT INTO ontology_relationship_defs (key, version, from_object, verb, to_object, source_mapping, provenance, caveat, editor, prior_version_id)
    SELECT key, version + 1, ${input.from_object}, ${input.verb}, ${input.to_object},
           ${input.source_mapping}, ${input.provenance}, ${input.caveat}, ${editor}, id
    FROM ontology_relationship_defs WHERE key = ${input.key}
    ORDER BY version DESC LIMIT 1`;
}

export async function setRelationshipStatus(
  key: string,
  status: 'active' | 'archived',
  editor: string
): Promise<void> {
  await sql`
    INSERT INTO ontology_relationship_defs (key, version, from_object, verb, to_object, source_mapping, provenance, caveat, editor, status, prior_version_id)
    SELECT key, version + 1, from_object, verb, to_object, source_mapping, provenance, caveat, ${editor}, ${status}, id
    FROM ontology_relationship_defs WHERE key = ${key}
    ORDER BY version DESC LIMIT 1`;
}

export interface FieldInput {
  object_key: string;
  key: string;
  label: string;
  field_type: string;
  source_mapping: string | null;
  provenance: Provenance;
  caveat: string | null;
}

export async function createFieldDef(input: FieldInput, editor: string): Promise<void> {
  await sql`
    INSERT INTO ontology_field_defs (object_key, key, version, label, field_type, source_mapping, provenance, caveat, editor)
    VALUES (${input.object_key}, ${input.key}, 1, ${input.label}, ${input.field_type},
            ${input.source_mapping}, ${input.provenance}, ${input.caveat}, ${editor})`;
}

export async function setFieldStatus(
  objectKey: string,
  key: string,
  status: 'active' | 'archived',
  editor: string
): Promise<void> {
  await sql`
    INSERT INTO ontology_field_defs (object_key, key, version, label, field_type, source_mapping, description, provenance, caveat, editor, status, prior_version_id)
    SELECT object_key, key, version + 1, label, field_type, source_mapping, description, provenance, caveat, ${editor}, ${status}, id
    FROM ontology_field_defs WHERE object_key = ${objectKey} AND key = ${key}
    ORDER BY version DESC LIMIT 1`;
}

// Approved source mappings the forms may select from (no arbitrary SQL);
// each maps to one fixed count query against the materialized views.
export const APPROVED_SOURCES: { mapping: string; describes: string }[] = [
  { mapping: 'events', describes: 'Raw flattened event log (immutable source evidence)' },
  { mapping: 'jobs_current', describes: 'One row per job, lifecycle replayed to latest state' },
  { mapping: 'cycles', describes: 'One row per cycle_completed event' },
  { mapping: 'inspections', describes: 'One row per inspection event (QC stations qc_01/qc_02)' },
  { mapping: 'machine_stats', describes: 'One row per production machine (cycles aggregate)' },
  { mapping: 'alerts', describes: 'One row per derived rule finding' },
  { mapping: 'events.tool_id', describes: 'Distinct tool ids observed on cycle events' },
  { mapping: 'events.lot_id (material_lot_scan)', describes: 'Distinct scanned material lots (sparse: 14 scans)' },
  { mapping: 'events.lot_id', describes: 'Distinct scanned material lots (sparse: 14 scans)' },
  { mapping: 'events.customer_id', describes: 'Distinct ordering customers on job_created events' },
  { mapping: 'events.part_id', describes: 'Distinct part numbers on job_created events' },
  { mapping: 'events.facility', describes: 'Distinct production sites (la_01 / la_02)' },
  { mapping: 'inspections.inspector_id', describes: 'Distinct QC inspectors' },
];

// null count = definition has no materialized source → ghost node on the map.
export async function recordCounts(): Promise<Record<string, number | null>> {
  const [row] = await sql<Record<string, string>[]>`SELECT
    (SELECT count(*) FROM events)                                          AS "events",
    (SELECT count(*) FROM jobs_current)                                    AS "jobs_current",
    (SELECT count(*) FROM cycles)                                          AS "cycles",
    (SELECT count(*) FROM inspections)                                     AS "inspections",
    (SELECT count(*) FROM machine_stats)                                   AS "machine_stats",
    (SELECT count(*) FROM alerts)                                          AS "alerts",
    (SELECT count(DISTINCT tool_id) FROM events WHERE tool_id IS NOT NULL) AS "tools",
    (SELECT count(DISTINCT lot_id) FROM events WHERE lot_id IS NOT NULL)   AS "lots",
    (SELECT count(DISTINCT customer_id) FROM events WHERE customer_id IS NOT NULL) AS "customers",
    (SELECT count(DISTINCT part_id) FROM events WHERE part_id IS NOT NULL) AS "parts",
    (SELECT count(DISTINCT facility) FROM events WHERE facility IS NOT NULL) AS "facilities",
    (SELECT count(DISTINCT inspector_id) FROM inspections)                 AS "inspectors"`;
  const n = (k: string) => Number(row[k]);
  return {
    events: n('events'),
    jobs_current: n('jobs_current'),
    cycles: n('cycles'),
    inspections: n('inspections'),
    machine_stats: n('machine_stats'),
    alerts: n('alerts'),
    'events.tool_id': n('tools'),
    'events.lot_id': n('lots'),
    'events.lot_id (material_lot_scan)': n('lots'),
    'events.customer_id': n('customers'),
    'events.part_id': n('parts'),
    'events.facility': n('facilities'),
    'inspections.inspector_id': n('inspectors'),
  };
}
