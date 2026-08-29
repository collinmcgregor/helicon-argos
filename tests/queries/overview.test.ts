import { describe, it, expect } from 'vitest';
import { sql, NOW } from '../helpers';
import {
  getOverviewKpis,
  getNeedsAttention,
  getFacilityPulse,
  getMachineStrip,
  getOverviewTrends,
  getDefectPareto,
  getProvenanceStats,
  deriveRecommendedActions,
} from '../../lib/queries/overview';

describe('overview KPIs', () => {
  it('matches the verified headline numbers', async () => {
    const k = await getOverviewKpis(sql);
    expect(k.activeJobs).toBe(22);
    expect(k.blockedHeldJobs).toBe(9);
    expect(k.overdueJobs).toBe(26);
    expect(Math.round(k.overdueValue)).toBe(590465);
    expect(k.overduePricedJobs).toBe(10);
    expect(k.pricedJobs).toBe(150);
    expect(k.totalJobs).toBe(312);
    expect(k.missingToolBlocks).toBe(28);
    expect(k.totalBlocks).toBe(68);
    expect(k.inProcessFailRatePct).toBeCloseTo(46.3, 1);
    expect(k.completedYieldPct).toBe(91);
  });

  it('honors the facility filter', async () => {
    const k = await getOverviewKpis(sql, 'la_02');
    expect(k.activeJobs).toBe(1);
    expect(k.blockedHeldJobs).toBe(0);
    expect(k.overdueJobs).toBe(1);
  });
});

describe('needs-attention queue', () => {
  it('ranks the four verified findings with computed impact', async () => {
    const q = await getNeedsAttention(sql);
    expect(q).toHaveLength(4);
    expect(q.map((a) => a.rule)).toEqual([
      'cycle_time_vs_baseline',
      'overdue_incomplete',
      'blocked_or_held',
      'recovered_incident',
    ]);

    const [press03, overdue, tooling, press06] = q;
    expect(press03.implicated_ids).toContain('press_03');
    expect(press03.explanation).toContain('1,294');
    expect(press03.explanation).toContain('25%'); // floored vs 1,029s median-of-press-medians (matches machine detail)
    expect(press03.explanation).toMatch(/no maintenance/i);

    expect(overdue.explanation).toContain('26');
    expect(overdue.businessImpact).toContain('590,465');
    expect(overdue.businessImpact).toContain('11 customers');
    expect(overdue.businessImpact).toContain('10 of 26'); // price coverage, computed

    expect(tooling.explanation).toContain('28 of 68');
    expect(tooling.explanation).toContain('9');
    expect(tooling.businessImpact).toContain('259,253'); // computed blocked value
    expect(tooling.businessImpact).toContain('3 of 9');

    expect(press06.implicated_ids).toContain('press_06');
    expect(press06.supporting_event_ids).toContain('evt_010715'); // Jul 24 sensor_glitch
    expect(press06.supporting_event_ids).toContain('evt_011175'); // Jul 25 maintenance_ping
    expect(press06.explanation).toContain('1,810'); // ping+7d..14d spike window (matches machine detail)
  });

  it('every alert is derived, drillable, and inside the frozen horizon', async () => {
    const q = await getNeedsAttention(sql);
    for (const a of q) {
      expect(a.provenance).toBe('derived');
      expect(a.supporting_event_ids.length).toBeGreaterThan(0);
      expect(a.evidenceFacts).toHaveLength(3);
      expect(a.href).toBeTruthy();
    }
  });
});

describe('factory panel', () => {
  it('facility pulse matches jobs_current and stays inside the horizon', async () => {
    const pulse = await getFacilityPulse(sql);
    expect(pulse.map((p) => p.facility_id)).toEqual(['la_01', 'la_02']);
    const [la01, la02] = pulse;
    expect(la01.openJobs).toBe(21);
    expect(la01.blockedHeldJobs).toBe(9);
    expect(la01.overdueJobs).toBe(25);
    expect(la02.openJobs).toBe(1);
    expect(la02.overdueJobs).toBe(1);
    // final-24h window contains no cycle_completed events — honest zero, not a bug
    expect(la01.recent24hQuantity).toBe(0);
    for (const p of pulse) {
      expect(new Date(p.latestEventAt).getTime()).toBeLessThanOrEqual(NOW.getTime());
      expect(p.latestEventId).toMatch(/^evt_/);
    }
  });

  it('machine strip covers the six presses, never QC stations', async () => {
    const strip = await getMachineStrip(sql);
    expect(strip.map((m) => m.machine_id)).toEqual([
      'press_01',
      'press_02',
      'press_03',
      'press_04',
      'press_05',
      'press_06',
    ]);
    const press03 = strip.find((m) => m.machine_id === 'press_03');
    const press06 = strip.find((m) => m.machine_id === 'press_06');
    expect(press03?.medianCycleSeconds).toBe(1294);
    expect(press03?.maintenanceCount).toBe(0);
    expect(press03?.statusTone).toBe('warn');
    expect(press06?.statusTone).toBe('info');
    for (const m of strip) {
      expect(m.machine_id).not.toMatch(/^qc_/);
      expect(m.weeklyMedians.length).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('trend row', () => {
  it('daily throughput sums to total cycle quantity; pass rate is flat ~54%', async () => {
    const t = await getOverviewTrends(sql);
    expect(t.throughput.reduce((s, p) => s + p.value, 0)).toBe(126301);
    expect(t.throughput.length).toBeGreaterThanOrEqual(35);
    expect(Math.round(t.overallPassRatePct)).toBe(54);
    for (const p of t.passRate) {
      expect(p.value).toBeGreaterThanOrEqual(0);
      expect(p.value).toBeLessThanOrEqual(100);
    }
  });
});

describe('systemic quality + provenance', () => {
  it('defect pareto: voids lead with 827 failed inspections', async () => {
    const pareto = await getDefectPareto(sql);
    expect(pareto.map((d) => [d.defect_code, d.failedInspections])).toEqual([
      ['voids', 827],
      ['delamination', 421],
      ['dimensional', 347],
      ['surface', 337],
      ['resin_rich', 244],
      ['other', 212],
    ]);
  });

  it('footer stats ground the page in the source log', async () => {
    const s = await getProvenanceStats(sql);
    expect(s.totalEvents).toBe(19519);
    expect(s.la01SharePct).toBe(92);
    expect(s.la02SharePct).toBe(8);
  });

  it('recommended actions derive from the queue plus the quality signal', async () => {
    const queue = await getNeedsAttention(sql);
    const pareto = await getDefectPareto(sql);
    const actions = deriveRecommendedActions(queue, pareto);
    expect(actions).toHaveLength(4);
    expect(actions[0].text).toContain('press_03');
    expect(actions[0].href).toBe('/machines/press_03');
    expect(actions[1].text).toContain('26');
    expect(actions[2].text).toContain('missing_tool');
    expect(actions[3].text).toContain('voids');
  });
});
