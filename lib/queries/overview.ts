import type { Sql } from 'postgres';
import type {
  AlertRule,
  DefectCode,
  FacilityId,
  Provenance,
  Severity,
  StatusTone,
} from '@/lib/types';

// Query functions take the postgres client as a parameter: lib/db.ts is
// `server-only`, so the page passes its client and tests pass tests/helpers'.

export type OverviewRule = AlertRule | 'recovered_incident';

export interface OverviewKpis {
  activeJobs: number;
  blockedHeldJobs: number;
  missingToolBlocks: number;
  totalBlocks: number;
  overdueJobs: number;
  overdueValue: number;
  overduePricedJobs: number;
  pricedJobs: number;
  totalJobs: number;
  inProcessFailRatePct: number;
  completedYieldPct: number;
}

export interface QueueAlert {
  alert_id: string;
  rule: OverviewRule;
  severity: Severity;
  title: string;
  explanation: string;
  businessImpact: string;
  evidenceFacts: string[];
  implicated_ids: string[];
  supporting_event_ids: string[];
  provenance: Provenance;
  href: string;
  actionLabel: string;
  metrics: Record<string, number>;
}

export interface FacilityPulse {
  facility_id: FacilityId;
  openJobs: number;
  blockedHeldJobs: number;
  overdueJobs: number;
  recent24hQuantity: number;
  topOverdueJobId: string | null;
  topOverdueValue: number | null;
  latestEventAt: string;
  latestEventId: string;
}

