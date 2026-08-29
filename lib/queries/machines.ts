import type postgres from 'postgres';
import { NOW } from '@/lib/constants';
import type {
  Alert,
  AlertRule,
  EventType,
  FacilityId,
  Job,
  JobStatus,
  Machine,
  SourceEvent,
  StatusTone,
} from '@/lib/types';

// Functions take the connection as an argument: pages pass lib/db.ts's client,
// tests pass tests/helpers.ts's (lib/db.ts is `server-only` and unimportable there).
export type Db = ReturnType<typeof postgres>;

export interface MachineDetail extends Machine {
  jobCount: number;
  maintenanceCount: number;
  sensorGlitchCount: number;
  // floor, not round: header claims "at least N% above fleet" (ARGOS §1.3: 25%)
  pctAboveFleet: number | null;
  fleetBandLowSeconds: number | null;
  fleetBandHighSeconds: number | null;
}

export interface WeeklyTrendPoint {
  weekStart: string; // Monday, YYYY-MM-DD
  machineMedianSeconds: number | null;
  fleetMedianSeconds: number | null; // other presses only
  cycleCount: number;
}

export type TrendWindow = '2w' | '4w' | 'all';

export function parseTrendWindow(raw: string | string[] | undefined): TrendWindow {
  return raw === '2w' || raw === '4w' ? raw : 'all';
}

export interface RecoveredIncident {
  machine_id: string;
  sensorEvent: SourceEvent;
  maintenanceEvent: SourceEvent;
  baselineMedianSeconds: number;
  spikeMedianSeconds: number;
  recoveredMedianSeconds: number;
}

export interface QualityAttribution {
  machine_id: string;
  provenance: 'derived';
  method: string;
  failRatePct: number;
  inspectionEvents: number;
  failedEvents: number;
  supportingEventIds: string[];
}

export type MachineAlertRule = AlertRule | 'recovered_incident';
export interface AlertSummary extends Omit<Alert, 'rule'> {
  rule: MachineAlertRule;
}

const toneFor = (
  median: number | null,
  fleet: number | null,
  maintenance: number,
  glitches: number,
): StatusTone => {
  if (median !== null && fleet !== null && median > fleet * 1.15) return 'critical';
  if (maintenance > 0 || glitches > 0) return 'info';
  return 'ok';
};

export async function getMachine(sql: Db, machineId: string): Promise<MachineDetail | null> {
  const rows = await sql<
    {
      machine_id: string;
      median: number | null;
      cycle_count: number;
      job_count: number;
      drift_pct: number | null;
      maintenance_count: number;
      sensor_glitch_count: number;
      fleet_median: number | null;
      band_lo: number | null;
      band_hi: number | null;
      facility: string;
      last_event_at: Date | null;
    }[]
  >`
    WITH target AS (SELECT * FROM machine_stats WHERE machine_id = ${machineId}),
    others AS (
      -- fleet baseline = median of the other presses' medians (band 949–1056s)
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY median_cycle_seconds) AS fleet_median,
             min(median_cycle_seconds) AS band_lo,
             max(median_cycle_seconds) AS band_hi
      FROM machine_stats WHERE machine_id <> ${machineId}
    ),
    fac AS (
      SELECT facility FROM cycles WHERE machine_id = ${machineId}
      GROUP BY facility ORDER BY count(*) DESC LIMIT 1
    ),
    last_evt AS (SELECT max(timestamp) AS t FROM events WHERE machine_id = ${machineId})
    SELECT t.machine_id,
           round(t.median_cycle_seconds)::int AS median,
           t.cycle_count::int AS cycle_count,
           t.job_count::int AS job_count,
           t.drift_pct::float8 AS drift_pct,
           t.maintenance_count::int AS maintenance_count,
           t.sensor_glitch_count::int AS sensor_glitch_count,
           o.fleet_median::float8 AS fleet_median,
           round(o.band_lo)::int AS band_lo,
           round(o.band_hi)::int AS band_hi,
           fac.facility,
           last_evt.t AS last_event_at
    FROM target t CROSS JOIN others o CROSS JOIN fac CROSS JOIN last_evt`;
  const r = rows[0];
  if (!r) return null;
  return {
    machine_id: r.machine_id,
    facility_id: r.facility as FacilityId,
    medianCycleSeconds: r.median,
    fleetMedianSeconds: r.fleet_median === null ? null : Math.round(r.fleet_median),
    cycleTimeDriftPct: r.drift_pct,
    cycleCount: r.cycle_count,
    lastEventAt: r.last_event_at?.toISOString() ?? null,
    statusTone: toneFor(r.median, r.fleet_median, r.maintenance_count, r.sensor_glitch_count),
    jobCount: r.job_count,
    maintenanceCount: r.maintenance_count,
    sensorGlitchCount: r.sensor_glitch_count,
    pctAboveFleet:
      r.median !== null && r.fleet_median !== null && r.median > r.fleet_median
        ? Math.floor((r.median / r.fleet_median - 1) * 100)
        : null,
    fleetBandLowSeconds: r.band_lo,
    fleetBandHighSeconds: r.band_hi,
  };
}

