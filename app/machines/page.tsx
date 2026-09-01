import Link from 'next/link';
import type { Route } from 'next';
import { sql } from '@/lib/db';
import {
  EVENT_HORIZON_DISPLAY,
  formatDate,
  formatEntityId,
  formatFacility,
  formatMinutes,
} from '@/lib/display';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/PageTitle';
import { Panel } from '@/components/Panel';
import { StatusBadge } from '@/components/StatusBadge';
import { Table, THead, Th, Tr, Td } from '@/components/Table';
import { listMachines } from '@/lib/queries/machines';
import { machineLabel } from '@/lib/present';
import { Sparkline } from '@/app/overview-charts';

const nf = new Intl.NumberFormat('en-US');

const TONE_COLOR: Record<string, string> = {
  ok: 'var(--color-text-muted)',
  warn: 'var(--color-status-warn)',
  critical: 'var(--color-status-critical)',
  info: 'var(--color-status-info)',
};

export default async function MachinesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const facility = sp.facility === 'la_01' || sp.facility === 'la_02' ? sp.facility : undefined;
  const machines = await listMachines(sql, facility);

  return (
    <div className="flex max-w-6xl flex-col gap-3">
      <PageTitle
        right={<span className="font-mono text-[11px] text-text-muted">as of {EVENT_HORIZON_DISPLAY}</span>}
      >
        Machines
      </PageTitle>
      <Panel
        label="Production presses"
        count={
          facility ? `${machines.length} in ${formatFacility(facility)}` : `${machines.length} presses`
        }
        padded={false}
      >
        {machines.length === 0 ? (
          <EmptyState
            message="No presses recorded activity here."
            queryContext={`facility=${facility ?? 'all'}`}
          />
        ) : (
        <Table>
          <THead>
            <tr>
              <Th>Machine</Th>
              <Th>Facility</Th>
              <Th>State</Th>
              <Th numeric>Cycles</Th>
              <Th numeric>Median cycle</Th>
              <Th numeric>Fleet median</Th>
              <Th numeric>Drift</Th>
              <Th>Trend</Th>
              <Th>Last event</Th>
            </tr>
          </THead>
          <tbody>
            {machines.map((m) => (
              <Tr key={`${m.machine_id}-${m.facility_id}`}>
                <Td mono>
                  <Link
                    href={`/machines/${m.machine_id}?facility=${m.facility_id}` as Route}
                    className="text-accent hover:underline"
                  >
                    {formatEntityId(m.machine_id)}
                  </Link>
                </Td>
                <Td>
                  <span className="rounded-sm bg-bg-inset px-1.5 py-0.5 font-mono text-[11px] text-text-secondary">
                    {formatFacility(m.facility_id)}
                  </span>
                </Td>
                <Td>
                  <StatusBadge
                    tone={m.statusTone}
                    label={
                      m.statusTone === 'critical'
                        ? 'cycle-time alert'
                        : m.statusTone === 'info'
                          ? 'recovered'
                          : 'nominal'
                    }
                  />
                </Td>
                <Td numeric>{nf.format(m.cycleCount)}</Td>
                <Td numeric>
                  {m.medianCycleSeconds !== null ? formatMinutes(m.medianCycleSeconds) : '—'}
                </Td>
                <Td numeric>
                  {m.fleetMedianSeconds !== null ? formatMinutes(m.fleetMedianSeconds) : '—'}
                </Td>
                <Td numeric>
                  {m.cycleTimeDriftPct !== null
                    ? `${m.cycleTimeDriftPct > 0 ? '+' : ''}${Math.round(m.cycleTimeDriftPct)}%`
                    : '—'}
                </Td>
                <Td>
                  {(m.weeklyMedians ?? []).length > 1 && (
                    <Sparkline values={m.weeklyMedians!} stroke={TONE_COLOR[m.statusTone]} />
                  )}
                </Td>
                <Td mono>{m.lastEventAt ? formatDate(m.lastEventAt) : '—'}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        )}
      </Panel>
      <span className="text-[11px] text-text-muted">
        {'Press ids repeat across facilities — Press 1 in LA 1 and Press 1 in LA 2 are different physical presses, so every stat here covers one press at one facility. Fleet median compares against the other presses in the same facility. '}
        Timing from completed production cycles. QC stations QC 1/QC 2 are not production
        machines; their inspections attribute to presses only via the derived Job → Cycle
        association.
      </span>
    </div>
  );
}
