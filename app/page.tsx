import Link from 'next/link';
import type { Route } from 'next';
import { AlertRow } from '@/components/AlertRow';
import { AngleGlyph } from '@/components/AngleGlyph';
import { DerivedBadge } from '@/components/DerivedBadge';
import { EmptyState } from '@/components/EmptyState';
import { KpiTile } from '@/components/KpiTile';
import { MiniPareto } from '@/components/MiniPareto';
import { PageTitle } from '@/components/PageTitle';
import { Panel } from '@/components/Panel';
import { SectionLabel } from '@/components/SectionLabel';
import { StatusBadge } from '@/components/StatusBadge';
import {
  EVENT_HORIZON_DAY,
  EVENT_HORIZON_DISPLAY,
  formatEntityId,
  formatFacility,
  formatJobId,
  formatLabel,
  formatMinutes,
  formatStamp,
  humanizeText,
} from '@/lib/display';
import { sql } from '@/lib/db';
import type { FacilityId } from '@/lib/types';
import {
  deriveRecommendedActions,
  getDefectPareto,
  getFacilityPulse,
  getMachineStrip,
  getNeedsAttention,
  getOverviewKpis,
  getOverviewTrends,
  getProvenanceStats,
} from '@/lib/queries/overview';
import { PassRateLine, Sparkline, ThroughputArea } from './overview-charts';
import { unstable_cache } from 'next/cache';

// frozen dataset: cache every query result permanently after first success so
// warm pages never depend on the flaky function->db network path
const cached = <T,>(key: string, f: () => Promise<T>) =>
  unstable_cache(f, [key], { revalidate: false })();

export const dynamic = 'force-dynamic';

const fmt = (v: number) => Math.round(v).toLocaleString('en-US');

