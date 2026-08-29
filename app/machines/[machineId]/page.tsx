import Link from 'next/link';
import type { Route } from 'next';
import { sql } from '@/lib/db';
import { EVENT_HORIZON_LABEL } from '@/lib/constants';
import type { FacilityId, StatusTone } from '@/lib/types';
import { DerivedBadge } from '@/components/DerivedBadge';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/PageTitle';
import { Panel } from '@/components/Panel';
import { StatusBadge } from '@/components/StatusBadge';
import { Table, THead, Th, Tr, Td } from '@/components/Table';
import { TimelineRow } from '@/components/TimelineRow';
import {
  getAffectedJobs,
  getEvidenceLog,
  getFleetAttribution,
  getMachine,
  getQualityAttribution,
  getRecoveredIncident,
  getWeeklyCycleTrend,
  parseTrendWindow,
  type TrendWindow,
} from '@/lib/queries/machines';
import { CycleTrendChart } from './CycleTrendChart';

const nf = new Intl.NumberFormat('en-US');
const WINDOWS: TrendWindow[] = ['2w', '4w', 'all'];

const ALERT_LABEL: Record<StatusTone, string> = {
  critical: 'cycle-time alert',
  warn: 'cycle-time alert',
  info: 'recovered incident',
  ok: 'nominal',
};

const RISK_TONE = { overdue: 'critical', at_risk: 'warn', on_track: 'ok' } as const;
const STATUS_TONE: Record<string, StatusTone> = {
  blocked: 'critical',
  held: 'warn',
  in_progress: 'info',
  created: 'info',
  completed: 'ok',
};

