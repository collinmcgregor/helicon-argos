import Link from 'next/link';
import type { Route } from 'next';
import { sql } from '@/lib/db';
import {
  EVENT_HORIZON_DISPLAY,
  formatDateShort,
  formatEntityId,
  humanizeText,
} from '@/lib/display';
import type { FacilityId, Severity } from '@/lib/types';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/PageTitle';
import { Panel } from '@/components/Panel';
import { StatusBadge } from '@/components/StatusBadge';
import { getAlertSummaries, type AlertSummary } from '@/lib/queries/machines';

const SEVERITY_ORDER = { critical: 0, warn: 1, info: 2 } as const;

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: 'var(--color-status-critical)',
  warn: 'var(--color-status-warn)',
  info: 'var(--color-status-info)',
};

// One verb phrase per rule: what to do about it, stated the same way every time.
function actionFor(a: AlertSummary): string {
  switch (a.rule) {
    case 'cycle_time_vs_baseline':
      return `Investigate ${formatEntityId(a.implicated_ids[0] ?? '')}`;
    case 'overdue_incomplete':
      return 'Open overdue jobs';
    case 'blocked_or_held':
      return 'Open blocked jobs';
    case 'recovered_incident':
      return `Review ${formatEntityId(a.implicated_ids[0] ?? '')} incident`;
    default:
      return 'Investigate';
  }
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const facility: FacilityId | undefined =
    sp.facility === 'la_01' || sp.facility === 'la_02' ? sp.facility : undefined;
  const alerts = (await getAlertSummaries(sql, facility)).sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  return (
    <div className="flex max-w-6xl flex-col gap-3">
      <PageTitle
        right={<span className="font-mono text-[11px] text-text-muted">as of {EVENT_HORIZON_DISPLAY}</span>}
      >
        Alerts
      </PageTitle>
      <Panel label="Derived rule findings" count={alerts.length} padded={false}>
        {alerts.length === 0 ? (
          <EmptyState
            message="No derived findings under the current facility filter."
            queryContext={facility ? `facility=${facility}` : undefined}
          />
        ) : (
          alerts.map((a) => {
            const href = `${a.href}${facility ? `${a.href.includes('?') ? '&' : '?'}facility=${facility}` : ''}`;
            return (
              <Link
                key={a.alert_id}
                href={href as Route}
                className="block border-b border-border-faint px-4 py-3 transition-colors duration-100 last:border-b-0 hover:bg-bg-3"
                style={{ borderLeft: `3px solid ${SEVERITY_COLOR[a.severity]}` }}
              >
                <div className="flex items-center gap-2">
                  <StatusBadge tone={a.severity} label={a.severity} />
                  <span className="text-[13px] font-semibold text-text-primary">
                    {humanizeText(a.title)}
                  </span>
                  <span className="ml-auto flex items-center gap-3">
                    {a.latest_event_at && (
                      <span className="font-mono text-[11px] text-text-muted">
                        {formatDateShort(a.latest_event_at)}
                      </span>
                    )}
                    <span className="text-[12.5px] text-accent">{actionFor(a)} →</span>
                  </span>
                </div>
                <div className="mt-1 text-[12.5px] text-text-secondary">
                  {humanizeText(a.explanation)}
                </div>
                {a.businessImpact && (
                  <div className="mt-0.5 text-[12.5px]" style={{ color: 'var(--color-accent-resin)' }}>
                    {humanizeText(a.businessImpact)}
                  </div>
                )}
                <div className="mt-1.5 flex items-baseline gap-2 font-mono text-[11px]">
                  <span className="font-sans text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                    Evidence
                  </span>
                  <span className="text-text-muted">
                    {a.supporting_event_ids.slice(0, 4).join('  ')}
                    {a.supporting_event_ids.length > 4 &&
                      `  +${a.supporting_event_ids.length - 4} more`}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </Panel>
      <span className="text-[11px] text-text-muted">
        Derived at query time from source events — never editable tickets. Event IDs are the raw
        audit records behind each finding.
      </span>
    </div>
  );
}