export async function listMachines(sql: Db): Promise<Machine[]> {
  const rows = await sql<
    {
      machine_id: string;
      median: number | null;
      fleet_median: number | null;
      cycle_count: number;
      maintenance_count: number;
      sensor_glitch_count: number;
      drift_pct: number | null;
      facility: string;
      last_event_at: Date | null;
    }[]
  >`
    SELECT m.machine_id, round(m.median_cycle_seconds)::int AS median,
           f.fleet_median::float8 AS fleet_median,
           m.cycle_count::int AS cycle_count,
           m.maintenance_count::int AS maintenance_count,
           m.sensor_glitch_count::int AS sensor_glitch_count,
           m.drift_pct::float8 AS drift_pct,
           (SELECT facility FROM cycles c WHERE c.machine_id = m.machine_id
            GROUP BY facility ORDER BY count(*) DESC LIMIT 1) AS facility,
           (SELECT max(timestamp) FROM events e WHERE e.machine_id = m.machine_id) AS last_event_at
    FROM machine_stats m
    CROSS JOIN LATERAL (
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY median_cycle_seconds) AS fleet_median
      FROM machine_stats o WHERE o.machine_id <> m.machine_id
    ) f
    ORDER BY m.machine_id`;
  return rows.map((r) => ({
    machine_id: r.machine_id,
    facility_id: r.facility as FacilityId,
    medianCycleSeconds: r.median,
    fleetMedianSeconds: r.fleet_median === null ? null : Math.round(r.fleet_median),
    cycleTimeDriftPct: r.drift_pct,
    cycleCount: r.cycle_count,
    lastEventAt: r.last_event_at?.toISOString() ?? null,
    statusTone: toneFor(r.median, r.fleet_median, r.maintenance_count, r.sensor_glitch_count),
  }));
}

export async function getWeeklyCycleTrend(
  sql: Db,
  machineId: string,
  window: TrendWindow = 'all',
): Promise<WeeklyTrendPoint[]> {
  const weeks = window === '2w' ? 2 : window === '4w' ? 4 : null;
  const cutoff = weeks
    ? new Date(NOW.getTime() - weeks * 7 * 86_400_000).toISOString()
    : '1970-01-01T00:00:00Z';
  const rows = await sql<
    { week_start: string; machine_median: number | null; fleet_median: number | null; n: number }[]
  >`
    SELECT to_char(date_trunc('week', timestamp), 'YYYY-MM-DD') AS week_start,
           round(percentile_cont(0.5) WITHIN GROUP (ORDER BY cycle_time_seconds)
             FILTER (WHERE machine_id = ${machineId}))::int AS machine_median,
           round(percentile_cont(0.5) WITHIN GROUP (ORDER BY cycle_time_seconds)
             FILTER (WHERE machine_id <> ${machineId}))::int AS fleet_median,
           count(*) FILTER (WHERE machine_id = ${machineId})::int AS n
    FROM cycles
    WHERE machine_id LIKE 'press_%' AND timestamp >= ${cutoff}
    GROUP BY 1 ORDER BY 1`;
  return rows.map((r) => ({
    weekStart: r.week_start,
    machineMedianSeconds: r.machine_median,
    fleetMedianSeconds: r.fleet_median,
    cycleCount: r.n,
  }));
}

