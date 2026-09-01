import Link from 'next/link';
import type { Route } from 'next';
import { AngleGlyph } from '@/components/AngleGlyph';
import { DerivedBadge } from '@/components/DerivedBadge';
import { EmptyState } from '@/components/EmptyState';
import { KpiTile } from '@/components/KpiTile';
import { PageTitle } from '@/components/PageTitle';
import { Panel } from '@/components/Panel';
import { SectionLabel } from '@/components/SectionLabel';
import { StatusBadge } from '@/components/StatusBadge';
import {
  EVENT_HORIZON_DISPLAY,
  formatDateShort,
  formatEntityId,
  formatFacility,
  formatJobId,
  formatLabel,
  formatMinutes,
  formatStamp,
  humanizeText,
} from '@/lib/display';
import { sql } from '@/lib/db';
import type { FacilityId, Severity } from '@/lib/types';
import {
  deriveRecommendedActions,
  getDefectPareto,
  getFacilityPulse,
  getMachineStrip,
  getNeedsAttention,
  getOverviewKpis,
  getOverviewTrends,
  getProvenanceStats,
  type QueueAlert,
  type TrendPoint,
} from '@/lib/queries/overview';
import { CategoryBars, Sparkline, TrendChart, type TrendStat } from './overview-charts';
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

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: 'var(--color-status-critical)',
  warn: 'var(--color-status-warn)',
  info: 'var(--color-status-info)',
};

function avg(points: TrendPoint[]): number {
  return points.length ? points.reduce((s, p) => s + p.value, 0) / points.length : 0;
}

function throughputStats(points: TrendPoint[]): { stats: TrendStat[]; takeaway: string } {
  const peak = points.reduce((a, b) => (b.value > a.value ? b : a), points[0]);
  const last7 = avg(points.slice(-7));
  const prior7 = avg(points.slice(-14, -7));
  const deltaPct = prior7 > 0 ? Math.round(((last7 - prior7) / prior7) * 100) : 0;
  return {
    stats: [
      { label: 'Total good units', value: fmt(points.reduce((s, p) => s + p.value, 0)) },
      { label: 'Peak day', value: `${fmt(peak.value)} · ${formatDateShort(peak.date)}` },
      { label: 'Last 7-day avg', value: `${fmt(last7)}/day` },
      { label: 'vs prior week', value: `${deltaPct >= 0 ? '+' : ''}${deltaPct}%` },
    ],
    takeaway: `Output peaked at ${fmt(peak.value)}/day on ${formatDateShort(peak.date)}; the last 7 days averaged ${fmt(last7)}/day (${deltaPct >= 0 ? '+' : ''}${deltaPct}% vs the prior week).`,
  };
}

function passRateStats(points: TrendPoint[], overallPct: number): TrendStat[] {
  const best = points.reduce((a, b) => (b.value > a.value ? b : a), points[0]);
  const worst = points.reduce((a, b) => (b.value < a.value ? b : a), points[0]);
  return [
    { label: 'Overall pass rate', value: `${Math.round(overallPct)}%` },
    { label: 'Best day', value: `${Math.round(best.value)}% · ${formatDateShort(best.date)}` },
    { label: 'Worst day', value: `${Math.round(worst.value)}% · ${formatDateShort(worst.date)}` },
    { label: 'Latest day', value: `${Math.round(points[points.length - 1].value)}%` },
  ];
}

