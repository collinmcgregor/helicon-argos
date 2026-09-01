import type { Sql } from 'postgres';
import type { JobStatus } from '@/lib/types';

// Tooling is observed only through cycle_completed.tool_id and tool_ready
// events; every figure here is an aggregate over those raw events.

export interface ToolListItem {
  tool_id: string;
  cycleCount: number;
  jobCount: number;
  machines: string[];
  medianCycleSeconds: number;
  totalQuantity: number;
  lastUsed: string;
}

export interface ToolJobRow {
  job_id: string;
  status: JobStatus;
  overdue: boolean;
  cycleCount: number;
  quantity: number;
}

export interface ToolCycleRow {
  event_id: string;
  timestamp: string;
  machine_id: string | null;
  job_id: string | null;
  quantity: number;
  cycle_time_seconds: number;
}

export interface ToolDetail {
  tool_id: string;
  cycleCount: number;
  jobCount: number;
  machines: { machine_id: string; cycleCount: number }[];
  medianCycleSeconds: number;
  totalQuantity: number;
  firstUsed: string;
  lastUsed: string;
  readyEventCount: number;
  jobs: ToolJobRow[];
  recentCycles: ToolCycleRow[];
}

export async function listTools(sql: Sql): Promise<ToolListItem[]> {
  const rows = await sql<
    {
      tool_id: string;
      cycle_count: number;
      job_count: number;
      machines: string[];
      median: number;
      total_qty: number;
      last_used: Date;
    }[]
  >`
    select tool_id,
           count(*)::int as cycle_count,
           count(distinct job_id)::int as job_count,
           array(select distinct machine_id from cycles i
                  where i.tool_id = c.tool_id and i.machine_id is not null
                  order by machine_id) as machines,
           round(percentile_cont(0.5) within group (order by cycle_time_seconds))::int as median,
           coalesce(sum(quantity), 0)::int as total_qty,
           max(timestamp) as last_used
    from cycles c
    where tool_id is not null
    group by tool_id
    order by cycle_count desc`;
  return rows.map((r) => ({
    tool_id: r.tool_id,
    cycleCount: r.cycle_count,
    jobCount: r.job_count,
    machines: r.machines ?? [],
    medianCycleSeconds: r.median,
    totalQuantity: r.total_qty,
    lastUsed: r.last_used.toISOString(),
  }));
}

export async function getTool(sql: Sql, toolId: string): Promise<ToolDetail | null> {
  const [head] = await sql<
    {
      cycle_count: number;
      job_count: number;
      median: number;
      total_qty: number;
      first_used: Date;
      last_used: Date;
      ready_count: number;
    }[]
  >`
    select count(*)::int as cycle_count,
           count(distinct job_id)::int as job_count,
           round(percentile_cont(0.5) within group (order by cycle_time_seconds))::int as median,
           coalesce(sum(quantity), 0)::int as total_qty,
           min(timestamp) as first_used,
           max(timestamp) as last_used,
           (select count(*) from events
             where event_type = 'tool_ready' and tool_id = ${toolId})::int as ready_count
    from cycles where tool_id = ${toolId}`;
  if (!head || head.cycle_count === 0) return null;

  const machines = await sql<{ machine_id: string; cycle_count: number }[]>`
    select machine_id, count(*)::int as cycle_count
    from cycles where tool_id = ${toolId} and machine_id is not null
    group by machine_id order by cycle_count desc`;

  const jobs = await sql<
    { job_id: string; status: JobStatus; overdue: boolean; cycle_count: number; quantity: number }[]
  >`
    select c.job_id, j.status, j.overdue,
           count(*)::int as cycle_count, coalesce(sum(c.quantity), 0)::int as quantity
    from cycles c join jobs_current j using (job_id)
    where c.tool_id = ${toolId}
    group by c.job_id, j.status, j.overdue
    order by j.overdue desc, count(*) desc`;

  const recent = await sql<
    {
      event_id: string;
      timestamp: Date;
      machine_id: string | null;
      job_id: string | null;
      quantity: number;
      cycle_time_seconds: number;
    }[]
  >`
    select event_id, timestamp, machine_id, job_id, quantity, cycle_time_seconds
    from cycles where tool_id = ${toolId}
    order by timestamp desc limit 40`;

  return {
    tool_id: toolId,
    cycleCount: head.cycle_count,
    jobCount: head.job_count,
    machines: machines.map((m) => ({ machine_id: m.machine_id, cycleCount: m.cycle_count })),
    medianCycleSeconds: head.median,
    totalQuantity: head.total_qty,
    firstUsed: head.first_used.toISOString(),
    lastUsed: head.last_used.toISOString(),
    readyEventCount: head.ready_count,
    jobs: jobs.map((j) => ({
      job_id: j.job_id,
      status: j.status,
      overdue: j.overdue,
      cycleCount: j.cycle_count,
      quantity: j.quantity,
    })),
    recentCycles: recent.map((c) => ({
      event_id: c.event_id,
      timestamp: c.timestamp.toISOString(),
      machine_id: c.machine_id,
      job_id: c.job_id,
      quantity: c.quantity,
      cycle_time_seconds: c.cycle_time_seconds,
    })),
  };
}