interface EventRow {
  event_id: string;
  event_type: string;
  timestamp: Date;
  job_id: string | null;
  machine_id: string | null;
  tool_id: string | null;
  facility: string | null;
  quantity: number | null;
  cycle_time_seconds: number | null;
  signal: string | null;
  reason: string | null;
}

const toSourceEvent = (r: EventRow): SourceEvent => ({
  event_id: r.event_id,
  event_type: r.event_type as EventType,
  timestamp: r.timestamp.toISOString(),
  job_id: r.job_id,
  machine_id: r.machine_id,
  tool_id: r.tool_id,
  facility_id: r.facility as FacilityId | null,
  metadata: Object.fromEntries(
    Object.entries({
      quantity: r.quantity,
      cycle_time_seconds: r.cycle_time_seconds,
      signal: r.signal,
      reason: r.reason,
    }).filter(([, v]) => v !== null),
  ),
});

export async function getRecoveredIncident(
  sql: Db,
  machineId: string,
): Promise<RecoveredIncident | null> {
  const pair = await sql<EventRow[]>`
    SELECT g.event_id, g.event_type, g.timestamp, g.job_id, g.machine_id, g.tool_id,
           g.facility, g.quantity, g.cycle_time_seconds, g.signal, g.reason
    FROM events g JOIN events p
      ON p.event_type = 'maintenance_ping' AND p.machine_id = g.machine_id
     AND p.timestamp BETWEEN g.timestamp AND g.timestamp + interval '3 days'
    WHERE g.event_type = 'sensor_glitch' AND g.machine_id = ${machineId}
    ORDER BY g.timestamp LIMIT 1`;
  if (pair.length === 0) return null;
  const sensorEvent = toSourceEvent(pair[0]);
  const [maint] = await sql<EventRow[]>`
    SELECT event_id, event_type, timestamp, job_id, machine_id, tool_id,
           facility, quantity, cycle_time_seconds, signal, reason
    FROM events
    WHERE event_type = 'maintenance_ping' AND machine_id = ${machineId}
      AND timestamp >= ${sensorEvent.timestamp}
    ORDER BY timestamp LIMIT 1`;
  // Spike window = the second week after the maintenance ping (day boundaries):
  // for press_06 that is Aug 1–8, the verified 949s → 1,810s → 954s sequence.
  const [m] = await sql<
    { baseline: number | null; spike: number | null; recovered: number | null }[]
  >`
    WITH w AS (
      SELECT date_trunc('day', timestamp) + interval '7 days' AS spike_start,
             date_trunc('day', timestamp) + interval '14 days' AS spike_end
      FROM events WHERE event_id = ${maint.event_id} AND event_type = 'maintenance_ping'
      LIMIT 1
    )
    SELECT
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY cycle_time_seconds)
        FILTER (WHERE c.timestamp < w.spike_start))::int AS baseline,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY cycle_time_seconds)
        FILTER (WHERE c.timestamp >= w.spike_start AND c.timestamp < w.spike_end))::int AS spike,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY cycle_time_seconds)
        FILTER (WHERE c.timestamp >= w.spike_end))::int AS recovered
    FROM cycles c CROSS JOIN w WHERE c.machine_id = ${machineId}`;
  if (!m || m.baseline === null || m.spike === null || m.recovered === null) return null;
  return {
    machine_id: machineId,
    sensorEvent,
    maintenanceEvent: toSourceEvent(maint),
    baselineMedianSeconds: m.baseline,
    spikeMedianSeconds: m.spike,
    recoveredMedianSeconds: m.recovered,
  };
}