const TONE_COLOR: Record<string, string> = {
  ok: 'var(--color-text-muted)',
  warn: 'var(--color-status-warn)',
  critical: 'var(--color-status-critical)',
  info: 'var(--color-status-info)',
};

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ facility?: string; alert?: string }>;
}) {
  const params = await searchParams;
  const facility: FacilityId | undefined =
    params.facility === 'la_01' || params.facility === 'la_02' ? params.facility : undefined;
  const facQs = facility ? `&facility=${facility}` : '';

  const fk = facility ?? 'all';
  const [kpis, queue, pulse, strip, trends, pareto, provenance] = await Promise.all([
    cached(`ovw-kpis-${fk}`, () => getOverviewKpis(sql, facility)),
    cached(`ovw-queue-${fk}`, () => getNeedsAttention(sql, facility)),
    cached('ovw-pulse', () => getFacilityPulse(sql)),
    cached(`ovw-strip-${fk}`, () => getMachineStrip(sql, facility)),
    cached(`ovw-trends-${fk}`, () => getOverviewTrends(sql, facility)),
    cached('ovw-pareto', () => getDefectPareto(sql)),
    cached('ovw-prov', () => getProvenanceStats(sql)),
  ]);
  const actions = deriveRecommendedActions(queue, pareto);
  const selected = queue.find((a) => a.alert_id === params.alert) ?? queue[0];
  const pulseShown = facility ? pulse.filter((p) => p.facility_id === facility) : pulse;

  return (
    <div className="flex flex-col gap-3">
      <PageTitle
        right={
          <span className="font-mono text-[11px] text-text-muted">
            Factory state at {EVENT_HORIZON_DISPLAY}
          </span>
        }
      >
        Operations overview
      </PageTitle>

      <div className="grid grid-cols-4 gap-3">
        <KpiTile
          label="Active jobs"
          value={String(kpis.activeJobs)}
          delta={`of ${kpis.totalJobs} jobs total`}
          tone="info"
          href={`/jobs?status=active${facQs}`}
        />
        <KpiTile
          label="Blocked / held"
          value={String(kpis.blockedHeldJobs)}
          delta={`${kpis.missingToolBlocks} of ${kpis.totalBlocks} blocks cite missing tools`}
          tone="warn"
          href={`/jobs?status=blocked-held${facQs}`}
        />
        <KpiTile
          label="Overdue value"
          value={`$${fmt(kpis.overdueValue / 1000)}K`}
          delta={`${kpis.overdueJobs} late jobs · price data for ${kpis.pricedJobs} of ${kpis.totalJobs}`}
          tone="critical"
          href={`/jobs?risk=overdue${facQs}`}
        />
        <KpiTile
          label="In-process fail rate"
          value={`${Math.round(kpis.inProcessFailRatePct)}%`}
          delta={`final completed-job yield: ${fmt(kpis.completedYieldPct)}%`}
          tone="info"
          href="/alerts"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Panel label="Throughput" count="daily good qty">
          <Link href={`/jobs?status=active${facQs}` as Route} className="block">
            <ThroughputArea points={trends.throughput} />
          </Link>
        </Panel>
        <Panel label="Quality" count="daily pass rate">
          <Link href={'/alerts' as Route} className="block">
            <PassRateLine points={trends.passRate} referencePct={Math.round(trends.overallPassRatePct)} />
          </Link>
          <div className="pt-1 text-[11px] text-text-muted">
            flat across assets — see quality note below
          </div>
        </Panel>
      </div>

      <Panel label="Factory status" count={facility ? formatFacility(facility) : 'LA 1 · LA 2'}>
        <div className="flex flex-col gap-3">
          <div className={`grid gap-3 ${pulseShown.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {pulseShown.map((p) => (
              <Link
                key={p.facility_id}
                href={`/jobs?facility=${p.facility_id}` as Route}
                className="rounded-sm border border-border bg-bg-inset px-3 py-2 transition-colors duration-100 hover:bg-bg-3"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[13px] font-medium text-text-primary">
                    {formatFacility(p.facility_id)}
                  </span>
                  <span className="text-[11px] text-text-muted">
                    Data through {formatStamp(p.latestEventAt)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 divide-x divide-border text-text-secondary">
                  <div className="pr-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Open work</div>
                    <div className="mt-0.5 font-mono text-[19px] font-medium text-text-primary">{p.openJobs}</div>
                    <div className="text-[11px]">Jobs not yet complete</div>
                  </div>
                  <div className="px-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Blocked</div>
                    <div className="mt-0.5 font-mono text-[19px] font-medium text-text-primary">{p.blockedHeldJobs}</div>
                    <div className="text-[11px]">Jobs unable to proceed</div>
                  </div>
                  <div className="pl-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Past due</div>
                    <div className="mt-0.5 font-mono text-[19px] font-medium text-text-primary">{p.overdueJobs}</div>
                    <div className="text-[11px]">Jobs past their due date</div>
                  </div>
                </div>
                {p.topOverdueJobId && (
                  <div className="mt-3 text-[11px] text-text-muted">
                    Largest overdue order: job {formatJobId(p.topOverdueJobId)}
                    {p.topOverdueValue != null && ` · $${fmt(p.topOverdueValue)}`}
                  </div>
                )}
              </Link>
            ))}
          </div>
          <div className="grid grid-cols-6 gap-2">
            {strip.map((m) => (
              <Link
                key={m.machine_id}
                href={`/machines/${m.machine_id}` as Route}
                className="rounded-sm border border-border-faint px-2 py-1.5 transition-colors duration-100 hover:bg-bg-3"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-[12.5px] text-text-primary">{formatEntityId(m.machine_id)}</span>
                  <AngleGlyph tone={m.statusTone} />
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-text-secondary">
                  {formatMinutes(m.medianCycleSeconds)} med
                </div>
                <div className="mt-1">
                  <Sparkline values={m.weeklyMedians} stroke={TONE_COLOR[m.statusTone]} />
                </div>
              </Link>
            ))}
          </div>
          {facility && (
            <Link href="/" className="self-start text-[11px] text-accent hover:underline">
              Compare both facilities
            </Link>
          )}
        </div>
      </Panel>

      <div className="grid grid-cols-[3fr_2fr] items-start gap-3">
        <Panel label="Needs attention" count={queue.length} padded={false}>
          {queue.length === 0 ? (
            <div className="p-4">
              <EmptyState
                message="No open findings for this filter."
                queryContext={`facility=${facility ?? 'all'}`}
              />
            </div>
          ) : (
            queue.map((a) => (
              <AlertRow
                key={a.alert_id}
                severity={a.severity}
                title={humanizeText(a.title)}
                explanation={humanizeText(a.explanation)}
                impact={humanizeText(a.businessImpact)}
                ids={a.implicated_ids.map(formatEntityId)}
                href={`/?alert=${a.alert_id}${facQs}`}
                selected={a.alert_id === selected?.alert_id}
              />
            ))
          )}
        </Panel>

        <Panel label="Selected investigation">
          {selected ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <StatusBadge tone={selected.severity} label={selected.severity} />
                <span className="text-[13px] font-semibold text-text-primary">
                  {humanizeText(selected.title)}
                </span>
              </div>
              <p className="text-[13px] text-text-secondary">{humanizeText(selected.explanation)}</p>
              <p className="text-[13px]" style={{ color: 'var(--color-accent-resin)' }}>
                {humanizeText(selected.businessImpact)}
              </p>
              <DerivedBadge
                provenance={selected.provenance}
                caveat="Calculated from job and machine history — the event IDs below are the source records"
              />
              <div>
                <SectionLabel>Evidence</SectionLabel>
                <ul className="mt-1 flex flex-col gap-1">
                  {selected.evidenceFacts.map((fact) => (
                    <li key={fact} className="font-mono text-[12.5px] text-text-secondary">
                      {humanizeText(fact)}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-1">
                {selected.supporting_event_ids.slice(0, 8).map((id) => (
                  <span
                    key={id}
                    className="rounded-sm bg-bg-inset px-1.5 py-0.5 font-mono text-[12.5px] text-text-secondary"
                  >
                    {id}
                  </span>
                ))}
                {selected.supporting_event_ids.length > 8 && (
                  <span className="font-mono text-[11px] text-text-muted">
                    +{selected.supporting_event_ids.length - 8} more
                  </span>
                )}
              </div>
              <Link
                href={selected.href as Route}
                className="inline-flex h-8 items-center justify-center rounded-sm border border-border-strong px-3 text-[13px] text-accent transition-colors duration-100 hover:bg-bg-3"
              >
                {selected.actionLabel}
              </Link>
            </div>
          ) : (
            <EmptyState message="Select a finding from the queue." />
          )}
        </Panel>
      </div>

      <Panel
        label="Recommended actions"
        headerRight={<DerivedBadge provenance="derived" caveat="generated from open alerts" />}
        padded={false}
      >
        <div className="border-b border-border-faint px-4 py-2 text-[11px] text-text-muted">
          What we&apos;d do about it — each derived from an alert above.
        </div>
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href as Route}
            className="flex items-center border-b border-border-faint px-4 py-2 text-[13px] text-text-secondary transition-colors duration-100 last:border-b-0 hover:bg-bg-3 hover:text-text-primary"
          >
            {humanizeText(action.text)}
          </Link>
        ))}
      </Panel>

      <Panel label="Quality signal">
        <div className="pb-3">
          <p className="text-[14px] font-medium text-text-primary">
            This is a factory-wide quality problem, not a single-machine problem.
          </p>
          <p className="mt-1 text-[13px] text-text-secondary">
            Failed inspections look similar across presses, tools, facilities, and inspectors.
            Start with the shared manufacturing process—especially the steps that can create voids.
          </p>
        </div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          Failed inspections by defect type
        </div>
        <MiniPareto
          items={pareto.map((d) => ({ label: formatLabel(d.defect_code), count: d.failedInspections }))}
        />
      </Panel>

    </div>
  );
}