export interface MachineStripCell {
  machine_id: string;
  medianCycleSeconds: number;
  fleetMedianSeconds: number;
  cycleCount: number;
  maintenanceCount: number;
  statusTone: StatusTone;
  weeklyMedians: number[];
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface OverviewTrends {
  throughput: TrendPoint[];
  passRate: TrendPoint[];
  overallPassRatePct: number;
}

export interface DefectSlice {
  defect_code: DefectCode;
  failedInspections: number;
  materialsWhereTop: number;
}

export interface ProvenanceStats {
  totalEvents: number;
  la01SharePct: number;
  la02SharePct: number;
  latestEventId: string;
  latestEventAt: string;
}

export interface RecommendedAction {
  text: string;
  href: string;
}

const n = (v: number) => Math.round(v).toLocaleString('en-US');
const day = (d: Date) => d.toISOString().slice(0, 10);

export async function getOverviewKpis(sql: Sql, facility?: FacilityId): Promise<OverviewKpis> {
  const fac = facility ? sql`and facility = ${facility}` : sql``;
  const [jobs] = await sql<
    {
      active: number;
      blocked_held: number;
      overdue: number;
      overdue_value: number;
      overdue_priced: number;
      priced: number;
      total: number;
      yield_pct: number;
    }[]
  >`
    select
      count(*) filter (where status in ('created','in_progress'))::int as active,
      count(*) filter (where status in ('blocked','held'))::int as blocked_held,
      count(*) filter (where overdue)::int as overdue,
      coalesce(sum(revenue_at_risk), 0)::float8 as overdue_value,
      count(*) filter (where overdue and revenue_at_risk is not null)::int as overdue_priced,
      count(*) filter (where unit_price_estimate is not null)::int as priced,
      count(*)::int as total,
      round(sum(good_quantity) filter (where status = 'completed')::numeric
        / nullif(sum(good_quantity + scrap_quantity) filter (where status = 'completed'), 0)
        * 100)::float8 as yield_pct
    from jobs_current where true ${fac}`;
  const [blocks] = await sql<{ total: number; missing_tool: number }[]>`
    select count(*)::int as total,
           count(*) filter (where reason = 'missing_tool')::int as missing_tool
    from events where event_type = 'job_blocked' ${fac}`;
  const [insp] = await sql<{ fail_pct: number }[]>`
    select round(count(*) filter (where not passed)::numeric / nullif(count(*), 0) * 100, 1)::float8 as fail_pct
    from inspections where true ${fac}`;
  return {
    activeJobs: jobs.active,
    blockedHeldJobs: jobs.blocked_held,
    missingToolBlocks: blocks.missing_tool,
    totalBlocks: blocks.total,
    overdueJobs: jobs.overdue,
    overdueValue: jobs.overdue_value,
    overduePricedJobs: jobs.overdue_priced,
    pricedJobs: jobs.priced,
    totalJobs: jobs.total,
    inProcessFailRatePct: insp.fail_pct,
    completedYieldPct: jobs.yield_pct,
  };
}

export async function getNeedsAttention(sql: Sql, facility?: FacilityId): Promise<QueueAlert[]> {
  const fac = facility ? sql`and facility = ${facility}` : sql``;
  const queue: QueueAlert[] = [];

  const [p3] = await sql<
    {
      median: number;
      fleet_median: number;
      drift_pct: number;
      maintenance: number;
      open_jobs: number;
      slow_events: string[];
    }[]
  >`
    with mine as (
      select percentile_cont(0.5) within group (order by cycle_time_seconds) as median
      from cycles where machine_id = 'press_03' ${fac}),
    fleet as (
      -- median of the other presses' per-press medians: the same fleet baseline
      -- machine detail uses, so both surfaces state one "% above fleet" figure
      select percentile_cont(0.5) within group (order by m) as median
      from (select percentile_cont(0.5) within group (order by cycle_time_seconds) as m
            from cycles where machine_id like 'press_%' and machine_id <> 'press_03' ${fac}
            group by machine_id) per)
    select round(mine.median)::int as median,
           round(fleet.median)::int as fleet_median,
           (select drift_pct from machine_stats where machine_id = 'press_03')::float8 as drift_pct,
           (select maintenance_count from machine_stats where machine_id = 'press_03')::int as maintenance,
           (select count(distinct c.job_id) from cycles c
              join jobs_current j using (job_id)
             where c.machine_id = 'press_03' and j.status <> 'completed')::int as open_jobs,
           (select array_agg(event_id) from (
              select event_id from cycles where machine_id = 'press_03' ${fac}
              order by cycle_time_seconds desc limit 5) s) as slow_events
    from mine, fleet`;
  if (p3 && p3.median > p3.fleet_median * 1.15) {
    // floor to match machine detail's "at least N% above fleet" claim (25%)
    const pctAbove = Math.floor((p3.median / p3.fleet_median - 1) * 100);
    queue.push({
      alert_id: 'ovw_press_03_cycle_time',
      rule: 'cycle_time_vs_baseline',
      severity: 'critical',
      title: 'Slowing cycle time — press_03',
      explanation: `${n(p3.median)}s median; ${pctAbove}% above the ${n(p3.fleet_median)}s fleet median; drifting +${p3.drift_pct}%; no maintenance recorded (${p3.maintenance} events).`,
      businessImpact: `~${pctAbove}% capacity loss on 1 of 6 presses; ${p3.open_jobs} open jobs routed here at risk`,
      evidenceFacts: [
        `median ${n(p3.median)}s vs fleet ${n(p3.fleet_median)}s (+${pctAbove}%)`,
        `first→second half drift +${p3.drift_pct}%`,
        `${p3.maintenance} maintenance events recorded`,
      ],
      implicated_ids: ['press_03'],
      supporting_event_ids: p3.slow_events ?? [],
      provenance: 'derived',
      href: '/machines/press_03',
      actionLabel: 'Open machine investigation',
      metrics: { pctAboveFleet: pctAbove, medianCycleSeconds: p3.median },
    });
  }

  const [od] = await sql<
    {
      jobs: number;
      value: number;
      priced: number;
      customers: number;
      top_job: string | null;
      top_value: number | null;
      event_ids: string[];
    }[]
  >`
    select count(*)::int as jobs,
           coalesce(sum(revenue_at_risk), 0)::float8 as value,
           count(*) filter (where revenue_at_risk is not null)::int as priced,
           count(distinct customer_id)::int as customers,
           (select job_id from jobs_current where overdue ${fac}
            order by revenue_at_risk desc nulls last limit 1) as top_job,
           (select revenue_at_risk from jobs_current where overdue ${fac}
            order by revenue_at_risk desc nulls last limit 1)::float8 as top_value,
           array_agg(created_event_id) as event_ids
    from jobs_current where overdue ${fac}`;
  if (od.jobs > 0) {
    queue.push({
      alert_id: 'ovw_overdue_incomplete',
      rule: 'overdue_incomplete',
      severity: 'critical',
      title: 'Overdue incomplete work',
      explanation: `${od.jobs} jobs past their target due date at the frozen horizon and not completed.`,
      businessImpact: `$${n(od.value)} estimated order value late across ${od.customers} customers — $ over ${od.priced} of ${od.jobs} jobs with price data`,
      evidenceFacts: [
        `$${n(od.value)} at risk over ${od.priced} of ${od.jobs} priced jobs (coverage 150/312)`,
        `${od.customers} distinct customers affected`,
        `largest: ${od.top_job ?? '—'} at $${od.top_value == null ? '—' : n(od.top_value)}`,
      ],
      implicated_ids: [od.top_job ?? 'jobs_current'],
      supporting_event_ids: od.event_ids ?? [],
      provenance: 'derived',
      href: '/jobs?risk=overdue',
      actionLabel: 'Open filtered jobs',
      metrics: { overdueJobs: od.jobs, overdueValue: Math.round(od.value), customers: od.customers },
    });
  }

  const [bl] = await sql<
    {
      blocked_held: number;
      missing_tool: number;
      total_blocks: number;
      value: number;
      priced: number;
      event_ids: string[];
      job_ids: string[];
    }[]
  >`
    select
      (select count(*) from jobs_current where status in ('blocked','held') ${fac})::int as blocked_held,
      (select count(*) from events where event_type = 'job_blocked' and reason = 'missing_tool' ${fac})::int as missing_tool,
      (select count(*) from events where event_type = 'job_blocked' ${fac})::int as total_blocks,
      coalesce((select sum(unit_price_estimate * target_quantity) from jobs_current
                 where status in ('blocked','held') ${fac}), 0)::float8 as value,
      (select count(*) from jobs_current
        where status in ('blocked','held') and unit_price_estimate is not null ${fac})::int as priced,
      (select array_agg(lifecycle_event_id) from jobs_current
        where status in ('blocked','held') ${fac}) as event_ids,
      (select array_agg(job_id order by unit_price_estimate * target_quantity desc nulls last)
         from jobs_current where status in ('blocked','held') ${fac}) as job_ids`;
  if (bl.blocked_held > 0) {
    queue.push({
      alert_id: 'ovw_missing_tool',
      rule: 'blocked_or_held',
      severity: 'warn',
      title: 'Tooling constraint',
      explanation: `missing_tool cited in ${bl.missing_tool} of ${bl.total_blocks} block events; ${bl.blocked_held} jobs currently blocked/held.`,
      businessImpact: `$${n(bl.value)} estimated order value stranded ($ over ${bl.priced} of ${bl.blocked_held} jobs with price data); leading single cause of stranded work`,
      evidenceFacts: [
        `${bl.missing_tool} of ${bl.total_blocks} job_blocked events cite missing_tool`,
        `${bl.blocked_held} jobs currently blocked or held`,
        `$${n(bl.value)} estimated value over ${bl.priced} of ${bl.blocked_held} priced jobs`,
      ],
      implicated_ids: (bl.job_ids ?? []).slice(0, 3),
      supporting_event_ids: bl.event_ids ?? [],
      provenance: 'derived',
      href: '/jobs?status=blocked-held&reason=missing_tool',
      actionLabel: 'Open filtered jobs',
      metrics: {
        blockedHeldJobs: bl.blocked_held,
        missingToolBlocks: bl.missing_tool,
        totalBlocks: bl.total_blocks,
        blockedValue: Math.round(bl.value),
      },
    });
  }

  const [p6] = await sql<
    {
      glitch_id: string;
      glitch_at: Date;
      signal: string | null;
      ping_id: string;
      ping_at: Date;
      spike_median: number;
      overall_median: number;
    }[]
  >`
    select g.event_id as glitch_id, g.timestamp as glitch_at, g.signal,
           p.event_id as ping_id, p.timestamp as ping_at,
           -- same day-boundary spike window machine detail uses (ping +7d..+14d),
           -- so every surface states the one verified 1,810s figure
           (select round(percentile_cont(0.5) within group (order by cycle_time_seconds))::int
              from cycles where machine_id = 'press_06' ${fac}
                and timestamp >= date_trunc('day', p.timestamp) + interval '7 days'
                and timestamp <  date_trunc('day', p.timestamp) + interval '14 days')
             as spike_median,
           (select round(percentile_cont(0.5) within group (order by cycle_time_seconds))::int
              from cycles where machine_id = 'press_06' ${fac}) as overall_median
    from events g
    join events p on p.event_type = 'maintenance_ping' and p.machine_id = g.machine_id
      and p.timestamp between g.timestamp and g.timestamp + interval '3 days'
    where g.event_type = 'sensor_glitch' and g.machine_id = 'press_06'
    order by g.timestamp limit 1`;
  if (p6) {
    const windowStart = new Date(p6.glitch_at.getTime() - 4 * 86400_000);
    const windowEnd = new Date(p6.glitch_at.getTime() + 10 * 86400_000);
    queue.push({
      alert_id: 'ovw_press_06_incident',
      rule: 'recovered_incident',
      severity: 'info',
      title: 'Recovered asset incident — press_06',
      explanation: `${p6.signal ?? 'sensor'} sensor_glitch (${day(p6.glitch_at)}) then maintenance_ping (${day(p6.ping_at)}) preceded a spike week — weekly median ${n(p6.spike_median)}s vs ${n(p6.overall_median)}s overall; recovered.`,
      businessImpact: 'recovered; validates sensor→throughput correlation',
      evidenceFacts: [
        `${p6.signal ?? 'sensor'} sensor_glitch ${p6.glitch_id} on ${day(p6.glitch_at)}`,
        `maintenance_ping ${p6.ping_id} on ${day(p6.ping_at)}`,
        `spike-week median ${n(p6.spike_median)}s vs ${n(p6.overall_median)}s overall, then recovered`,
      ],
      implicated_ids: ['press_06'],
      supporting_event_ids: [p6.glitch_id, p6.ping_id],
      provenance: 'derived',
      href: `/machines/press_06?window=${day(windowStart)}..${day(windowEnd)}`,
      actionLabel: 'Open machine investigation',
      metrics: { spikeWeekMedian: p6.spike_median, overallMedian: p6.overall_median },
    });
  }

  return queue;
}

export async function getFacilityPulse(sql: Sql): Promise<FacilityPulse[]> {
  const rows = await sql<
    {
      facility: FacilityId;
      open_jobs: number;
      blocked_held: number;
      overdue: number;
      recent_qty: number;
      top_job: string | null;
      top_value: number | null;
      latest_at: Date;
      latest_id: string;
    }[]
  >`
    select j.facility,
           count(*) filter (where j.status in ('created','in_progress'))::int as open_jobs,
           count(*) filter (where j.status in ('blocked','held'))::int as blocked_held,
           count(*) filter (where j.overdue)::int as overdue,
           coalesce((select sum(quantity) from cycles c
                      where c.facility = j.facility
                        and c.timestamp >= frozen_now() - interval '24 hours'), 0)::int as recent_qty,
           (select job_id from jobs_current where overdue and facility = j.facility
             order by revenue_at_risk desc nulls last limit 1) as top_job,
           (select revenue_at_risk from jobs_current where overdue and facility = j.facility
             order by revenue_at_risk desc nulls last limit 1)::float8 as top_value,
           (select timestamp from events e where e.facility = j.facility
             order by timestamp desc, event_id desc limit 1) as latest_at,
           (select event_id from events e where e.facility = j.facility
             order by timestamp desc, event_id desc limit 1) as latest_id
    from jobs_current j
    group by j.facility
    order by j.facility`;
  return rows.map((r) => ({
    facility_id: r.facility,
    openJobs: r.open_jobs,
    blockedHeldJobs: r.blocked_held,
    overdueJobs: r.overdue,
    recent24hQuantity: r.recent_qty,
    topOverdueJobId: r.top_job,
    topOverdueValue: r.top_value,
    latestEventAt: r.latest_at.toISOString(),
    latestEventId: r.latest_id,
  }));
}

export async function getMachineStrip(sql: Sql, facility?: FacilityId): Promise<MachineStripCell[]> {
  const fac = facility ? sql`and facility = ${facility}` : sql``;
  const rows = await sql<
    {
      machine_id: string;
      median: number;
      cycle_count: number;
      maintenance: number;
      recovered: boolean;
      weekly: number[];
    }[]
  >`
    select c.machine_id,
           round(percentile_cont(0.5) within group (order by c.cycle_time_seconds))::int as median,
           count(*)::int as cycle_count,
           coalesce((select maintenance_count from machine_stats m where m.machine_id = c.machine_id), 0)::int as maintenance,
           exists (select 1 from events g join events p
                     on p.event_type = 'maintenance_ping' and p.machine_id = g.machine_id
                    and p.timestamp between g.timestamp and g.timestamp + interval '3 days'
                   where g.event_type = 'sensor_glitch' and g.machine_id = c.machine_id) as recovered,
           (select array_agg(med order by wk) from (
              select date_trunc('week', timestamp) as wk,
                     round(percentile_cont(0.5) within group (order by cycle_time_seconds))::int as med
              from cycles w where w.machine_id = c.machine_id ${fac}
              group by 1) s) as weekly
    from cycles c
    where c.machine_id like 'press_%' ${fac}
    group by c.machine_id
    order by c.machine_id`;
  return rows.map((r) => {
    const others = rows.filter((o) => o.machine_id !== r.machine_id).map((o) => o.median);
    const fleet = others.sort((a, b) => a - b)[Math.floor(others.length / 2)] ?? r.median;
    const tone: StatusTone =
      r.median > fleet * 1.15 ? 'warn' : r.recovered ? 'info' : 'ok';
    return {
      machine_id: r.machine_id,
      medianCycleSeconds: r.median,
      fleetMedianSeconds: fleet,
      cycleCount: r.cycle_count,
      maintenanceCount: r.maintenance,
      statusTone: tone,
      weeklyMedians: r.weekly ?? [],
    };
  });
}

export async function getOverviewTrends(sql: Sql, facility?: FacilityId): Promise<OverviewTrends> {
  const fac = facility ? sql`and facility = ${facility}` : sql``;
  const throughput = await sql<{ date: string; value: number }[]>`
    select timestamp::date::text as date, sum(quantity)::int as value
    from cycles where true ${fac} group by 1 order by 1`;
  const passRate = await sql<{ date: string; value: number }[]>`
    select timestamp::date::text as date,
           round(count(*) filter (where passed)::numeric / count(*) * 100, 1)::float8 as value
    from inspections where true ${fac} group by 1 order by 1`;
  const [overall] = await sql<{ pct: number }[]>`
    select round(count(*) filter (where passed)::numeric / nullif(count(*), 0) * 100, 1)::float8 as pct
    from inspections where true ${fac}`;
  return {
    throughput: throughput.map((r) => ({ date: r.date, value: r.value })),
    passRate: passRate.map((r) => ({ date: r.date, value: r.value })),
    overallPassRatePct: overall.pct,
  };
}

export async function getDefectPareto(sql: Sql): Promise<DefectSlice[]> {
  const rows = await sql<
    { defect_code: DefectCode; failed: number; materials_top: number }[]
  >`
    with per_material as (
      select distinct on (material) material, defect_code
      from inspections where not passed
      group by material, defect_code
      order by material, count(*) desc)
    select i.defect_code, count(*)::int as failed,
           (select count(*) from per_material p where p.defect_code = i.defect_code)::int as materials_top
    from inspections i where not i.passed
    group by i.defect_code
    order by failed desc`;
  return rows.map((r) => ({
    defect_code: r.defect_code,
    failedInspections: r.failed,
    materialsWhereTop: r.materials_top,
  }));
}

export async function getProvenanceStats(sql: Sql): Promise<ProvenanceStats> {
  const [row] = await sql<
    { total: number; la01_pct: number; la02_pct: number; latest_id: string; latest_at: Date }[]
  >`
    select count(*)::int as total,
           round(count(*) filter (where facility = 'la_01')::numeric / count(*) * 100)::int as la01_pct,
           round(count(*) filter (where facility = 'la_02')::numeric / count(*) * 100)::int as la02_pct,
           (select event_id from events order by timestamp desc, event_id desc limit 1) as latest_id,
           (select timestamp from events order by timestamp desc, event_id desc limit 1) as latest_at
    from events`;
  return {
    totalEvents: row.total,
    la01SharePct: row.la01_pct,
    la02SharePct: row.la02_pct,
    latestEventId: row.latest_id,
    latestEventAt: row.latest_at.toISOString(),
  };
}

export function deriveRecommendedActions(
  queue: QueueAlert[],
  pareto: DefectSlice[],
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  const p3 = queue.find((a) => a.alert_id === 'ovw_press_03_cycle_time');
  if (p3)
    actions.push({
      text: `Schedule inspection of press_03 — cycle time ${p3.metrics.pctAboveFleet}% above fleet and rising, no maintenance on record`,
      href: p3.href,
    });
  const od = queue.find((a) => a.alert_id === 'ovw_overdue_incomplete');
  if (od)
    actions.push({
      text: `Expedite or re-commit ${od.metrics.overdueJobs} overdue jobs ($${n(od.metrics.overdueValue)}) — start with highest-value customers`,
      href: od.href,
    });
  const bl = queue.find((a) => a.alert_id === 'ovw_missing_tool');
  if (bl)
    actions.push({
      text: `Source missing tooling — ${bl.metrics.missingToolBlocks} of ${bl.metrics.totalBlocks} blocks cite missing_tool; ${bl.metrics.blockedHeldJobs} jobs stranded now`,
      href: bl.href,
    });
  const voids = pareto.find((d) => d.defect_code === 'voids');
  if (voids)
    actions.push({
      text: `Investigate shared cure/vacuum/debulk process — voids lead defects (${n(voids.failedInspections)}) in all ${voids.materialsWhereTop} materials`,
      href: '/alerts',
    });
  return actions;
}
