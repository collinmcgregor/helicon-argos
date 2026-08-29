import Link from 'next/link';
import type { Route } from 'next';
import { AlertRow } from '@/components/AlertRow';
import { DerivedBadge } from '@/components/DerivedBadge';
import { EmptyState } from '@/components/EmptyState';
import { KpiTile } from '@/components/KpiTile';
import { PageTitle } from '@/components/PageTitle';
import { Panel } from '@/components/Panel';
import { SectionLabel } from '@/components/SectionLabel';
import { StatusBadge } from '@/components/StatusBadge';
import { EVENT_HORIZON_LABEL } from '@/lib/constants';
import { sql } from '@/lib/db';
import type { FacilityId } from '@/lib/types';
import {
  getFacilityPulse,
  getNeedsAttention,
  getOverviewKpis,
  getProvenanceStats,
} from '@/lib/queries/overview';
import { facilityLabel, identifierLabel, jobLabel } from '@/lib/present';

export const dynamic = 'force-dynamic';

const fmt = (v: number) => Math.round(v).toLocaleString('en-US');

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ facility?: string; alert?: string }>;
}) {
  const params = await searchParams;
  const facility: FacilityId | undefined =
    params.facility === 'la_01' || params.facility === 'la_02' ? params.facility : undefined;
  const facQs = facility ? `&facility=${facility}` : '';

  const [kpis, queue, pulse, provenance] = await Promise.all([
    getOverviewKpis(sql, facility),
    getNeedsAttention(sql, facility),
    getFacilityPulse(sql),
    getProvenanceStats(sql),
  ]);
  const selected = queue.find((a) => a.alert_id === params.alert) ?? queue[0];
  const pulseShown = facility ? pulse.filter((p) => p.facility_id === facility) : pulse;

  return (
    <div className="flex flex-col gap-3">
      <PageTitle
        right={
          <span className="font-mono text-[11px] text-text-muted">
            Factory state at {EVENT_HORIZON_LABEL}
          </span>
        }
      >
        Operations overview
      </PageTitle>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiTile
          label="Active jobs"
          value={String(kpis.activeJobs)}
          delta={`of ${kpis.totalJobs} jobs at horizon`}
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
          delta={`${kpis.overdueJobs} incomplete jobs · price coverage ${kpis.pricedJobs}/${kpis.totalJobs}`}
          tone="critical"
          href={`/jobs?risk=overdue${facQs}`}
        />
      </div>

      <Panel label="Factory pulse" count={facility ? facilityLabel(facility) : '2 facilities'}>
        <div className="flex flex-col gap-2">
          <div className={`grid gap-3 ${pulseShown.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {pulseShown.map((p) => (
              <Link
                key={p.facility_id}
                href={`/jobs?facility=${p.facility_id}` as Route}
                className="rounded-sm border border-border bg-bg-inset px-3 py-2 transition-colors duration-100 hover:bg-bg-3"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[13px] font-medium text-text-primary">
                    {facilityLabel(p.facility_id)}
                  </span>
                  <span className="font-mono text-[11px] text-text-muted">
                    latest {p.latestEventAt.slice(0, 16).replace('T', ' ')}
                  </span>
                </div>
                <div className="mt-1 grid grid-cols-3 gap-2 font-mono text-[12.5px] text-text-secondary">
                  <span>{p.openJobs} open</span>
                  <span>{p.blockedHeldJobs} blocked/held</span>
                  <span>{p.overdueJobs} overdue</span>
                  <span>{fmt(p.recent24hQuantity)} recent qty</span>
                </div>
                {p.topOverdueJobId && (
                  <div className="mt-1 font-mono text-[11px] text-text-muted">
                    top overdue job {jobLabel(p.topOverdueJobId)}
                    {p.topOverdueValue != null && ` · $${fmt(p.topOverdueValue)}`}
                  </div>
                )}
              </Link>
            ))}
          </div>
          <div className="font-mono text-[11px] text-text-muted">
            recent activity = completed-cycle qty in the final 24h before {EVENT_HORIZON_LABEL} — not a
            &quot;currently running&quot; signal
            {facility && (
              <>
                {' · '}
                <Link href="/" className="text-accent">
                  compare all facilities
                </Link>
              </>
            )}
          </div>
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
            queue.slice(0, 3).map((a) => (
              <AlertRow
                key={a.alert_id}
                severity={a.severity}
                title={a.title}
                explanation={a.explanation}
                impact={a.businessImpact}
                ids={a.implicated_ids}
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
                <span className="text-[13px] font-semibold text-text-primary">{selected.title}</span>
              </div>
              <p className="text-[13px] text-text-secondary">{selected.explanation}</p>
              <p className="text-[13px]" style={{ color: 'var(--color-accent-resin)' }}>
                {selected.businessImpact}
              </p>
              <DerivedBadge
                provenance={selected.provenance}
                caveat="rule evaluated over derived views at the frozen horizon"
              />
              <div>
                <SectionLabel>Evidence</SectionLabel>
                <ul className="mt-1 flex flex-col gap-1">
                  {selected.evidenceFacts.map((fact) => (
                    <li key={fact} className="font-mono text-[12.5px] text-text-secondary">
                      {fact}
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
                    {identifierLabel(id)}
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

      <Panel label="Systemic quality signal">
        <p className="text-[13px] text-text-secondary">
          Voids are the top defect in all eight materials. Inspection failure rates are flat across
          presses, tools, facilities, and inspectors. Investigate a shared process step — not a
          single asset.
        </p>
      </Panel>

      <div className="pb-2 font-mono text-[11px] text-text-muted">
        {fmt(provenance.totalEvents)} events · horizon {EVENT_HORIZON_LABEL} · LA 01{' '}
        {provenance.la01SharePct}% / LA 02 {provenance.la02SharePct}% of activity · source:
        manufacturing_events.jsonl
      </div>
    </div>
  );
}
