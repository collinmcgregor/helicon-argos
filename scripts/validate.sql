-- Layer 1 data validation (TESTING.md). Run: npm run validate
-- Prints one row per check; any FAIL row makes the script exit non-zero
-- (via the RAISE at the end + ON_ERROR_STOP).
\set ON_ERROR_STOP on
\pset pager off

CREATE TEMP TABLE checks (ord serial, name text, status text, detail text);

-- Row counts
INSERT INTO checks (name, status, detail)
SELECT 'events count = 19519',
       CASE WHEN count(*) = 19519 THEN 'PASS' ELSE 'FAIL' END, count(*)::text
FROM events;

INSERT INTO checks (name, status, detail)
SELECT 'jobs count = 312',
       CASE WHEN count(*) = 312 THEN 'PASS' ELSE 'FAIL' END, count(*)::text
FROM jobs_current;

INSERT INTO checks (name, status, detail)
SELECT 'cycles count = 12965',
       CASE WHEN count(*) = 12965 THEN 'PASS' ELSE 'FAIL' END, count(*)::text
FROM cycles;

INSERT INTO checks (name, status, detail)
SELECT 'inspections count = 5153',
       CASE WHEN count(*) = 5153 THEN 'PASS' ELSE 'FAIL' END, count(*)::text
FROM inspections;

INSERT INTO checks (name, status, detail)
SELECT 'lot scans count = 14',
       CASE WHEN count(*) = 14 THEN 'PASS' ELSE 'FAIL' END, count(*)::text
FROM events WHERE event_type = 'material_lot_scan';

-- jobs_current status distribution: 281 completed, 15 in_progress,
-- 9 blocked/held, 7 created
INSERT INTO checks (name, status, detail)
SELECT 'status distribution 281/15/9/7',
       CASE WHEN count(*) FILTER (WHERE status = 'completed') = 281
             AND count(*) FILTER (WHERE status = 'in_progress') = 15
             AND count(*) FILTER (WHERE status IN ('blocked','held')) = 9
             AND count(*) FILTER (WHERE status = 'created') = 7
            THEN 'PASS' ELSE 'FAIL' END,
       format('completed=%s in_progress=%s blocked/held=%s created=%s',
              count(*) FILTER (WHERE status = 'completed'),
              count(*) FILTER (WHERE status = 'in_progress'),
              count(*) FILTER (WHERE status IN ('blocked','held')),
              count(*) FILTER (WHERE status = 'created'))
FROM jobs_current;

-- Duplicate completion for job_0293 is preserved, not collapsed
INSERT INTO checks (name, status, detail)
SELECT 'job_0293 duplicate completion preserved',
       CASE WHEN completion_event_count = 2 THEN 'PASS' ELSE 'FAIL' END,
       'completion_event_count=' || completion_event_count
FROM jobs_current WHERE job_id = 'job_0293';

-- Alerts: exactly 26 overdue-incomplete
INSERT INTO checks (name, status, detail)
SELECT 'overdue_incomplete alerts = 26',
       CASE WHEN count(*) = 26 THEN 'PASS' ELSE 'FAIL' END, count(*)::text
FROM alerts WHERE rule = 'overdue_incomplete';

-- Revenue at risk = $590,465 +/- $1
INSERT INTO checks (name, status, detail)
SELECT 'revenue at risk ~= $590,465 (+/- $1)',
       CASE WHEN sum(revenue_at_risk) BETWEEN 590464 AND 590466
            THEN 'PASS' ELSE 'FAIL' END,
       '$' || round(sum(revenue_at_risk), 2)::text
FROM jobs_current WHERE overdue;

-- Blocked/held alerts = 9; press_03 cycle-time alert; press_06 incident
INSERT INTO checks (name, status, detail)
SELECT 'blocked_or_held alerts = 9',
       CASE WHEN count(*) = 9 THEN 'PASS' ELSE 'FAIL' END, count(*)::text
FROM alerts WHERE rule = 'blocked_or_held';

INSERT INTO checks (name, status, detail)
SELECT 'cycle-time alert fires for press_03 only',
       CASE WHEN count(*) = 1
             AND bool_and('press_03' = ANY (implicated_ids))
            THEN 'PASS' ELSE 'FAIL' END, count(*)::text
