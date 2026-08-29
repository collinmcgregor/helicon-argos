import { sql } from '@/lib/db';
import { EVENT_HORIZON_LABEL } from '@/lib/constants';
import type { FacilityId } from '@/lib/types';
import { AlertRow } from '@/components/AlertRow';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/PageTitle';
import { Panel } from '@/components/Panel';
import { getAlertSummaries } from '@/lib/queries/machines';

const SEVERITY_ORDER = { critical: 0, warn: 1, info: 2 } as const;

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
        right={<span className="font-mono text-[11px] text-text-muted">horizon {EVENT_HORIZON_LABEL}</span>}
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
          alerts.map((a) => (
            <AlertRow
              key={a.alert_id}
              severity={a.severity}
              title={a.title}
              explanation={a.explanation}
              impact={a.businessImpact ?? undefined}
              ids={[...a.implicated_ids, ...a.supporting_event_ids.slice(0, 3)]}
              timeLabel={a.latest_event_at?.slice(0, 10)}
              href={`${a.href}${facility ? `${a.href.includes('?') ? '&' : '?'}facility=${facility}` : ''}`}
            />
          ))
        )}
      </Panel>
      <span className="text-[11px] text-text-muted">
        Alerts are query-time derived findings over source events — never editable tickets. Every
        row carries its rule, implicated objects, and supporting event_ids.
      </span>
    </div>
  );
}
