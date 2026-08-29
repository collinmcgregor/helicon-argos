import { describe, it, expect } from 'vitest';
import { sql, NOW_ISO } from '../helpers';
import {
  getMachine,
  getRecoveredIncident,
  getWeeklyCycleTrend,
  getQualityAttribution,
  getFleetAttribution,
  getAffectedJobs,
  getEvidenceLog,
  getAlertSummaries,
} from '@/lib/queries/machines';

const PRESSES = ['press_01', 'press_02', 'press_03', 'press_04', 'press_05', 'press_06'];

describe('press_03 — silent degradation (ARGOS §1.3)', () => {
  it('median 1,294s, 25% above the 949–1,056s fleet band, +6% drift, zero maintenance', async () => {
    const m = await getMachine(sql, 'press_03');
    expect(m).not.toBeNull();
    expect(m!.medianCycleSeconds).toBe(1294);
    expect(m!.medianCycleSeconds!).toBeGreaterThan(1250);
    expect(m!.cycleCount).toBe(2570);
    expect(m!.pctAboveFleet).toBe(25);
    expect(m!.fleetBandLowSeconds).toBe(949);
    expect(m!.fleetBandHighSeconds).toBe(1056);
    expect(Math.round(m!.cycleTimeDriftPct!)).toBe(6);
    expect(m!.maintenanceCount).toBe(0);
    expect(m!.statusTone).toBe('critical');
    expect(m!.facility_id).toBe('la_01');
  });

  it('the rest of the fleet sits inside the 949–1,056s band', async () => {
    for (const id of PRESSES.filter((p) => p !== 'press_03')) {
      const m = await getMachine(sql, id);
      expect(m!.medianCycleSeconds!).toBeGreaterThanOrEqual(949);
      expect(m!.medianCycleSeconds!).toBeLessThanOrEqual(1056);
    }
  });

  it('returns null for QC stations and unknown ids', async () => {
    expect(await getMachine(sql, 'qc_01')).toBeNull();
    expect(await getMachine(sql, 'press_99')).toBeNull();
  });
});

describe('press_06 — recovered incident (ARGOS §1.3)', () => {
  it('pressure sensor_glitch (Jul 24) then maintenance_ping (Jul 25), 949s → 1,810s spike → 954s recovered', async () => {
    const inc = await getRecoveredIncident(sql, 'press_06');
    expect(inc).not.toBeNull();
    expect(inc!.sensorEvent.event_id).toBe('evt_010715');
    expect(inc!.sensorEvent.event_type).toBe('sensor_glitch');
    expect(inc!.sensorEvent.metadata.signal).toBe('pressure');
    expect(inc!.sensorEvent.timestamp.startsWith('2026-07-24')).toBe(true);
    expect(inc!.maintenanceEvent.event_id).toBe('evt_011175');
    expect(inc!.maintenanceEvent.timestamp.startsWith('2026-07-25')).toBe(true);
    expect(inc!.baselineMedianSeconds).toBe(949);
    expect(inc!.spikeMedianSeconds).toBe(1810);
    expect(inc!.spikeMedianSeconds).toBeGreaterThan(1700);
    expect(inc!.recoveredMedianSeconds).toBe(954);
  });

  it('press_03 has no incident pair — its degradation has no maintenance paper trail', async () => {
    expect(await getRecoveredIncident(sql, 'press_03')).toBeNull();
  });
});

describe('weekly cycle-time trend', () => {
  it('press_06 spikes in the week of Aug 3 and recovers after', async () => {
    const t = await getWeeklyCycleTrend(sql, 'press_06', 'all');
    const spike = t.find((p) => p.weekStart === '2026-08-03');
    expect(spike!.machineMedianSeconds!).toBeGreaterThan(1700);
    expect(t.find((p) => p.weekStart === '2026-07-27')!.machineMedianSeconds!).toBeLessThan(1100);
    expect(t.find((p) => p.weekStart === '2026-08-10')!.machineMedianSeconds!).toBeLessThan(1100);
  });

  it('press_03 runs above the fleet reference for most weeks', async () => {
    const t = await getWeeklyCycleTrend(sql, 'press_03', 'all');
    expect(t.length).toBeGreaterThanOrEqual(5);
    const above = t.filter(
      (p) =>
        p.machineMedianSeconds !== null &&
        p.fleetMedianSeconds !== null &&
        p.machineMedianSeconds > p.fleetMedianSeconds,
    );
    expect(above.length).toBeGreaterThanOrEqual(4);
    for (const p of t) {
      if (p.fleetMedianSeconds !== null) {
        expect(p.fleetMedianSeconds).toBeGreaterThan(900);
        expect(p.fleetMedianSeconds).toBeLessThan(1200);
      }
    }
  });

  it('?window= scopes the trend', async () => {
    const all = await getWeeklyCycleTrend(sql, 'press_03', 'all');
    const scoped = await getWeeklyCycleTrend(sql, 'press_03', '2w');
    expect(scoped.length).toBeLessThan(all.length);
    for (const p of scoped) expect(p.weekStart >= '2026-07-27').toBe(true);
  });
});

