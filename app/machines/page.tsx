import Link from 'next/link';
import type { Route } from 'next';
import { sql } from '@/lib/db';
import { EVENT_HORIZON_DISPLAY, formatDate, formatEntityId, formatMinutes } from '@/lib/display';
import { PageTitle } from '@/components/PageTitle';
import { Panel } from '@/components/Panel';
import { StatusBadge } from '@/components/StatusBadge';
import { Table, THead, Th, Tr, Td } from '@/components/Table';
import { listMachines } from '@/lib/queries/machines';
import { getMachineStrip } from '@/lib/queries/overview';
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
  const facilityQs =
    sp.facility === 'la_01' || sp.facility === 'la_02' ? `?facility=${sp.facility}` : '';
  const [machines, strip] = await Promise.all([listMachines(sql), getMachineStrip(sql)]);
  const weeklies = new Map(strip.map((s) => [s.machine_id, s.weeklyMedians]));

  return (
    <div className="flex max-w-6xl flex-col gap-3">
      <PageTitle
        right={<span className="font-mono text-[11px] text-text-muted">as of {EVENT_HORIZON_DISPLAY}</span>}
      >
        Machines
      </PageTitle>
      <Panel label="Production presses" count={machines.length} padded={false}>
        <Table>
          <THead>
            <tr>
              <Th>Machine</Th>
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
              <Tr key={m.machine_id}>
                <Td mono>
                  <Link
                    href={`/machines/${m.machine_id}${facilityQs}` as Route}
                    className="text-accent hover:underline"
                  >
                    {formatEntityId(m.machine_id)}
                  </Link>
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
                  {(weeklies.get(m.machine_id) ?? []).length > 1 && (
                    <Sparkline
                      values={weeklies.get(m.machine_id)!}
                      stroke={TONE_COLOR[m.statusTone]}
                    />
                  )}
                </Td>
                <Td mono>{m.lastEventAt ? formatDate(m.lastEventAt) : '—'}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      <span className="text-[11px] text-text-muted">
        Timing from completed production cycles. QC stations QC 1/QC 2 are not production
        machines; their inspections attribute to presses only via the derived Job → Cycle
        association.
      </span>
    </div>
  );
}
