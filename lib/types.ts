// The type system mirrors the ontology (PLAN.md observed-vs-derived edge rules).
// Fields computed from joins/replay — never raw source columns — are marked derived.

export type JobStatus = 'created' | 'in_progress' | 'blocked' | 'held' | 'completed';

export type EventType =
  | 'job_created'
  | 'job_started'
  | 'job_completed'
  | 'job_blocked'
  | 'job_unblocked'
  | 'job_hold'
  | 'cycle_completed'
  | 'inspection'
  | 'material_lot_scan'
  | 'sensor_glitch'
  | 'maintenance_ping';

export type DefectCode =
  | 'voids'
  | 'delamination'
  | 'dimensional'
  | 'surface'
  | 'resin_rich'
  | 'other';

export type Severity = 'critical' | 'warn' | 'info';

export type StatusTone = 'ok' | 'warn' | 'critical' | 'info';

export type Provenance = 'observed' | 'derived' | 'external';

export type FacilityId = 'la_01' | 'la_02';

export type AlertRule =
  | 'cycle_time_vs_baseline'
  | 'overdue_incomplete'
  | 'blocked_or_held';

export interface SourceEvent {
  event_id: string;
  event_type: EventType;
  timestamp: string; // ISO 8601, always ≤ frozen NOW
  job_id: string | null;
  machine_id: string | null;
  tool_id: string | null;
  facility_id: FacilityId | null;
  metadata: Record<string, unknown>;
}

export interface Job {
  job_id: string;
  customer_id: string;
  part_id: string;
  facility_id: FacilityId;
  target_quantity: number;
  due_date: string;
  unit_price_estimate: number | null;
  created_at: string;
  // derived (lifecycle replay over job_* events)
  status: JobStatus;
  block_reason: string | null;
  completed_quantity: number;
  scrap_quantity: number;
  // derived (due_date vs frozen NOW × completion state)
  deliveryRisk: 'overdue' | 'at_risk' | 'on_track';
  valueAtRisk: number | null;
}

export interface ProductionCycle {
  cycle_id: string;
  event_id: string;
  job_id: string;
  machine_id: string;
  tool_id: string | null;
  facility_id: FacilityId;
  quantity: number;
  duration_seconds: number;
  completed_at: string;
}

export interface Inspection {
  inspection_id: string;
  event_id: string;
  job_id: string;
  inspector_id: string;
  // qc_01/qc_02 station id — never a production machine; attribute via job→cycle join
  station_id: string;
  passed: boolean;
  quantity: number;
  defect_code: DefectCode | null;
  inspected_at: string;
}

export interface Machine {
  machine_id: string;
  facility_id: FacilityId;
  // derived (cycles aggregate — machine_stats view)
  medianCycleSeconds: number | null;
  fleetMedianSeconds: number | null;
  cycleTimeDriftPct: number | null;
  cycleCount: number;
  lastEventAt: string | null;
  statusTone: StatusTone;
}

export interface Tool {
  tool_id: string;
  // derived (cycles aggregate)
  cycleCount: number;
  lastUsedAt: string | null;
}

export interface MaterialLot {
  lot_id: string;
  material: string;
  // observed via material_lot_scan events only (14 of 312 jobs — show coverage honestly)
  scanned_job_ids: string[];
  scanned_at: string | null;
}

export interface Alert {
  alert_id: string;
  rule: AlertRule;
  severity: Severity;
  title: string;
  explanation: string;
  businessImpact: string | null;
  implicated_ids: string[];
  supporting_event_ids: string[];
  provenance: Provenance; // always 'derived' for alert rows
  href: string;
  latest_event_at: string | null;
}

export interface OntologyFieldDef {
  name: string;
  type: string;
  provenance: Provenance;
  source_mapping: string | null;
}

export interface OntologyRelationshipDef {
  from_object: string;
  to_object: string;
  verb: string;
  provenance: Provenance;
  caveat: string | null;
}

export interface OntologyObjectDef {
  object_name: string;
  provenance: Provenance;
  description: string;
  fields: OntologyFieldDef[];
  relationships: OntologyRelationshipDef[];
  version: number;
  updated_at: string | null;
  updated_by: string | null;
}