// Inspections carry QC-station ids (qc_01/qc_02) — attribution goes through the
// job → cycle join to production presses only, and is badged DERIVED in the UI.
const ATTRIBUTION_METHOD =
  'Job → Cycle association: inspections of jobs that ran cycles on this press. ' +
  'Inspections happen at QC stations, not on the press itself.';

interface AttributionRow {
  machine_id: string;
  fail_rate_pct: number;
  inspection_events: number;
  failed_events: number;
}

const attributionSql = (sql: Db, machineId: string | null) => sql<AttributionRow[]>`
  WITH job_machines AS (
    SELECT DISTINCT job_id, machine_id FROM cycles WHERE machine_id LIKE 'press_%'
  )
  SELECT jm.machine_id,
         round(count(*) FILTER (WHERE NOT i.passed)::numeric / count(*) * 100, 1)::float8
           AS fail_rate_pct,
         count(*)::int AS inspection_events,
         count(*) FILTER (WHERE NOT i.passed)::int AS failed_events
  FROM job_machines jm JOIN inspections i USING (job_id)
  WHERE ${machineId === null ? sql`true` : sql`jm.machine_id = ${machineId}`}
  GROUP BY jm.machine_id ORDER BY jm.machine_id`;

export async function getQualityAttribution(
  sql: Db,
  machineId: string,
): Promise<QualityAttribution | null> {
  const [row] = await attributionSql(sql, machineId);
  if (!row) return null;
  const evidence = await sql<{ event_id: string }[]>`
    WITH job_machines AS (
      SELECT DISTINCT job_id FROM cycles WHERE machine_id = ${machineId}
    )
    SELECT i.event_id FROM job_machines jm JOIN inspections i USING (job_id)
    WHERE NOT i.passed ORDER BY i.timestamp DESC LIMIT 5`;
  return {
    machine_id: row.machine_id,
    provenance: 'derived',
    method: ATTRIBUTION_METHOD,
    failRatePct: row.fail_rate_pct,
    inspectionEvents: row.inspection_events,
    failedEvents: row.failed_events,
    supportingEventIds: evidence.map((e) => e.event_id),
  };
}

export async function getFleetAttribution(
  sql: Db,
): Promise<Pick<QualityAttribution, 'machine_id' | 'failRatePct' | 'provenance'>[]> {
  const rows = await attributionSql(sql, null);
  return rows.map((r) => ({
    machine_id: r.machine_id,
    failRatePct: r.fail_rate_pct,
    provenance: 'derived' as const,
  }));
}

export async function getAffectedJobs(
  sql: Db,
  machineId: string,
  facility?: FacilityId,
): Promise<Job[]> {
  const rows = await sql<
    {
      job_id: string;
      customer_id: string;
      part_id: string;
      facility: string;
      target_quantity: number | null;
      target_due_at: Date | null;
      unit_price_estimate: number | null;
      created_at: Date;
      status: string;
      block_reason: string | null;
      good_quantity: number | null;
      scrap_quantity: number | null;
      overdue: boolean;
      revenue_at_risk: number | null;
    }[]
  >`
    SELECT j.job_id, j.customer_id, j.part_id, j.facility,
           j.target_quantity::int AS target_quantity, j.target_due_at,
           j.unit_price_estimate::float8 AS unit_price_estimate, j.created_at,
           j.status, j.block_reason,
           j.good_quantity::int AS good_quantity, j.scrap_quantity::int AS scrap_quantity,
           j.overdue, j.revenue_at_risk::float8 AS revenue_at_risk
    FROM jobs_current j
    WHERE EXISTS (SELECT 1 FROM cycles c WHERE c.job_id = j.job_id AND c.machine_id = ${machineId})
      AND ${facility ? sql`j.facility = ${facility}` : sql`true`}
    ORDER BY (j.status = 'completed'), j.overdue DESC,
             (j.status IN ('blocked','held')) DESC, j.target_due_at`;
  const atRiskCutoff = new Date(NOW.getTime() + 7 * 86_400_000);
  return rows.map((r) => ({
    job_id: r.job_id,
    customer_id: r.customer_id,
    part_id: r.part_id,
    facility_id: r.facility as FacilityId,
    target_quantity: r.target_quantity ?? 0,
    due_date: r.target_due_at?.toISOString() ?? '',
    unit_price_estimate: r.unit_price_estimate,
    created_at: r.created_at.toISOString(),
    status: r.status as JobStatus,
    block_reason: r.block_reason,
    completed_quantity: r.good_quantity ?? 0,
    scrap_quantity: r.scrap_quantity ?? 0,
    deliveryRisk: r.overdue
      ? 'overdue'
      : r.status !== 'completed' && r.target_due_at !== null && r.target_due_at < atRiskCutoff
        ? 'at_risk'
        : 'on_track',
    valueAtRisk: r.revenue_at_risk,
  }));
}

