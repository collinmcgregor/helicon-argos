import { sql } from '@/lib/db';
import type { DefectCode, EventType, FacilityId, Job, JobStatus } from '@/lib/types';

// Raw source vocabulary is wider than the ontology EventType union; timelines
// must show the source truth, never collapse it.
export type JobEventType =
  | EventType
  | 'inspection_passed'
  | 'inspection_failed'
  | 'tool_ready'
  | 'shift_handoff';

export type ExplorerStatus = JobStatus | 'active' | 'blocked-held';

export interface JobsFilter {
  facility?: FacilityId;
  status?: ExplorerStatus;
  customer?: string;
  risk?: 'overdue';
  reason?: string;
}

export interface JobListItem extends Job {
  material: string;
  priority: string;
  // production activity, never completion progress (DATA-FLOWS.md)
  cycleCount: number;
  cycleQuantity: number;
  completionEventCount: number; // >1 = duplicate source completion (job_0293)
  lot_id: string | null;
  lifecycle_event_id: string | null;
  has_completion: boolean;
  good_quantity: number | null;
  due_time: string;
}

export interface JobEvent {
  seq: number;
  event_id: string;
  event_type: JobEventType;
  timestamp: string;
  machine_id: string | null;
  tool_id: string | null;
  quantity: number | null;
  cycle_time_seconds: number | null;
  defect_code: DefectCode | null;
  inspector_id: string | null;
  operator_id: string | null;
  good_quantity: number | null;
  scrap_quantity: number | null;
  reason: string | null;
  lot_id: string | null;
  signal: string | null;
}

export interface JobDetail {
  job: JobListItem;
  timeline: JobEvent[]; // chronological
  machines: { machine_id: string; cycleCount: number }[];
  tools: string[];
  inspections: {
    passQuantity: number;
    failQuantity: number;
    passCount: number;
    failCount: number;
    defects: { code: DefectCode; count: number }[];
    inspectors: string[];
  };
  blocks: {
    event_id: string;
    timestamp: string;
    event_type: 'job_blocked' | 'job_hold' | 'job_unblocked';
    reason: string | null;
  }[];
  lot: { lot_id: string; material: string; event_id: string; scanned_at: string } | null;
  lotCoverage: { scannedJobs: number; totalJobs: number };
}

interface JobRow {
  job_id: string;
  customer_id: string;
  part_id: string;
  facility: FacilityId;
  material: string;
  priority: string;
  target_quantity: number;
  target_due_at: Date;
  unit_price_estimate: string | null;
  created_at: Date;
  status: JobStatus;
  block_reason: string | null;
  good_quantity: number | null;
  scrap_quantity: number | null;
  overdue: boolean;
  revenue_at_risk: string | null;
  cycle_count: string | null;
  cycle_quantity: string | null;
  completion_event_count: string | null;
  lot_id: string | null;
  lifecycle_event_id: string | null;
}

function toListItem(r: JobRow): JobListItem {
  return {
    job_id: r.job_id,
    customer_id: r.customer_id,
    part_id: r.part_id,
    facility_id: r.facility,
    target_quantity: r.target_quantity,
    due_date: r.target_due_at.toISOString().slice(0, 10),
    due_time: r.target_due_at.toISOString(),
    unit_price_estimate: r.unit_price_estimate === null ? null : Number(r.unit_price_estimate),
    created_at: r.created_at.toISOString(),
    status: r.status,
    block_reason: r.block_reason,
    has_completion: r.good_quantity !== null || r.scrap_quantity !== null,
    good_quantity: r.good_quantity,
    completed_quantity: r.good_quantity ?? 0,
    scrap_quantity: r.scrap_quantity ?? 0,
    deliveryRisk: r.overdue ? 'overdue' : r.status === 'blocked' || r.status === 'held' ? 'at_risk' : 'on_track',
    valueAtRisk: r.revenue_at_risk === null ? null : Number(r.revenue_at_risk),
    material: r.material,
    priority: r.priority,
    cycleCount: Number(r.cycle_count ?? 0),
    cycleQuantity: Number(r.cycle_quantity ?? 0),
    completionEventCount: Number(r.completion_event_count ?? 0),
    lot_id: r.lot_id,
    lifecycle_event_id: r.lifecycle_event_id,
  };
}

const STATUS_SETS: Record<'active' | 'blocked-held', JobStatus[]> = {
  active: ['created', 'in_progress'],
  'blocked-held': ['blocked', 'held'],
};

