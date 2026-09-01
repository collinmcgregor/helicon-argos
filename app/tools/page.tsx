import Link from 'next/link';
import type { Route } from 'next';
import { sql } from '@/lib/db';
import { EVENT_HORIZON_DISPLAY, formatDate, formatEntityId, formatMinutes } from '@/lib/display';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/PageTitle';
import { Panel } from '@/components/Panel';
import { Table, THead, Th, Tr, Td } from '@/components/Table';
import { listTools, type ToolListItem } from '@/lib/queries/tools';
import { ToolsFilterBar } from './filters';
import { unstable_cache } from 'next/cache';

const cached = <T,>(key: string, f: () => Promise<T>) =>
  unstable_cache(f, [key], { revalidate: false })();

const nf = new Intl.NumberFormat('en-US');

type SortKey = 'tool' | 'cycles' | 'jobs' | 'median' | 'qty' | 'last';

const SORT_VALUE: Record<SortKey, (t: ToolListItem) => string | number> = {
  tool: (t) => t.tool_id,
  cycles: (t) => t.cycleCount,
  jobs: (t) => t.jobCount,
  median: (t) => t.medianCycleSeconds,
  qty: (t) => t.totalQuantity,
  last: (t) => t.lastUsed,
};

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const press = typeof sp.press === 'string' && /^press_\d+$/.test(sp.press) ? sp.press : undefined;
  const sort: SortKey = (
    ['tool', 'cycles', 'jobs', 'median', 'qty', 'last'] as const
  ).includes(sp.sort as SortKey)
    ? (sp.sort as SortKey)
    : 'cycles';
  // each key has a natural reading order; dir=flip inverts it
  const defaultDesc = sort !== 'tool';
  const desc = sp.dir === 'flip' ? !defaultDesc : defaultDesc;

  const all = await cached('tools-list', () => listTools(sql));
  const presses = [...new Set(all.flatMap((t) => t.machines))].sort();

  const tools = all
    .filter((t) => !press || t.machines.includes(press))
    .sort((a, b) => {
      const va = SORT_VALUE[sort](a);
      const vb = SORT_VALUE[sort](b);
      const cmp = typeof va === 'number' ? va - (vb as number) : String(va).localeCompare(String(vb));
      return desc ? -cmp : cmp;
    });

  const sortHref = (key: SortKey) => {
    const params = new URLSearchParams();
    if (press) params.set('press', press);
    if (key !== 'cycles') params.set('sort', key);
    if (key === sort && sp.dir !== 'flip') params.set('dir', 'flip');
    const qs = params.toString();
    return `/tools${qs ? `?${qs}` : ''}` as Route;
  };

  const SortTh = ({ k, children, numeric }: { k: SortKey; children: string; numeric?: boolean }) => (
    <Th numeric={numeric}>
      <Link
        href={sortHref(k)}
        className={`hover:text-text-primary ${k === sort ? 'text-text-primary' : ''}`}
      >
        {children}
        {k === sort && <span className="ml-1">{desc ? '↓' : '↑'}</span>}
      </Link>
    </Th>
  );

  return (
    <div className="flex max-w-6xl flex-col gap-3">
      <PageTitle
        right={<span className="font-mono text-[11px] text-text-muted">as of {EVENT_HORIZON_DISPLAY}</span>}
      >
        Tools
      </PageTitle>
      <ToolsFilterBar presses={presses} />
      <Panel
        label="Layup / press tooling"
        count={press ? `${tools.length} of ${all.length} · ${formatEntityId(press)}` : tools.length}
        padded={false}
      >
        {tools.length === 0 ? (
          <EmptyState
            message="No tools ran on this press."
            queryContext={`press=${press ?? 'all'}`}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <SortTh k="tool">Tool</SortTh>
                <SortTh k="cycles" numeric>Cycles</SortTh>
                <SortTh k="jobs" numeric>Jobs</SortTh>
                <Th>Presses used on</Th>
                <SortTh k="median" numeric>Median cycle</SortTh>
                <SortTh k="qty" numeric>Qty produced</SortTh>
                <SortTh k="last">Last used</SortTh>
              </tr>
            </THead>
            <tbody>
              {tools.map((t) => (
                <Tr key={t.tool_id}>
                  <Td mono>
                    <Link href={`/tools/${t.tool_id}` as Route} className="text-accent hover:underline">
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
        )}
      </Panel>
      <span className="text-[11px] text-text-muted">
        Observed from cycle_completed events — a tool&apos;s cycles, jobs, and presses come from the
        raw production log. Click a column to sort; click again to reverse.
      </span>
    </div>
  );
}