// Compact finding card: severity, headline, impact, and the recommended move.
// The full explanation and evidence live in the Selected investigation panel.
function FindingCard({
  alert,
  action,
  href,
  selected,
}: {
  alert: QueueAlert;
  action?: string;
  href: string;
  selected: boolean;
}) {
  return (
    <Link
      href={href as Route}
      className={`block border-b border-border-faint px-4 py-3 transition-colors duration-100 last:border-b-0 hover:bg-bg-3 ${selected ? 'bg-bg-3' : ''}`}
      style={{ borderLeft: `3px solid ${SEVERITY_COLOR[alert.severity]}` }}
    >
      <div className="flex items-center gap-2">
        <StatusBadge tone={alert.severity} label={alert.severity} />
        <span className="text-[13px] font-semibold text-text-primary">{humanizeText(alert.title)}</span>
        <span className="ml-auto flex gap-1">
          {alert.implicated_ids.slice(0, 2).map((id) => (
            <span key={id} className="rounded-sm bg-bg-inset px-1.5 py-0.5 font-mono text-[11px] text-text-secondary">
              {formatEntityId(id)}
            </span>
          ))}
        </span>
      </div>
      <div className="mt-1 text-[12.5px]" style={{ color: 'var(--color-accent-resin)' }}>
        {humanizeText(alert.businessImpact)}
      </div>
      {action && (
        <div className="mt-1 text-[12.5px] text-text-secondary">
          <span className="font-mono text-text-muted">→ </span>
          {humanizeText(action)}
        </div>
      )}
    </Link>
  );
}

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
  const actionFor = (a: QueueAlert) => actions.find((x) => x.href === a.href)?.text;
  const selected = queue.find((a) => a.alert_id === params.alert) ?? queue[0];
  const pulseShown = facility ? pulse.filter((p) => p.facility_id === facility) : pulse;

  const thru = throughputStats(trends.throughput);
  const passPct = Math.round(trends.overallPassRatePct);
  const press03 = strip.find((m) => m.machine_id === 'press_03');
  const fleetRef = press03?.fleetMedianSeconds ?? 0;
  const p3AbovePct = press03 ? Math.floor((press03.medianCycleSeconds / fleetRef - 1) * 100) : 0;
  const totalFailed = pareto.reduce((s, d) => s + d.failedInspections, 0);

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
          delta={`of ${kpis.totalJobs} total orders`}
          tone="info"
          href={`/jobs?status=active${facQs}`}
        />
        <KpiTile
          label="Blocked / held"
          value={String(kpis.blockedHeldJobs)}
          delta={`${kpis.missingToolBlocks} of ${kpis.totalBlocks} stoppages cite a missing tool`}
          tone="warn"
          href={`/jobs?status=blocked-held${facQs}`}
        />
        <KpiTile
          label="Overdue value"
          value={`$${fmt(kpis.overdueValue / 1000)}K`}
          delta={`${kpis.overdueJobs} late jobs · value known for ${kpis.overduePricedJobs} of ${kpis.overdueJobs}`}
          tone="critical"
          href={`/jobs?risk=overdue${facQs}`}
        />
        <KpiTile
          label="In-process fail rate"
          value={`${Math.round(kpis.inProcessFailRatePct)}%`}
          delta={`of shop-floor inspections · final shipped yield ${fmt(kpis.completedYieldPct)}%`}
          tone="info"
          href="/alerts"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Panel label="Throughput" count="good units per day">
          <TrendChart
            points={trends.throughput}
            kind="area"
            color="var(--color-series-1)"
            unit="units"
            title="Throughput — good units per day"
            takeaway={thru.takeaway}
            stats={thru.stats}
            drill={{ href: `/jobs?status=active${facQs}`, label: 'View active jobs' }}
          />
        </Panel>
        <Panel label="Quality" count="inspection pass rate per day">
          <TrendChart
            points={trends.passRate}
            kind="line"
            color="var(--color-status-ok)"
            domainMax={100}
            formatValue="percent"
            unit="pct"
            reference={{ value: passPct, label: `${passPct}% overall`, band: 3 }}
            title="Quality — daily inspection pass rate"
            takeaway={`Pass rate holds near ${passPct}% every day — flat across presses, tools, and inspectors, which points at the shared process rather than one bad machine.`}
            stats={passRateStats(trends.passRate, trends.overallPassRatePct)}
            drill={{ href: '/alerts', label: 'View quality findings' }}
          />
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Panel label="Cycle time by press" count="median · lower is faster">
          {strip.length === 0 ? (
            <div className="text-[12px] text-text-muted">
              No presses homed in this facility — clear the facility filter to compare the fleet.
            </div>
          ) : (
          <CategoryBars
            rows={strip.map((m) => ({
              key: m.machine_id,
              label: formatEntityId(m.machine_id),
              value: m.medianCycleSeconds,
              display: formatMinutes(m.medianCycleSeconds),
              note: `${m.maintenanceCount} maintenance events`,
              tone: m.statusTone === 'ok' ? 'ok' : m.statusTone,
              href: `/machines/${m.machine_id}`,
            }))}
            reference={{ value: fleetRef, label: `fleet median ${formatMinutes(fleetRef)}` }}
          />
          )}
          {press03 && (
            <p className="mt-2 border-t border-border-faint pt-2 text-[12px] text-text-secondary">
              Press 3 runs {p3AbovePct}% above the fleet median with no maintenance on record —
              click a press to investigate.
            </p>
          )}
        </Panel>
        <Panel label="Failed inspections by defect" count={`${fmt(totalFailed)} failures`}>
          <CategoryBars
            rows={pareto.map((d) => ({
              key: d.defect_code,
              label: formatLabel(d.defect_code),
              value: d.failedInspections,
              display: fmt(d.failedInspections),
              tone: 'critical',
              href: '/alerts',
            }))}
          />
          <p className="mt-2 border-t border-border-faint pt-2 text-[12px] text-text-secondary">
            Voids lead the defect counts in every material — a factory-wide pattern, so start with the
            shared cure / vacuum / debulk step, not a single machine.
          </p>
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
          {strip.length === 0 && facility && (
            <div className="text-[12px] text-text-muted">
              No presses are homed in {formatFacility(facility)} — all six record most of their
              cycles in LA 1.
            </div>
          )}
          <div className="grid grid-cols-6 gap-2">
            {strip.map((m) => (
              <Link
                key={m.machine_id}
                href={`/machines/${m.machine_id}` as Route}
                title={`${formatEntityId(m.machine_id)}: ${formatMinutes(m.medianCycleSeconds)} median over ${fmt(m.cycleCount)} cycles · ${m.maintenanceCount} maintenance events`}
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
        <Panel
          label="Needs attention"
          headerRight={
            <span className="font-mono text-[12.5px] text-text-secondary">
              {queue.length} findings · select one for evidence
            </span>
          }
          padded={false}
        >
          {queue.length === 0 ? (
            <div className="p-4">
              <EmptyState
                message="No open findings for this filter."
                queryContext={`facility=${facility ?? 'all'}`}
              />
            </div>
          ) : (
            queue.map((a) => (
              <FindingCard
                key={a.alert_id}
                alert={a}
                action={actionFor(a)}
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
              <Link
                href={selected.href as Route}
                className="inline-flex h-8 items-center justify-center self-start rounded-sm border border-border-strong px-3 text-[13px] text-accent transition-colors duration-100 hover:bg-bg-3"
              >
                {selected.actionLabel}
              </Link>
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
            </div>
          ) : (
            <EmptyState message="Select a finding from the queue." />
          )}
        </Panel>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2 font-mono text-[11px] text-text-muted">
        <span>
          {fmt(provenance.totalEvents)} events · horizon {EVENT_HORIZON_DISPLAY} · LA 1{' '}
          {provenance.la01SharePct}% · LA 2 {provenance.la02SharePct}%
        </span>
        <span>
          latest event {provenance.latestEventId} · {formatStamp(provenance.latestEventAt)}
        </span>
      </div>
    </div>
  );
}