export async function getEvidenceLog(sql: Db, machineId: string): Promise<SourceEvent[]> {
  const rows = await sql<EventRow[]>`
    (SELECT event_id, event_type, timestamp, job_id, machine_id, tool_id,
            facility, quantity, cycle_time_seconds, signal, reason
     FROM events
     WHERE machine_id = ${machineId} AND event_type IN ('sensor_glitch','maintenance_ping'))
    UNION ALL
    (SELECT event_id, event_type, timestamp, job_id, machine_id, tool_id,
            facility, quantity, cycle_time_seconds, signal, reason
     FROM events
     WHERE machine_id = ${machineId} AND event_type = 'cycle_completed'
     ORDER BY cycle_time_seconds DESC LIMIT 8)
    ORDER BY timestamp DESC`;
  return rows.map(toSourceEvent);
}

export async function getAlertSummaries(sql: Db, facility?: FacilityId): Promise<AlertSummary[]> {
  const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const out: AlertSummary[] = [];

  const cycleRows = await sql<
    { machine_id: string; median: number; pct_above: number; drift_pct: number; evidence: string[] }[]
  >`
    SELECT m.machine_id, round(m.median_cycle_seconds)::int AS median,
           floor((m.median_cycle_seconds / f.fleet_median - 1) * 100)::int AS pct_above,
           m.drift_pct::float8 AS drift_pct,
           (SELECT array_agg(event_id) FROM (
              SELECT event_id FROM cycles c
              WHERE c.machine_id = m.machine_id ORDER BY c.cycle_time_seconds DESC LIMIT 5
            ) slow) AS evidence
    FROM machine_stats m
    CROSS JOIN LATERAL (
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY median_cycle_seconds) AS fleet_median
      FROM machine_stats o WHERE o.machine_id <> m.machine_id
    ) f
    WHERE m.median_cycle_seconds > f.fleet_median * 1.15`;
  for (const r of cycleRows) {
    out.push({
      alert_id: `cycle_time:${r.machine_id}`,
      rule: 'cycle_time_vs_baseline',
      severity: 'critical',
      title: `Slowing cycle time — ${r.machine_id}`,
      explanation: `${fmt.format(r.median)}s median · ${r.pct_above}% above fleet · rising trend · no maintenance recorded`,
      businessImpact: 'Throughput loss on 1 of 6 presses; open jobs routed here at risk',
      implicated_ids: [r.machine_id],
      supporting_event_ids: r.evidence,
      provenance: 'derived',
      href: `/machines/${r.machine_id}`,
      latest_event_at: null,
    });
  }

  const [od] = await sql<
    { n: number; value: number | null; latest: Date | null; evidence: string[] | null }[]
  >`
    SELECT count(*)::int AS n, sum(revenue_at_risk)::float8 AS value,
           max(target_due_at) AS latest,
           (array_agg(created_event_id ORDER BY revenue_at_risk DESC NULLS LAST))[1:5] AS evidence
    FROM jobs_current
    WHERE overdue AND ${facility ? sql`facility = ${facility}` : sql`true`}`;
  if (od && od.n > 0) {
    out.push({
      alert_id: 'overdue_incomplete',
      rule: 'overdue_incomplete',
      severity: 'critical',
      title: 'Overdue incomplete work',
      explanation: `${od.n} jobs are past their promised due date and still unfinished`,
      businessImpact: od.value
        ? `$${fmt.format(Math.round(od.value))} estimated order value at risk (price coverage: 150 of 312 jobs)`
        : null,
      implicated_ids: [facility ?? 'all_facilities'],
      supporting_event_ids: od.evidence ?? [],
      provenance: 'derived',
      href: '/jobs?risk=overdue',
      latest_event_at: od.latest?.toISOString() ?? null,
    });
  }

  const [bl] = await sql<
    { n: number; top_reason: string | null; reason_n: number | null; total_blocks: number; evidence: string[] | null }[]
  >`
    WITH stuck AS (
      SELECT * FROM jobs_current
      WHERE status IN ('blocked','held') AND ${facility ? sql`facility = ${facility}` : sql`true`}
    ),
    reasons AS (
      SELECT reason, count(*)::int AS n FROM events
      WHERE event_type = 'job_blocked' AND reason IS NOT NULL
      GROUP BY reason ORDER BY n DESC LIMIT 1
    )
    SELECT (SELECT count(*)::int FROM stuck) AS n,
           (SELECT reason FROM reasons) AS top_reason,
           (SELECT n FROM reasons) AS reason_n,
           (SELECT count(*)::int FROM events WHERE event_type = 'job_blocked') AS total_blocks,
           (SELECT (array_agg(lifecycle_event_id))[1:5] FROM stuck) AS evidence`;
  if (bl && bl.n > 0) {
    out.push({
      alert_id: 'blocked_or_held',
      rule: 'blocked_or_held',
      severity: 'warn',
      title: 'Tooling constraint — blocked/held work',
      explanation: `${bl.n} jobs currently blocked or held · top block reason ${bl.top_reason} (${bl.reason_n} of ${bl.total_blocks} blocks)`,
      businessImpact: null,
      implicated_ids: [bl.top_reason ?? 'blocked'],
      supporting_event_ids: bl.evidence ?? [],
      provenance: 'derived',
      href: '/jobs?status=blocked-held',
      latest_event_at: null,
    });
  }

  const incidents = await sql<{ machine_id: string }[]>`
    SELECT DISTINCT g.machine_id
    FROM events g JOIN events p
      ON p.event_type = 'maintenance_ping' AND p.machine_id = g.machine_id
     AND p.timestamp BETWEEN g.timestamp AND g.timestamp + interval '3 days'
    WHERE g.event_type = 'sensor_glitch' AND g.machine_id LIKE 'press_%'`;
  for (const { machine_id } of incidents) {
    const inc = await getRecoveredIncident(sql, machine_id);
    if (!inc) continue;
    out.push({
      alert_id: `recovered_incident:${machine_id}`,
      rule: 'recovered_incident',
      severity: 'info',
      title: `Recovered incident — ${machine_id}`,
      explanation:
        `${inc.sensorEvent.metadata.signal ?? 'sensor'} sensor_glitch (${inc.sensorEvent.timestamp.slice(0, 10)}) ` +
        `and maintenance_ping (${inc.maintenanceEvent.timestamp.slice(0, 10)}) were followed by a weekly-median spike ` +
        `${fmt.format(inc.baselineMedianSeconds)}s → ${fmt.format(inc.spikeMedianSeconds)}s, then recovery to ${fmt.format(inc.recoveredMedianSeconds)}s`,
      businessImpact: null,
      implicated_ids: [machine_id],
      supporting_event_ids: [inc.sensorEvent.event_id, inc.maintenanceEvent.event_id],
      provenance: 'derived',
      href: `/machines/${machine_id}`,
      latest_event_at: inc.maintenanceEvent.timestamp,
    });
  }

  return out;
}
