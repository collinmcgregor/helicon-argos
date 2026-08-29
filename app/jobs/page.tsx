import Link from 'next/link';
import type { Route } from 'next';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/PageTitle';
import { Panel } from '@/components/Panel';
import { StatusBadge } from '@/components/StatusBadge';
import { Table, THead, Th, Tr, Td } from '@/components/Table';
import { EVENT_HORIZON_LABEL } from '@/lib/constants';
import {
  listCustomers,
  listJobs,
  type ExplorerStatus,
  type JobListItem,
  type JobsFilter,
} from '@/lib/queries/jobs';
import { JobsFilterBar } from './filters';
import { money, STATUS_TONE } from './format';

const EXPLORER_STATUSES = new Set<ExplorerStatus>([
  'created',
  'in_progress',
  'blocked',
  'held',
  'completed',
  'active',
  'blocked-held',
]);

function parseFilter(params: Record<string, string | string[] | undefined>): JobsFilter {
  const one = (k: string) => (typeof params[k] === 'string' ? (params[k] as string) : undefined);
  const facility = one('facility');
  const status = one('status') as ExplorerStatus | undefined;
  return {
    facility: facility === 'la_01' || facility === 'la_02' ? facility : undefined,
    status: status && EXPLORER_STATUSES.has(status) ? status : undefined,
    customer: one('customer'),
    risk: one('risk') === 'overdue' ? 'overdue' : undefined,
    reason: one('reason'),
  };
}

function pageTitle(filter: JobsFilter): string {
  if (filter.risk === 'overdue') return 'Overdue incomplete jobs';
  if (filter.reason) return `Jobs blocked: ${filter.reason}`;
  switch (filter.status) {
    case 'blocked-held':
      return 'Blocked / held jobs';
    case 'active':
      return 'Active jobs';
    case undefined:
      return 'Jobs';
    default:
      return `${filter.status.replace('_', ' ')} jobs`;
  }
}

function riskCell(job: JobListItem): string {
  const parts: string[] = [];
  if (job.deliveryRisk === 'overdue') {
    parts.push('overdue');
    if (job.valueAtRisk !== null) parts.push(money(job.valueAtRisk));
  }
  if (job.block_reason) parts.push(job.block_reason);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filter = parseFilter(params);
  const [jobs, customers] = await Promise.all([listJobs(filter), listCustomers()]);

  const filtered = Boolean(
    filter.status || filter.customer || filter.risk || filter.reason || filter.facility,
  );
  const echo = [
    filter.facility && `facility=${filter.facility}`,
    filter.status && `status=${filter.status}`,
    filter.customer && `customer=${filter.customer}`,
    filter.risk && `risk=${filter.risk}`,
    filter.reason && `reason=${filter.reason}`,
  ].filter(Boolean);
  const clearHref = (filter.facility ? `/jobs?facility=${filter.facility}` : '/jobs') as Route;
  const forward = filter.facility ? `?facility=${filter.facility}` : '';

  const atRiskValue = jobs.reduce((sum, j) => sum + (j.valueAtRisk ?? 0), 0);
  const priced = jobs.filter((j) => j.unit_price_estimate !== null).length;

  return (
    <div className="flex flex-col gap-3">
      <PageTitle
        right={
          <span className="font-mono text-[11px] text-text-muted">horizon {EVENT_HORIZON_LABEL}</span>
        }
      >
        {pageTitle(filter)}
      </PageTitle>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[12.5px] text-text-secondary">
          {jobs.length} jobs
          {echo.length > 0 && <span className="text-text-muted"> · {echo.join(' · ')}</span>}
          {atRiskValue > 0 && (
            <span>
              {' '}
              · {money(atRiskValue)} est. value at risk
              <span className="text-text-muted"> (unit-price coverage {priced}/{jobs.length} listed jobs)</span>
            </span>
          )}
        </span>
        {filtered && (
          <Link
            href={clearHref}
            className="font-mono text-[11px] text-text-secondary underline decoration-border underline-offset-2 transition-colors duration-100 hover:text-text-primary"
          >
            Clear filters
          </Link>
        )}
      </div>

      <JobsFilterBar customers={customers} />

      <Panel padded={false} label="jobs_current" count={jobs.length}>
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center">
            <EmptyState
              message="No jobs match the applied filters."
              queryContext={echo.join(' · ') || 'no filters'}
            />
            <Link href={clearHref} className="mb-6 font-mono text-[11px] text-text-secondary underline decoration-border underline-offset-2">
              Clear filters
            </Link>
          </div>
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Status</Th>
                <Th>Job</Th>
                <Th>Customer / Part</Th>
                <Th>Due</Th>
                <Th numeric>Outcome</Th>
                <Th numeric>Activity</Th>
                <Th>Risk / reason</Th>
              </tr>
            </THead>
            <tbody>
              {jobs.map((job) => {
                const yieldPct = job.has_completion
                  ? Math.round(
                      (job.completed_quantity / Math.max(job.completed_quantity + job.scrap_quantity, 1)) * 100,
                    )
                  : null;
                return (
                  <Tr key={job.job_id} className="align-top">
                    <Td className="py-2">
                      <StatusBadge tone={STATUS_TONE[job.status]} label={job.status.replace('_', ' ')} />
                    </Td>
                    <Td className="py-2">
                      <Link
                        href={`/jobs/${job.job_id}${forward}` as Route}
                        className="font-mono text-[12.5px] text-text-primary underline decoration-border underline-offset-2 transition-colors duration-100 hover:decoration-text-secondary"
                      >
                        {job.job_id}
                      </Link>
                      <div className="font-mono text-[11px] text-text-muted">
                        {job.facility_id} · {job.material}
                        {job.completionEventCount > 1 && (
                          <span
                            className="text-accent-resin"
                            title={`Source history contains ${job.completionEventCount} job_completed events — see the raw timeline`}
                          >
                            {' '}
                            · {job.completionEventCount}× completion
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td mono className="py-2 text-text-secondary">
                      {job.customer_id} · {job.part_id}
                    </Td>
                    <Td mono className="py-2">
                      <span className={job.deliveryRisk === 'overdue' ? 'text-status-critical' : 'text-text-secondary'}>
                        {job.due_date}
                      </span>
                    </Td>
                    <Td numeric className="py-2 text-text-secondary">
                      {job.has_completion
                        ? `${job.completed_quantity} good · ${job.scrap_quantity} scrap · ${yieldPct}%`
                        : '—'}
                    </Td>
                    <Td numeric className="py-2 text-text-secondary" title="Production activity — not completion progress">
                      {job.cycleCount > 0 ? `${job.cycleCount} cyc · ${job.cycleQuantity} qty` : '—'}
                    </Td>
                    <Td mono className="py-2 text-text-secondary">
                      {riskCell(job)}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
