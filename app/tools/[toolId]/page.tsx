import Link from 'next/link';
import type { Route } from 'next';
import { sql } from '@/lib/db';
import {
  EVENT_HORIZON_DISPLAY,
  formatDate,
  formatEntityId,
  formatJobId,
  formatMinutes,
  formatStamp,
} from '@/lib/display';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/PageTitle';
import { Panel } from '@/components/Panel';
import { StatusBadge } from '@/components/StatusBadge';
import { Table, THead, Th, Tr, Td } from '@/components/Table';
import { getTool } from '@/lib/queries/tools';
import { STATUS_TONE } from '../../jobs/format';
import { unstable_cache } from 'next/cache';

const cached = <T,>(key: string, f: () => Promise<T>) =>
  unstable_cache(f, [key], { revalidate: false })();

const nf = new Intl.NumberFormat('en-US');

export default async function ToolDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ toolId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ toolId }, sp] = await Promise.all([params, searchParams]);
  const forward =
    sp.facility === 'la_01' || sp.facility === 'la_02' ? `?facility=${sp.facility}` : '';
  const tool = await cached(`tool-${toolId}`, () => getTool(sql, toolId));

  if (!tool) {
    return (
      <div className="flex max-w-6xl flex-col gap-3">
        <PageTitle>{formatEntityId(toolId)}</PageTitle>
        <Panel>
          <EmptyState
            message={`No cycles recorded for "${toolId}".`}
            queryContext={`as of ${EVENT_HORIZON_DISPLAY}`}
          />
          <div className="flex justify-center pb-2">
            <Link href="/tools" className="text-[13px] text-accent hover:underline">
              All tools
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="flex max-w-6xl flex-col gap-3">
      <PageTitle
        right={<span className="font-mono text-[11px] text-text-muted">as of {EVENT_HORIZON_DISPLAY}</span>}
      >
        {formatEntityId(tool.tool_id)}
      </PageTitle>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="border border-border bg-bg-2 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Cycles</div>
          <div className="mt-1 font-mono text-[22px] font-medium text-text-primary">
            {nf.format(tool.cycleCount)}
          </div>
          <div className="text-[11px] text-text-secondary">{nf.format(tool.totalQuantity)} units produced</div>
        </div>
        <div className="border border-border bg-bg-2 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Median cycle</div>
          <div className="mt-1 font-mono text-[22px] font-medium text-text-primary">
            {formatMinutes(tool.medianCycleSeconds)}
          </div>
          <div className="text-[11px] text-text-secondary">across all presses it ran on</div>
        </div>
        <div className="border border-border bg-bg-2 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Jobs</div>
          <div className="mt-1 font-mono text-[22px] font-medium text-text-primary">{tool.jobCount}</div>
          <div className="text-[11px] text-text-secondary">{tool.readyEventCount} tool_ready events</div>
        </div>
        <div className="border border-border bg-bg-2 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">In service</div>
          <div className="mt-1 font-mono text-[16px] font-medium leading-8 text-text-primary">
            {formatDate(tool.firstUsed)} – {formatDate(tool.lastUsed)}
          </div>
          <div className="text-[11px] text-text-secondary">first to latest recorded cycle</div>
        </div>
        <div className="col-span-2 font-mono text-[12.5px] text-text-secondary lg:col-span-4">
          Runs on{' '}
          {tool.machines.map((m, i) => (
            <span key={m.machine_id}>
              {i > 0 && ' · '}
              <Link
                href={`/machines/${m.machine_id}${forward}` as Route}
                className="text-accent hover:underline"
              >
                {formatEntityId(m.machine_id)}
              </Link>
              <span className="text-text-muted"> ({nf.format(m.cycleCount)} cycles)</span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel label="Jobs run with this tool" count={tool.jobs.length} padded={false}>
          <div className="max-h-[360px] overflow-y-auto">
            <Table>
              <THead>
                <tr>
                  <Th>Job</Th>
                  <Th>Status</Th>
                  <Th numeric>Cycles</Th>
                  <Th numeric>Qty</Th>
                </tr>
              </THead>
              <tbody>
                {tool.jobs.map((j) => (
                  <Tr key={j.job_id}>
                    <Td mono>
                      <Link href={`/jobs/${j.job_id}${forward}` as Route} className="text-accent hover:underline">
                        {formatJobId(j.job_id)}
                      </Link>
                    </Td>
                    <Td>
                      <span className="flex items-center gap-1.5">
                        <StatusBadge tone={STATUS_TONE[j.status]} label={j.status.replace('_', ' ')} />
                        {j.overdue && <StatusBadge tone="critical" label="overdue" />}
                      </span>
                    </Td>
                    <Td numeric>{j.cycleCount}</Td>
                    <Td numeric>{nf.format(j.quantity)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Panel>

        <Panel
          label="Recent cycles"
          headerRight={
            <span className="font-mono text-[12.5px] text-text-secondary">
              latest {tool.recentCycles.length} of {nf.format(tool.cycleCount)}
            </span>
          }
          padded={false}
        >
          <div className="max-h-[360px] overflow-y-auto">
            <Table>
              <THead>
                <tr>
                  <Th>Time</Th>
                  <Th>Press</Th>
                  <Th>Job</Th>
                  <Th numeric>Qty</Th>
                  <Th numeric>Cycle time</Th>
                  <Th>Source ID</Th>
                </tr>
              </THead>
              <tbody>
                {tool.recentCycles.map((c) => (
                  <Tr key={c.event_id}>
                    <Td mono className="whitespace-nowrap">{formatStamp(c.timestamp)}</Td>
                    <Td mono>
                      {c.machine_id ? (
                        <Link
                          href={`/machines/${c.machine_id}${forward}` as Route}
                          className="text-accent hover:underline"
                        >
                          {formatEntityId(c.machine_id)}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td mono>
                      {c.job_id ? (
                        <Link href={`/jobs/${c.job_id}${forward}` as Route} className="text-accent hover:underline">
                          {formatJobId(c.job_id)}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td numeric>{c.quantity}</Td>
                    <Td numeric>{formatMinutes(c.cycle_time_seconds)}</Td>
                    <Td mono className="whitespace-nowrap text-text-muted">{c.event_id}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