export default async function MachineDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ machineId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { machineId } = await params;
  const sp = await searchParams;
  const window = parseTrendWindow(sp.window);
  const facility: FacilityId | undefined =
    sp.facility === 'la_01' || sp.facility === 'la_02' ? sp.facility : undefined;
  const facilityQs = facility ? `&facility=${facility}` : '';

  const machine = await getMachine(sql, machineId);
  if (!machine) {
    return (
      <div className="flex max-w-6xl flex-col gap-3">
        <PageTitle>{machineId}</PageTitle>
        <Panel>
          <EmptyState
            message={`No production machine "${machineId}" — production presses are press_01 … press_06.`}
            queryContext={`qc_01/qc_02 are QC stations, not machines · horizon ${EVENT_HORIZON_LABEL}`}
          />
          <div className="flex justify-center pb-2">
            <Link href="/machines" className="text-[13px] text-accent hover:underline">
              All machines
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

  const [trend, incident, attribution, fleetAttribution, jobs, evidence] = await Promise.all([
    getWeeklyCycleTrend(sql, machineId, window),
    getRecoveredIncident(sql, machineId),
    getQualityAttribution(sql, machineId),
    getFleetAttribution(sql),
    getAffectedJobs(sql, machineId, facility),
    getEvidenceLog(sql, machineId),
  ]);

  const headline = [
    machine.pctAboveFleet !== null
      ? `${machine.pctAboveFleet}% above the ${nf.format(machine.fleetBandLowSeconds ?? 0)}–${nf.format(machine.fleetBandHighSeconds ?? 0)}s fleet band`
      : null,
    machine.cycleTimeDriftPct !== null && machine.cycleTimeDriftPct > 1
      ? `rising trend (+${machine.cycleTimeDriftPct}% first → second half)`
      : null,
    machine.maintenanceCount === 0
      ? 'no maintenance recorded'
      : `${machine.maintenanceCount} maintenance event${machine.maintenanceCount === 1 ? '' : 's'}`,
  ].filter((s): s is string => s !== null);

  const fleetRates = fleetAttribution.map((r) => r.failRatePct);
  const median = machine.medianCycleSeconds;

  return (
    <div className="flex max-w-6xl flex-col gap-3">
      <PageTitle
        right={
          <div className="flex items-center gap-3">
            <StatusBadge tone={machine.statusTone} label={ALERT_LABEL[machine.statusTone]} />
            <span className="font-mono text-[11px] text-text-muted">horizon {EVENT_HORIZON_LABEL}</span>
          </div>
        }
      >
        {machine.machine_id}
      </PageTitle>

      <div className="flex flex-col gap-1">
        <span className="font-mono text-[12.5px] text-text-secondary">
          {machine.facility_id} · {nf.format(machine.cycleCount)} cycles ·{' '}
          {nf.format(machine.jobCount)} jobs · median{' '}
          {median !== null ? `${nf.format(median)}s` : '—'}
        </span>
        {headline.length > 0 && (
          <span className="text-[13px] text-text-secondary">{headline.join(' · ')}</span>
        )}
        {incident && (
          <span className="text-[13px] text-text-secondary">
            <span className="text-status-warn">{String(incident.sensorEvent.metadata.signal ?? 'sensor')}</span>{' '}
            sensor_glitch{' '}
            <span className="font-mono text-[12.5px]">{incident.sensorEvent.event_id}</span> (
            {incident.sensorEvent.timestamp.slice(0, 10)}) and maintenance_ping{' '}
            <span className="font-mono text-[12.5px]">{incident.maintenanceEvent.event_id}</span> (
            {incident.maintenanceEvent.timestamp.slice(0, 10)}) were followed by a weekly-median
            spike {nf.format(incident.baselineMedianSeconds)}s →{' '}
            {nf.format(incident.spikeMedianSeconds)}s, then recovery to{' '}
            {nf.format(incident.recoveredMedianSeconds)}s. Sequence, not proven cause.
          </span>
        )}
      </div>

      <Panel
        label="Cycle-time trend · weekly median"
        headerRight={
          <span className="flex items-center gap-1 font-mono text-[11px]">
            {WINDOWS.map((w) => (
              <Link
                key={w}
                href={`/machines/${machineId}?window=${w}${facilityQs}` as Route}
                className={`px-1.5 py-0.5 transition-colors duration-100 ${
                  w === window
                    ? 'bg-bg-3 text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {w}
              </Link>
            ))}
          </span>
        }
      >
        {trend.length > 0 ? (
          <CycleTrendChart machineId={machineId} points={trend} incident={incident} />
        ) : (
          <EmptyState
            message="No cycles in the selected window."
            queryContext={`window=${window}`}
          />
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel label="Evidence log" count={evidence.length} padded={false}>
          <div className="max-h-[320px] overflow-y-auto px-4">
            {evidence.map((e, i) => (
              <TimelineRow
                key={`${e.event_id}-${i}`}
                timestamp={e.timestamp.slice(0, 19).replace('T', ' ')}
                eventType={e.event_type}
                eventId={e.event_id}
                tone={
                  e.event_type === 'sensor_glitch'
                    ? 'warn'
                    : e.event_type === 'maintenance_ping'
                      ? 'info'
                      : median !== null && Number(e.metadata.cycle_time_seconds) > median * 1.25
                        ? 'warn'
                        : 'ok'
                }
              >
                {e.event_type === 'cycle_completed'
                  ? `${e.job_id} · qty ${e.metadata.quantity ?? '—'} · ${nf.format(Number(e.metadata.cycle_time_seconds))}s`
                  : e.event_type === 'sensor_glitch'
                    ? `${e.metadata.signal ?? 'sensor'} signal glitch`
                    : 'maintenance ping'}
              </TimelineRow>
            ))}
          </div>
        </Panel>

        <Panel label="Affected work" count={jobs.length} padded={false}>
          {jobs.length === 0 ? (
            <EmptyState
              message="No jobs ran cycles on this machine under the current facility filter."
              queryContext={facility ? `facility=${facility}` : undefined}
            />
          ) : (
            <div className="max-h-[320px] overflow-y-auto">
              <Table>
                <THead>
                  <tr>
                    <Th>Job</Th>
                    <Th>Status</Th>
                    <Th>Risk</Th>
                    <Th>Due</Th>
                    <Th numeric>Value at risk</Th>
                  </tr>
                </THead>
                <tbody>
                  {jobs.map((j) => (
                    <Tr key={j.job_id}>
                      <Td mono>
                        <Link
                          href={`/jobs/${j.job_id}${facility ? `?facility=${facility}` : ''}` as Route}
                          className="text-accent hover:underline"
                        >
                          {j.job_id}
                        </Link>
                      </Td>
                      <Td>
                        <StatusBadge tone={STATUS_TONE[j.status] ?? 'info'} label={j.status} />
                      </Td>
                      <Td>
                        <StatusBadge tone={RISK_TONE[j.deliveryRisk]} label={j.deliveryRisk} />
                      </Td>
                      <Td mono className="whitespace-nowrap">{j.due_date.slice(0, 10) || '—'}</Td>
                      <Td numeric>
                        {j.valueAtRisk !== null ? `$${nf.format(Math.round(j.valueAtRisk))}` : '—'}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Panel>
      </div>

      {attribution && (
        <Panel
          label="Quality attribution"
          headerRight={<DerivedBadge provenance="derived" caveat="from Job → Cycle association" />}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[28px] font-medium leading-8 text-text-primary">
                {Math.round(attribution.failRatePct)}%
              </span>
              <span className="text-[13px] text-text-secondary">
                attributed inspection-failure rate ({attribution.failRatePct}%) — in line with the
                fleet (flat {Math.min(...fleetRates)}–{Math.max(...fleetRates)}% across all six
                presses)
              </span>
            </div>
            <span className="text-[11px] text-text-muted">{attribution.method}</span>
            <div className="flex flex-wrap items-center gap-1">
              <span className="pr-1 font-mono text-[11px] text-text-muted">
                {nf.format(attribution.failedEvents)}/{nf.format(attribution.inspectionEvents)}{' '}
                failed inspection events · latest evidence:
              </span>
              {attribution.supportingEventIds.map((id) => (
                <span
                  key={id}
                  className="rounded-sm bg-bg-inset px-1.5 py-0.5 font-mono text-[12.5px] text-text-secondary"
                >
                  {id}
                </span>
              ))}
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
