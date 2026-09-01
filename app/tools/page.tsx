import Link from 'next/link';
import type { Route } from 'next';
import { sql } from '@/lib/db';
import { EVENT_HORIZON_DISPLAY, formatDate, formatEntityId, formatMinutes } from '@/lib/display';
import { PageTitle } from '@/components/PageTitle';
import { Panel } from '@/components/Panel';
import { Table, THead, Th, Tr, Td } from '@/components/Table';
import { listTools } from '@/lib/queries/tools';
import { unstable_cache } from 'next/cache';

const cached = <T,>(key: string, f: () => Promise<T>) =>
  unstable_cache(f, [key], { revalidate: false })();

const nf = new Intl.NumberFormat('en-US');

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const facilityQs =
    sp.facility === 'la_01' || sp.facility === 'la_02' ? `?facility=${sp.facility}` : '';
  const tools = await cached('tools-list', () => listTools(sql));

  return (
    <div className="flex max-w-6xl flex-col gap-3">
      <PageTitle
        right={<span className="font-mono text-[11px] text-text-muted">as of {EVENT_HORIZON_DISPLAY}</span>}
      >
        Tools
      </PageTitle>
      <Panel label="Layup / press tooling" count={tools.length} padded={false}>
        <Table>
          <THead>
            <tr>
              <Th>Tool</Th>
              <Th numeric>Cycles</Th>
              <Th numeric>Jobs</Th>
              <Th>Presses used on</Th>
              <Th numeric>Median cycle</Th>
              <Th numeric>Qty produced</Th>
              <Th>Last used</Th>
            </tr>
          </THead>
          <tbody>
            {tools.map((t) => (
              <Tr key={t.tool_id}>
                <Td mono>
                  <Link
                    href={`/tools/${t.tool_id}${facilityQs}` as Route}
                    className="text-accent hover:underline"
                  >
                    {formatEntityId(t.tool_id)}
                  </Link>
                </Td>
                <Td numeric>{nf.format(t.cycleCount)}</Td>
                <Td numeric>{t.jobCount}</Td>
                <Td mono className="text-text-secondary">
                  {t.machines.map(formatEntityId).join(' · ')}
                </Td>
                <Td numeric>{formatMinutes(t.medianCycleSeconds)}</Td>
                <Td numeric>{nf.format(t.totalQuantity)}</Td>
                <Td mono>{formatDate(t.lastUsed)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      <span className="text-[11px] text-text-muted">
        Observed from cycle_completed events — a tool&apos;s cycles, jobs, and presses come from the
        raw production log.
      </span>
    </div>
  );
}
