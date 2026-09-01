import Link from 'next/link';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { DerivedBadge } from '@/components/DerivedBadge';
import { EmptyState } from '@/components/EmptyState';
import { MiniPareto } from '@/components/MiniPareto';
import { PageTitle } from '@/components/PageTitle';
import { Panel } from '@/components/Panel';
import { PlyBar } from '@/components/PlyBar';
import { StatusBadge } from '@/components/StatusBadge';
import { TimelineHeader, TimelineRow } from '@/components/TimelineRow';
import {
  EVENT_HORIZON_DISPLAY,
  formatDate,
  formatEntityId,
  formatFacility,
  formatJobId,
  formatLabel,
  formatLabelLower,
  formatStamp,
} from '@/lib/display';
import type { StatusTone } from '@/lib/types';
import { getJob, type JobEvent } from '@/lib/queries/jobs';
import { money, STATUS_TONE } from '../format';

interface TimelineCells {
  label: string;
  tone: StatusTone;
  detail?: string;
  qty?: number | null;
  who?: string | null;
}

function eventCells(e: JobEvent): TimelineCells {
  const machine = e.machine_id ? formatEntityId(e.machine_id) : '—';
  switch (e.event_type) {
    case 'job_created':
      return { label: 'Created', tone: 'info' };
    case 'job_started':
      return { label: 'Started', tone: 'info', detail: 'production started' };
    case 'tool_ready':
      return { label: 'Tool ready', tone: 'info', detail: e.tool_id ? formatEntityId(e.tool_id) : undefined };
    case 'cycle_completed':
      return {
        label: 'Cycle',
        tone: 'info',
        detail: `${machine} · ${e.tool_id ? formatEntityId(e.tool_id) : '—'} · ${e.cycle_time_seconds ?? '—'}s`,
        qty: e.quantity,
      };
    case 'inspection_passed':
      return {
        label: 'Passed',
        tone: 'ok',
        qty: e.quantity,
        who: e.inspector_id ? formatEntityId(e.inspector_id) : null,
      };
    case 'inspection_failed':
      return {
        label: 'Failed',
        tone: 'critical',
        detail: e.defect_code ? formatLabelLower(e.defect_code) : 'no defect code',
        qty: e.quantity,
        who: e.inspector_id ? formatEntityId(e.inspector_id) : null,
      };
    case 'material_lot_scan':
      return { label: 'Lot scan', tone: 'info', detail: e.lot_id ? formatEntityId(e.lot_id) : undefined };
    case 'job_blocked':
      return { label: 'Blocked', tone: 'critical', detail: e.reason ? formatLabelLower(e.reason) : 'unspecified' };
    case 'job_hold':
      return { label: 'Held', tone: 'warn', detail: e.reason ? formatLabelLower(e.reason) : 'unspecified' };
    case 'job_unblocked':
      return { label: 'Unblocked', tone: 'ok' };
    case 'job_completed':
      return {
        label: 'Completed',
        tone: 'ok',
        detail: `good ${e.good_quantity ?? 0} · scrap ${e.scrap_quantity ?? 0}`,
      };
    case 'shift_handoff':
      return {
        label: 'Handoff',
        tone: 'info',
        who: e.operator_id ? formatEntityId(e.operator_id) : null,
      };
    case 'maintenance_ping':
      return { label: 'Maintenance', tone: 'info', detail: machine };
    case 'sensor_glitch':
      return {
        label: 'Glitch',
        tone: 'warn',
        detail: `${e.signal ? `${formatLabelLower(e.signal)} · ` : ''}${machine}`,
      };
    default:
      return { label: e.event_type, tone: 'info' };
  }
}

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ jobId }, sp] = await Promise.all([params, searchParams]);
  const detail = await getJob(jobId);
  if (!detail) notFound();

  const { job, timeline, machines, tools, inspections, blocks, lot, lotCoverage } = detail;
  const facility = typeof sp.facility === 'string' ? sp.facility : undefined;
  const forward = facility ? `?facility=${facility}` : '';
  const newestFirst = sp.sort !== 'asc';
  const events = newestFirst ? [...timeline].reverse() : timeline;
  const sortHref =
    `/jobs/${job.job_id}?${new URLSearchParams({
      ...(facility ? { facility } : {}),
      ...(newestFirst ? { sort: 'asc' } : {}),
    }).toString()}`.replace(/\?$/, '') as Route;

  const yieldPct = job.has_completion
    ? Math.round((job.completed_quantity / Math.max(job.completed_quantity + job.scrap_quantity, 1)) * 100)
    : null;
  const openBlock =
    job.status === 'blocked' || job.status === 'held'
      ? blocks.filter((b) => b.event_type !== 'job_unblocked').at(-1)
      : undefined;

  return (
    <div className="flex flex-col gap-3">
      <PageTitle
        right={
          <span className="flex items-center gap-2">
            {job.completionEventCount > 1 && (
              <span
                className="font-mono text-[11px] text-accent-resin"
                title="Source history contains duplicate job_completed events; all raw events are preserved in the timeline below"
              >
                data quality: {job.completionEventCount}× job_completed in source
              </span>
            )}
            <StatusBadge tone={STATUS_TONE[job.status]} label={job.status.replace('_', ' ')} />
            {job.deliveryRisk === 'overdue' && <StatusBadge tone="critical" label="overdue" />}
          </span>
        }
      >
        Job <span className="font-mono">{formatJobId(job.job_id)}</span>
      </PageTitle>

      <div className="flex flex-col gap-1 font-mono text-[12.5px] text-text-secondary">
        <span>
          {formatEntityId(job.customer_id)} · {formatEntityId(job.part_id)} ·{' '}
          {formatFacility(job.facility_id)} · {formatLabel(job.material)} · {formatLabelLower(job.priority)}
        </span>
        <span>
          due{' '}
          <span className={job.deliveryRisk === 'overdue' ? 'text-status-critical' : ''}>
            {formatDate(job.due_date)}
          </span>
          {' '}· target {job.target_quantity}
          {job.has_completion && (
            <span>
              {' '}· good {job.completed_quantity} · scrap {job.scrap_quantity} · yield {yieldPct}%
            </span>
          )}
          {job.deliveryRisk === 'overdue' && job.valueAtRisk !== null && (
            <span> · {money(job.valueAtRisk)} est. value at risk</span>
          )}
        </span>
        {job.has_completion && (
          <PlyBar good={job.completed_quantity} scrap={job.scrap_quantity} total={job.target_quantity} className="max-w-md" />
        )}
        <span className="text-[11px] text-text-muted" title="Cycle activity is production context, never completion progress">
          activity {job.cycleCount} cycles · {job.cycleQuantity} qty (not completion progress)
          {job.lifecycle_event_id && <span> · state evidence {job.lifecycle_event_id}</span>}
          {' '}· as of {EVENT_HORIZON_DISPLAY}
        </span>
      </div>

      <div className="grid grid-cols-[2fr_1fr] items-start gap-3">
        <Panel
          padded={false}
          label="Event timeline"
          headerRight={
            <span className="flex items-center gap-3 font-mono text-[11px]">
              <span className="text-text-secondary">{timeline.length} events</span>
              <Link
                href={sortHref}
                className="text-text-muted underline decoration-border underline-offset-2 transition-colors duration-100 hover:text-text-secondary"
              >
                {newestFirst ? 'newest first ↓' : 'chronological ↑'}
              </Link>
            </span>
          }
        >
          <div className="flex flex-col px-2 py-1">
            <TimelineHeader />
            {events.map((e) => (
              <TimelineRow
                key={e.seq}
                timestamp={formatStamp(e.timestamp)}
                eventId={e.event_id}
                {...eventCells(e)}
              />
            ))}
          </div>
        </Panel>

        <div className="flex flex-col gap-3">
          <Panel label="Machines & tools" count={machines.length + tools.length}>
            {machines.length === 0 && tools.length === 0 ? (
              <span className="text-[12.5px] text-text-muted">No cycle events recorded.</span>
            ) : (
              <div className="flex flex-col gap-1.5">
                {machines.map((m) => (
                  <span key={m.machine_id} className="font-mono text-[12.5px]">
                    <Link
                      href={`/machines/${m.machine_id}${forward}` as Route}
                      className="text-text-primary underline decoration-border underline-offset-2 transition-colors duration-100 hover:decoration-text-secondary"
                    >
                      {formatEntityId(m.machine_id)}
                    </Link>
                    <span className="text-text-muted"> · {m.cycleCount} cycles</span>
                  </span>
                ))}
                {tools.map((t) => (
                  <span key={t} className="font-mono text-[12.5px] text-text-secondary">
                    {formatEntityId(t)} <span className="text-text-muted">· tool</span>
                  </span>
                ))}
                <span className="text-[11px] text-text-muted">
                  From this job&apos;s cycle_completed events.
                </span>
              </div>
            )}
          </Panel>

          <Panel label="Inspections" count={inspections.passCount + inspections.failCount}>
            {inspections.passCount + inspections.failCount === 0 ? (
              <span className="text-[12.5px] text-text-muted">No inspection events for this job.</span>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[12.5px] text-text-secondary">
                  {inspections.passQuantity} pass · {inspections.failQuantity} fail
                  <span className="text-text-muted">
                    {' '}({inspections.passCount}/{inspections.failCount} events)
                  </span>
                </span>
                {inspections.defects.length > 0 && (
                  <MiniPareto items={inspections.defects.map((d) => ({ label: d.code, count: d.count }))} />
                )}
                <span className="font-mono text-[11px] text-text-muted">
                  {inspections.inspectors.map(formatEntityId).join(' · ')}
                </span>
                <span className="text-[11px] text-text-muted">
                  In-process QC at stations QC 1/QC 2 — never attributed to production machines.
                </span>
              </div>
            )}
          </Panel>

          <Panel label="Blockers" count={blocks.length}>
            {blocks.length === 0 ? (
              <span className="text-[12.5px] text-text-muted">No block or hold events.</span>
            ) : (
              <div className="flex flex-col gap-1.5">
                {blocks.map((b) => (
                  <span key={b.event_id + b.timestamp} className="font-mono text-[12.5px] text-text-secondary">
                    {formatStamp(b.timestamp)} · {b.event_type}
                    {b.reason && <span> · {formatLabelLower(b.reason)}</span>}
                    <span className="text-text-muted"> · {b.event_id}</span>
                  </span>
                ))}
                {openBlock && (
                  <span className="text-[11px] text-status-critical">
                    Still open — no unblock has followed this event.
                  </span>
                )}
              </div>
            )}
          </Panel>

          <Panel label="Material lot">
            {lot ? (
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[12.5px] text-text-primary">
                  {formatEntityId(lot.lot_id)}
                  <span className="text-text-muted"> · {formatLabel(lot.material)}</span>
                </span>
                <span className="font-mono text-[11px] text-text-muted">
                  scanned {formatStamp(lot.scanned_at)} · {lot.event_id}
                </span>
                <DerivedBadge
                  provenance="observed"
                  caveat={`Lot-scanned data available for ${lotCoverage.scannedJobs} / ${lotCoverage.totalJobs} jobs`}
                />
              </div>
            ) : (
              <EmptyState
                message="No material_lot_scan event for this job."
                queryContext={`lot coverage ${lotCoverage.scannedJobs} / ${lotCoverage.totalJobs} jobs`}
                className="py-2"
              />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