describe('derived quality attribution (job → cycle join)', () => {
  it('press_03 attributed fail rate is 46.1%, flat with the fleet, badged derived, drillable', async () => {
    const a = await getQualityAttribution(sql, 'press_03');
    expect(a).not.toBeNull();
    expect(a!.failRatePct).toBe(46.1);
    expect(a!.provenance).toBe('derived');
    expect(a!.supportingEventIds.length).toBeGreaterThanOrEqual(1);
    for (const id of a!.supportingEventIds) expect(id).toMatch(/^evt_/);
  });

  it('attribution NEVER contains qc_01/qc_02 — only production presses, all flat 45.8–47.0%', async () => {
    const fleet = await getFleetAttribution(sql);
    expect(fleet.length).toBe(6);
    for (const row of fleet) {
      expect(row.machine_id).toMatch(/^press_/);
      expect(row.machine_id).not.toBe('qc_01');
      expect(row.machine_id).not.toBe('qc_02');
      expect(row.failRatePct).toBeGreaterThanOrEqual(45.8);
      expect(row.failRatePct).toBeLessThanOrEqual(47.0);
    }
    expect(await getQualityAttribution(sql, 'qc_01')).toBeNull();
    expect(await getQualityAttribution(sql, 'qc_02')).toBeNull();
  });
});

describe('affected work', () => {
  it('press_03 ran 72 jobs; open/risk work sorts first', async () => {
    const jobs = await getAffectedJobs(sql, 'press_03');
    expect(jobs.length).toBe(72);
    const statuses = new Set(['created', 'in_progress', 'blocked', 'held', 'completed']);
    for (const j of jobs) {
      expect(j.job_id).toMatch(/^job_/);
      expect(statuses.has(j.status)).toBe(true);
    }
    const firstCompleted = jobs.findIndex((j) => j.status === 'completed');
    if (firstCompleted !== -1) {
      for (const j of jobs.slice(firstCompleted)) expect(j.status).toBe('completed');
    }
    for (const j of jobs) {
      if (j.deliveryRisk === 'overdue') expect(j.status).not.toBe('completed');
    }
  });

  it('honors the facility filter', async () => {
    const all = await getAffectedJobs(sql, 'press_03');
    const la02 = await getAffectedJobs(sql, 'press_03', 'la_02');
    expect(la02.length).toBeLessThan(all.length);
    for (const j of la02) expect(j.facility_id).toBe('la_02');
  });
});

describe('evidence log', () => {
  it('press_06 log carries the incident event_ids; nothing after frozen NOW', async () => {
    const ev = await getEvidenceLog(sql, 'press_06');
    const ids = ev.map((e) => e.event_id);
    expect(ids).toContain('evt_010715');
    expect(ids).toContain('evt_011175');
    for (const e of ev) {
      expect(e.event_id).toMatch(/^evt_/);
      expect(e.timestamp <= NOW_ISO).toBe(true);
    }
  });

  it('press_03 log surfaces slow cycles as evidence', async () => {
    const ev = await getEvidenceLog(sql, 'press_03');
    const slow = ev.filter(
      (e) => e.event_type === 'cycle_completed' && Number(e.metadata.cycle_time_seconds) > 1250,
    );
    expect(slow.length).toBeGreaterThanOrEqual(1);
  });
});

describe('alert summaries (/alerts)', () => {
  it('cycle-time, overdue, blocked, and recovered-incident rows, each with evidence', async () => {
    const alerts = await getAlertSummaries(sql);
    for (const a of alerts) {
      expect(a.explanation.length).toBeGreaterThan(0);
      expect(a.implicated_ids.length).toBeGreaterThanOrEqual(1);
      expect(a.supporting_event_ids.length).toBeGreaterThanOrEqual(1);
      expect(a.provenance).toBe('derived');
    }
    const cycle = alerts.find((a) => a.rule === 'cycle_time_vs_baseline');
    expect(cycle!.implicated_ids).toContain('press_03');
    expect(cycle!.href).toBe('/machines/press_03');
    const overdue = alerts.find((a) => a.rule === 'overdue_incomplete');
    expect(overdue!.explanation).toContain('26 jobs');
    expect(overdue!.businessImpact).toMatch(/\$590,4\d\d/);
    const blocked = alerts.find((a) => a.rule === 'blocked_or_held');
    expect(blocked!.explanation).toContain('9 jobs');
    const recovered = alerts.find((a) => a.rule === 'recovered_incident');
    expect(recovered!.implicated_ids).toContain('press_06');
    expect(recovered!.supporting_event_ids).toContain('evt_010715');
    expect(recovered!.explanation).toContain('followed by');
    expect(recovered!.explanation.toLowerCase()).not.toContain('caused');
  });
});