FROM alerts WHERE rule = 'cycle_time_vs_baseline';

INSERT INTO checks (name, status, detail)
SELECT 'recovered incident fires for press_06',
       CASE WHEN count(*) = 1
             AND bool_and('press_06' = ANY (implicated_ids))
            THEN 'PASS' ELSE 'FAIL' END, count(*)::text
FROM alerts WHERE rule = 'recovered_incident';

-- machine_stats: press_03 median > 1250s; other presses within 949-1056s
INSERT INTO checks (name, status, detail)
SELECT 'press_03 median cycle > 1250s',
       CASE WHEN median_cycle_seconds > 1250 THEN 'PASS' ELSE 'FAIL' END,
       round(median_cycle_seconds)::text || 's'
FROM machine_stats WHERE machine_id = 'press_03';

INSERT INTO checks (name, status, detail)
SELECT 'other presses in 949-1056s band',
       CASE WHEN count(*) = 5
             AND bool_and(median_cycle_seconds BETWEEN 949 AND 1056)
            THEN 'PASS' ELSE 'FAIL' END,
       string_agg(machine_id || '=' || round(median_cycle_seconds), ' ' ORDER BY machine_id)
FROM machine_stats WHERE machine_id <> 'press_03';

-- No QC station in any production-machine attribution column
INSERT INTO checks (name, status, detail)
SELECT 'no qc_01/qc_02 in production-machine columns',
       CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END, n::text || ' contaminated rows'
FROM (
  SELECT count(*) AS n FROM (
    SELECT machine_id FROM machine_stats WHERE machine_id IN ('qc_01','qc_02')
    UNION ALL
    SELECT machine_id FROM machine_quality_attribution WHERE machine_id IN ('qc_01','qc_02')
    UNION ALL
    SELECT machine_id FROM cycles WHERE machine_id IN ('qc_01','qc_02')
    UNION ALL
    SELECT unnest(implicated_ids) FROM alerts
    WHERE rule IN ('cycle_time_vs_baseline','recovered_incident')
      AND implicated_ids && ARRAY['qc_01','qc_02']
  ) contaminated
) t;

-- Every alert row carries at least one supporting event_id
INSERT INTO checks (name, status, detail)
SELECT 'every alert has >= 1 supporting event_id',
       CASE WHEN count(*) FILTER (WHERE coalesce(array_length(supporting_event_ids, 1), 0) = 0) = 0
            THEN 'PASS' ELSE 'FAIL' END,
       count(*)::text || ' alert rows'
FROM alerts;

-- Ontology config is seeded and versioned correctly
INSERT INTO checks (name, status, detail)
SELECT 'ontology config seeded (objects/relationships/fields)',
       CASE WHEN (SELECT count(*) FROM ontology_object_defs WHERE status = 'active') >= 12
             AND (SELECT count(*) FROM ontology_relationship_defs WHERE status = 'active') >= 12
             AND (SELECT count(*) FROM ontology_field_defs WHERE status = 'active') >= 13
             AND NOT EXISTS (SELECT 1 FROM ontology_relationship_defs
                             WHERE provenance = 'derived' AND caveat IS NULL)
            THEN 'PASS' ELSE 'FAIL' END,
       format('objects=%s rels=%s fields=%s',
              (SELECT count(*) FROM ontology_object_defs),
              (SELECT count(*) FROM ontology_relationship_defs),
              (SELECT count(*) FROM ontology_field_defs));

-- No wall-clock leak: nothing in the data is newer than frozen NOW
INSERT INTO checks (name, status, detail)
SELECT 'no event newer than frozen NOW',
       CASE WHEN max(timestamp) <= frozen_now() THEN 'PASS' ELSE 'FAIL' END,
       'max=' || max(timestamp)::text
FROM events;

SELECT status, name, detail FROM checks ORDER BY ord;

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM checks WHERE status = 'FAIL';
  IF n > 0 THEN
    RAISE EXCEPTION 'validate.sql: % check(s) FAILED', n;
  END IF;
  RAISE NOTICE 'validate.sql: all % checks passed', (SELECT count(*) FROM checks);
END $$;
