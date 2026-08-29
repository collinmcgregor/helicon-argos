import { AlertRow } from '@/components/AlertRow';
import { AngleGlyph } from '@/components/AngleGlyph';
import { DerivedBadge } from '@/components/DerivedBadge';
import { EmptyState } from '@/components/EmptyState';
import { KpiTile } from '@/components/KpiTile';
import { MiniPareto } from '@/components/MiniPareto';
import { PageTitle } from '@/components/PageTitle';
import { Panel } from '@/components/Panel';
import { PlyBar } from '@/components/PlyBar';
import { SectionLabel } from '@/components/SectionLabel';
import { Skeleton } from '@/components/Skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { Table, THead, Th, Tr, Td } from '@/components/Table';
import { TimelineRow } from '@/components/TimelineRow';
import { EVENT_HORIZON_LABEL } from '@/lib/constants';

// Dev-only Laminate kit gallery — deleted in Wave 2. Static props throughout.
export default function KitchenSink() {
  return (
    <div className="flex max-w-5xl flex-col gap-3">
      <PageTitle right={<span className="font-mono text-[11px] text-text-muted">horizon {EVENT_HORIZON_LABEL}</span>}>
        Laminate kitchen sink
      </PageTitle>

      <div className="grid grid-cols-4 gap-3">
        <KpiTile label="Active jobs" value="22" delta="15 in progress" tone="info" href="/jobs?status=active" />
        <KpiTile label="Blocked / held" value="9" delta="28 blocks cite missing tools" tone="warn" href="/jobs?status=blocked-held" />
        <KpiTile label="Overdue value" value="$590K" delta="26 incomplete jobs" tone="critical" href="/jobs?risk=overdue" />
        <KpiTile label="Fail rate" value="46%" delta="final completed-job yield: 91%" tone="ok" href="/jobs" />
      </div>

      <Panel label="Status badges" count={8}>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="ok" label="ok" />
          <StatusBadge tone="info" label="info" />
          <StatusBadge tone="warn" label="warn" />
          <StatusBadge tone="critical" label="critical" />
          <AngleGlyph tone="ok" />
          <AngleGlyph tone="info" />
          <AngleGlyph tone="warn" />
          <AngleGlyph tone="critical" />
        </div>
      </Panel>

      <Panel label="Provenance" count={3}>
        <div className="flex flex-col gap-2">
          <DerivedBadge provenance="observed" caveat="recorded directly in source events" />
          <DerivedBadge provenance="derived" caveat="attributed via job → cycle join; inspections carry QC-station ids" />
          <DerivedBadge provenance="external" caveat="unit_price_estimate from the commercial system" />
        </div>
      </Panel>

      <Panel label="Ply-stack yield" count="qty 24">
        <div className="flex flex-col gap-2">
          <PlyBar good={18} scrap={3} total={24} />
          <PlyBar good={24} scrap={0} total={24} />
          <PlyBar good={4} scrap={9} total={24} />
        </div>
      </Panel>

      <Panel label="Needs attention" count={2} padded={false}>
        <AlertRow
          severity="critical"
          title="Slowing cycle time — press_03"
          explanation="1,294s median; 25% above fleet; rising; no maintenance recorded."
          impact="~25% capacity loss on 1 of 6 presses; open jobs routed here at risk"
          ids={['press_03', 'evt_018231']}
          timeLabel="2h ago"
          href="/machines/press_03"
        />
        <AlertRow
          severity="warn"
          title="Tooling constraint"
          explanation="missing_tool: 28 of 68 blocks; 9 currently blocked/held."
          ids={['job_0152', 'job_0201']}
          timeLabel="6h ago"
          href="/jobs?status=blocked-held"
          selected
        />
      </Panel>

      <Panel label="Event timeline" count={3} padded={false}>
        <div className="px-4">
          <TimelineRow timestamp="2026-08-13 22:41:02" eventType="cycle_completed" eventId="evt_019488" tone="ok">
            press_02 · qty 12 · 1,004s
          </TimelineRow>
          <TimelineRow timestamp="2026-08-13 21:12:44" eventType="job_blocked" eventId="evt_019371" tone="critical">
            job_0152 blocked — missing_tool
          </TimelineRow>
          <TimelineRow timestamp="2026-08-13 20:03:19" eventType="material_lot_scan" eventId="evt_019344" tone="info">
            lot_6626 · carbon_fiber_epoxy
          </TimelineRow>
        </div>
      </Panel>

      <Panel label="Jobs" count={3} padded={false}>
        <Table>
          <THead>
            <tr>
              <Th>Job</Th>
              <Th>Status</Th>
              <Th numeric>Target qty</Th>
              <Th numeric>Value</Th>
              <Th>Yield</Th>
            </tr>
          </THead>
          <tbody>
            <Tr>
              <Td mono>job_0152</Td>
              <Td><StatusBadge tone="critical" label="blocked" /></Td>
              <Td numeric>36</Td>
              <Td numeric>$41,200</Td>
              <Td><PlyBar good={12} scrap={2} total={36} /></Td>
            </Tr>
            <Tr>
              <Td mono>job_0293</Td>
              <Td><StatusBadge tone="ok" label="completed" /></Td>
              <Td numeric>18</Td>
              <Td numeric>$22,930</Td>
              <Td><PlyBar good={17} scrap={1} total={18} /></Td>
            </Tr>
            <Tr>
              <Td mono>job_0301</Td>
              <Td><StatusBadge tone="info" label="in progress" /></Td>
              <Td numeric>50</Td>
              <Td numeric>$103,750</Td>
              <Td><PlyBar good={21} scrap={4} total={50} /></Td>
            </Tr>
          </tbody>
        </Table>
      </Panel>

      <Panel label="Quality signal">
        <p className="pb-2 text-[13px] text-text-secondary">
          Voids are the top defect in all eight materials — investigate a shared process step,
          not a single asset.
        </p>
        <MiniPareto
          items={[
            { label: 'voids', count: 827 },
            { label: 'delamination', count: 421 },
            { label: 'dimensional', count: 347 },
            { label: 'surface', count: 337 },
            { label: 'resin_rich', count: 244 },
            { label: 'other', count: 212 },
          ]}
        />
      </Panel>

      <div className="grid grid-cols-2 gap-3">
        <Panel label="Empty state">
          <EmptyState
            message="No jobs match the current filters."
            queryContext="facility=la_02 · status=blocked-held"
          />
        </Panel>
        <Panel label="Loading">
          <div className="flex flex-col gap-2">
            <Skeleton height={28} width={120} />
            <Skeleton height={16} />
            <Skeleton height={16} width="60%" />
          </div>
        </Panel>
      </div>

      <div>
        <SectionLabel>Section label</SectionLabel>
      </div>
    </div>
  );
}
