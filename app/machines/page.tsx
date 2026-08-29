import Link from 'next/link';
import type { Route } from 'next';
import { sql } from '@/lib/db';
import { EVENT_HORIZON_LABEL } from '@/lib/constants';
import { PageTitle } from '@/components/PageTitle';
import { Panel } from '@/components/Panel';
import { StatusBadge } from '@/components/StatusBadge';
import { Table, THead, Th, Tr, Td } from '@/components/Table';
import { listMachines } from '@/lib/queries/machines';

const nf = new Intl.NumberFormat('en-US');

export default async function MachinesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const facilityQs =
    sp.facility === 'la_01' || sp.facility === 'la_02' ? `?facility=${sp.facility}` : '';
  const machines = await listMachines(sql);

  return (
    <div className="flex max-w-6xl flex-col gap-3">
      <PageTitle
        right={<span className="font-mono text-[11px] text-text-muted">horizon {EVENT_HORIZON_LABEL}</span>}
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
                    {m.machine_id}
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
                  {m.medianCycleSeconds !== null ? `${nf.format(m.medianCycleSeconds)}s` : '—'}
                </Td>
                <Td numeric>
                  {m.fleetMedianSeconds !== null ? `${nf.format(m.fleetMedianSeconds)}s` : '—'}
                </Td>
                <Td numeric>
                  {m.cycleTimeDriftPct !== null
                    ? `${m.cycleTimeDriftPct > 0 ? '+' : ''}${Math.round(m.cycleTimeDriftPct)}%`
                    : '—'}
                </Td>
                <Td mono>{m.lastEventAt?.slice(0, 10) ?? '—'}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      <span className="text-[11px] text-text-muted">
        Timing from completed production cycles. QC stations qc_01/qc_02 are not production
        machines; their inspections attribute to presses only via the derived Job → Cycle
        association.
      </span>
    </div>
  );
}