export async function listJobs(filter: JobsFilter = {}): Promise<JobListItem[]> {
  const statuses = filter.status
    ? (STATUS_SETS[filter.status as 'active' | 'blocked-held'] ?? [filter.status as JobStatus])
    : null;
  const rows = await sql<JobRow[]>`
    SELECT job_id, customer_id, part_id, facility, material, priority,
           target_quantity, target_due_at, unit_price_estimate, created_at,
           status, block_reason, good_quantity, scrap_quantity, overdue,
           revenue_at_risk, cycle_count, cycle_quantity, completion_event_count,
           lot_id, lifecycle_event_id
    FROM jobs_current
    WHERE TRUE
      ${filter.facility ? sql`AND facility = ${filter.facility}` : sql``}
      ${statuses ? sql`AND status = ANY(${statuses})` : sql``}
      ${filter.customer ? sql`AND customer_id = ${filter.customer}` : sql``}
      ${filter.risk === 'overdue' ? sql`AND overdue` : sql``}
      ${filter.reason ? sql`AND block_reason = ${filter.reason}` : sql``}
    ORDER BY CASE WHEN overdue THEN 0 WHEN status IN ('blocked','held') THEN 1 ELSE 2 END,
             target_due_at ASC, job_id ASC`;
  return rows.map(toListItem);
}

export async function listCustomers(): Promise<string[]> {
  const rows = await sql<{ customer_id: string }[]>`
    SELECT DISTINCT customer_id FROM jobs_current ORDER BY customer_id`;
  return rows.map((r) => r.customer_id);
}

type JobEventRow = Omit<JobEvent, 'timestamp'> & { timestamp: Date; material: string | null };

export async function getJob(jobId: string): Promise<JobDetail | null> {
  const [jobRows, rawEventRows, coverageRows] = await Promise.all([
    sql<JobRow[]>`
      SELECT job_id, customer_id, part_id, facility, material, priority,
             target_quantity, target_due_at, unit_price_estimate, created_at,
             status, block_reason, good_quantity, scrap_quantity, overdue,
             revenue_at_risk, cycle_count, cycle_quantity, completion_event_count,
             lot_id, lifecycle_event_id
      FROM jobs_current WHERE job_id = ${jobId}`,
    sql<JobEventRow[]>`
      SELECT seq, event_id, event_type, timestamp, machine_id, tool_id, quantity,
             cycle_time_seconds, defect_code, inspector_id, operator_id,
             good_quantity, scrap_quantity, reason, lot_id, signal, material
      FROM events WHERE job_id = ${jobId}
      ORDER BY timestamp ASC, seq ASC`,
    sql<{ scanned: string; total: string }[]>`
      SELECT count(*) FILTER (WHERE lot_id IS NOT NULL) AS scanned, count(*) AS total
      FROM jobs_current`,
  ]);
  if (jobRows.length === 0) return null;

  const eventRows = rawEventRows.map((e) => ({ ...e, timestamp: e.timestamp.toISOString() }));
  const timeline: JobEvent[] = eventRows.map(({ material: _material, ...e }) => e);
  const machineCounts = new Map<string, number>();
  const tools = new Set<string>();
  for (const e of eventRows) {
    if (e.event_type !== 'cycle_completed') continue;
    if (e.machine_id) machineCounts.set(e.machine_id, (machineCounts.get(e.machine_id) ?? 0) + 1);
    if (e.tool_id) tools.add(e.tool_id);
  }

  const defectCounts = new Map<DefectCode, number>();
  const inspectors = new Set<string>();
  const inspections = { passQuantity: 0, failQuantity: 0, passCount: 0, failCount: 0 };
  for (const e of eventRows) {
    if (e.event_type !== 'inspection_passed' && e.event_type !== 'inspection_failed') continue;
    if (e.inspector_id) inspectors.add(e.inspector_id);
    if (e.event_type === 'inspection_passed') {
      inspections.passCount += 1;
      inspections.passQuantity += e.quantity ?? 0;
    } else {
      inspections.failCount += 1;
      inspections.failQuantity += e.quantity ?? 0;
      if (e.defect_code) defectCounts.set(e.defect_code, (defectCounts.get(e.defect_code) ?? 0) + 1);
    }
  }

  const scan = eventRows.find((e) => e.event_type === 'material_lot_scan' && e.lot_id);
  const [coverage] = coverageRows;
  return {
    job: toListItem(jobRows[0]),
    timeline,
    machines: [...machineCounts].map(([machine_id, cycleCount]) => ({ machine_id, cycleCount })),
    tools: [...tools].sort(),
    inspections: {
      ...inspections,
      defects: [...defectCounts]
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count),
      inspectors: [...inspectors].sort(),
    },
    blocks: eventRows.flatMap((e) =>
      e.event_type === 'job_blocked' || e.event_type === 'job_hold' || e.event_type === 'job_unblocked'
        ? [{ event_id: e.event_id, timestamp: e.timestamp, event_type: e.event_type, reason: e.reason }]
        : [],
    ),
    lot: scan
      ? {
          lot_id: scan.lot_id as string,
          material: scan.material ?? jobRows[0].material,
          event_id: scan.event_id,
          scanned_at: scan.timestamp,
        }
      : null,
    lotCoverage: { scannedJobs: Number(coverage.scanned), totalJobs: Number(coverage.total) },
  };
}
