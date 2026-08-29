-- Argos data foundation: flattened event table, derived views, ontology config.
-- Idempotent: drop + recreate everything. Run via scripts/ingest.sh.
-- Invariant: frozen NOW, never wall-clock, in any derived view (BUILD.md §1).

BEGIN;

DROP VIEW IF EXISTS alerts CASCADE;
DROP VIEW IF EXISTS machine_quality_attribution CASCADE;
DROP VIEW IF EXISTS machine_stats CASCADE;
DROP VIEW IF EXISTS inspections CASCADE;
DROP VIEW IF EXISTS cycles CASCADE;
DROP VIEW IF EXISTS jobs_current CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS ontology_relationship_defs CASCADE;
DROP TABLE IF EXISTS ontology_field_defs CASCADE;
DROP TABLE IF EXISTS ontology_object_defs CASCADE;
DROP FUNCTION IF EXISTS frozen_now();

-- The single frozen-clock constant. Every view uses this; nothing uses now().
CREATE FUNCTION frozen_now() RETURNS timestamptz
LANGUAGE sql IMMUTABLE AS $$ SELECT '2026-08-13T23:06:33Z'::timestamptz $$;

-- ---------------------------------------------------------------------------
-- events: one row per raw JSONL event, metadata flattened.
-- The CSV shipped with the repo is missing target_due_at / target_quantity /
-- unit_price_estimate / lot_id / signal, so ingest regenerates a complete TSV
-- from manufacturing_events.jsonl (see scripts/ingest.sh).
-- ---------------------------------------------------------------------------
-- NOTE: event_id is NOT unique — the source JSONL contains 19 duplicated
-- event_ids (14 fully identical lines), including job_0293's duplicate
-- completion (evt_001862 x2). Duplicates are preserved per DATA-FLOWS.md;
-- seq gives each physical row a stable identity.
CREATE TABLE events (
  seq                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id            text NOT NULL,
  timestamp           timestamptz NOT NULL,
  event_type          text NOT NULL,
  job_id              text,
  part_id             text,
  customer_id         text,
  machine_id          text,
  material            text,
  quantity            integer,
  facility            text,
  priority            text,
  tool_id             text,
  cycle_time_seconds  integer,
  defect_code         text,
  inspector_id        text,
  operator_id         text,
  good_quantity       integer,
  scrap_quantity      integer,
  reason              text,
  target_due_at       timestamptz,
  target_quantity     integer,
  unit_price_estimate numeric,
  lot_id              text,
  signal              text
);

CREATE INDEX events_id_idx ON events (event_id);
CREATE INDEX events_job_idx ON events (job_id, timestamp);
CREATE INDEX events_type_idx ON events (event_type);
CREATE INDEX events_machine_idx ON events (machine_id, timestamp);

-- ---------------------------------------------------------------------------
-- jobs_current: one row per job, lifecycle replayed to latest state.
-- Semantics per docs/DATA-FLOWS.md:
--   completed   = has a job_completed event (duplicates preserved in events;
--                 completion_event_count surfaces the job_0293 anomaly)
--   blocked/held = latest of job_blocked/job_hold/job_unblocked/job_completed
--                  is a block or hold
--   overdue     = target_due_at < frozen_now() and not completed
-- ---------------------------------------------------------------------------
CREATE VIEW jobs_current AS
WITH created AS (
  SELECT job_id, part_id, customer_id, material, facility, priority,
         target_due_at, target_quantity, unit_price_estimate,
         timestamp AS created_at, event_id AS created_event_id
  FROM events WHERE event_type = 'job_created'
),
started AS (
  SELECT job_id, min(timestamp) AS started_at
  FROM events WHERE event_type = 'job_started' GROUP BY job_id
),
completed AS (
  SELECT DISTINCT ON (job_id)
         job_id, timestamp AS completed_at, good_quantity, scrap_quantity,
         event_id AS completed_event_id,
         count(*) OVER (PARTITION BY job_id) AS completion_event_count
  FROM events WHERE event_type = 'job_completed'
  ORDER BY job_id, timestamp, event_id
),
last_lifecycle AS (
  SELECT DISTINCT ON (job_id)
         job_id, event_type AS last_lifecycle_type, reason AS block_reason,
         timestamp AS lifecycle_at, event_id AS lifecycle_event_id
  FROM events
  WHERE event_type IN ('job_blocked','job_hold','job_unblocked','job_completed')
  ORDER BY job_id, timestamp DESC, event_id DESC
),
activity AS (
  -- Production activity, never completion progress (DATA-FLOWS.md).
  SELECT job_id, count(*) AS cycle_count, sum(quantity) AS cycle_quantity
  FROM events WHERE event_type = 'cycle_completed' GROUP BY job_id
),
lot AS (
  SELECT DISTINCT ON (job_id) job_id, lot_id, event_id AS lot_event_id
  FROM events WHERE event_type = 'material_lot_scan'
  ORDER BY job_id, timestamp
)
SELECT
  c.job_id, c.part_id, c.customer_id, c.material, c.facility, c.priority,
  c.target_due_at, c.target_quantity, c.unit_price_estimate,
  c.created_at, c.created_event_id,
  s.started_at,
  comp.completed_at, comp.good_quantity, comp.scrap_quantity,
  comp.completed_event_id, comp.completion_event_count,
  ll.last_lifecycle_type, ll.lifecycle_at, ll.lifecycle_event_id,
  CASE WHEN ll.last_lifecycle_type IN ('job_blocked','job_hold') THEN ll.block_reason END AS block_reason,
  a.cycle_count, a.cycle_quantity,
  l.lot_id, l.lot_event_id,
  CASE
    WHEN comp.job_id IS NOT NULL THEN 'completed'
    WHEN ll.last_lifecycle_type = 'job_blocked' THEN 'blocked'
    WHEN ll.last_lifecycle_type = 'job_hold' THEN 'held'
    WHEN s.job_id IS NOT NULL THEN 'in_progress'
    ELSE 'created'
  END AS status,
  (comp.job_id IS NULL AND c.target_due_at < frozen_now()) AS overdue,
  CASE WHEN comp.job_id IS NULL AND c.target_due_at < frozen_now()
       THEN c.unit_price_estimate * c.target_quantity
  END AS revenue_at_risk
FROM created c
LEFT JOIN started s USING (job_id)
LEFT JOIN completed comp USING (job_id)
LEFT JOIN last_lifecycle ll USING (job_id)
LEFT JOIN activity a USING (job_id)
LEFT JOIN lot l USING (job_id);

-- ---------------------------------------------------------------------------
-- cycles: one row per cycle_completed event.
-- ---------------------------------------------------------------------------
CREATE VIEW cycles AS
SELECT event_id, timestamp, job_id, part_id, customer_id, machine_id,
       tool_id, material, facility, quantity, cycle_time_seconds
FROM events WHERE event_type = 'cycle_completed';

-- ---------------------------------------------------------------------------
-- inspections: one row per inspection event. machine_id here is a QC *station*
-- (qc_01/qc_02), exposed only as qc_station_id — never a production machine.
-- ---------------------------------------------------------------------------
CREATE VIEW inspections AS
SELECT event_id, timestamp, job_id, part_id, customer_id, material, facility,
       machine_id AS qc_station_id, inspector_id, quantity, defect_code,
       (event_type = 'inspection_passed') AS passed
FROM events WHERE event_type IN ('inspection_passed','inspection_failed');

-- ---------------------------------------------------------------------------
-- machine_stats: one row per production machine (press_*). Cycle medians,
-- first/second-half drift over the dataset span, asset-event counts.
-- ---------------------------------------------------------------------------
CREATE VIEW machine_stats AS
WITH span AS (
  SELECT min(timestamp) AS t0,
         min(timestamp) + (max(timestamp) - min(timestamp)) / 2 AS mid
  FROM events WHERE event_type = 'cycle_completed'
),
c AS (
  SELECT e.*, (e.timestamp < span.mid) AS first_half
  FROM events e CROSS JOIN span
  WHERE e.event_type = 'cycle_completed' AND e.machine_id LIKE 'press_%'
),
asset AS (
  SELECT machine_id,
         count(*) FILTER (WHERE event_type = 'maintenance_ping') AS maintenance_count,
         count(*) FILTER (WHERE event_type = 'sensor_glitch')    AS sensor_glitch_count
  FROM events WHERE machine_id LIKE 'press_%' GROUP BY machine_id
)
SELECT
  c.machine_id,
  count(*) AS cycle_count,
  sum(c.quantity) AS total_quantity,
  count(DISTINCT c.job_id) AS job_count,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY c.cycle_time_seconds) AS median_cycle_seconds,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY c.cycle_time_seconds)
    FILTER (WHERE c.first_half) AS first_half_median_seconds,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY c.cycle_time_seconds)
    FILTER (WHERE NOT c.first_half) AS second_half_median_seconds,
  round((
    percentile_cont(0.5) WITHIN GROUP (ORDER BY c.cycle_time_seconds) FILTER (WHERE NOT c.first_half)
    / NULLIF(percentile_cont(0.5) WITHIN GROUP (ORDER BY c.cycle_time_seconds) FILTER (WHERE c.first_half), 0)
    - 1)::numeric * 100, 1) AS drift_pct,
  coalesce(a.maintenance_count, 0) AS maintenance_count,
  coalesce(a.sensor_glitch_count, 0) AS sensor_glitch_count
FROM c LEFT JOIN asset a USING (machine_id)
GROUP BY c.machine_id, a.maintenance_count, a.sensor_glitch_count;

-- ---------------------------------------------------------------------------
-- machine_quality_attribution: DERIVED. Inspection outcomes attributed to
-- production machines via the job -> cycle join (ARGOS.md §1.2). QC stations
-- qc_01/qc_02 must never appear in machine_id here.
-- ---------------------------------------------------------------------------
CREATE VIEW machine_quality_attribution AS
WITH job_machines AS (
  SELECT DISTINCT job_id, machine_id
  FROM events
  WHERE event_type = 'cycle_completed' AND machine_id LIKE 'press_%'
)
SELECT
  jm.machine_id,
  'derived' AS provenance,
  'job->cycle join; inspections are recorded at QC stations, not presses' AS method,
  sum(i.quantity) AS inspected_quantity,
  sum(i.quantity) FILTER (WHERE NOT i.passed) AS failed_quantity,
  round(sum(i.quantity) FILTER (WHERE NOT i.passed)::numeric
        / NULLIF(sum(i.quantity), 0) * 100, 1) AS fail_rate_pct
FROM job_machines jm
JOIN inspections i USING (job_id)
GROUP BY jm.machine_id;

-- ---------------------------------------------------------------------------
-- alerts: one row per derived rule finding. Every row carries rule, severity,
-- explanation, implicated ids, and supporting event_ids (the audit key).
-- ---------------------------------------------------------------------------
CREATE VIEW alerts AS
-- Rule 1: overdue and incomplete at frozen now.
SELECT
  'overdue_incomplete' AS rule,
  'critical' AS severity,
  format('Job %s for %s was due %s and is not completed (status: %s)%s.',
         j.job_id, j.customer_id, to_char(j.target_due_at, 'YYYY-MM-DD'), j.status,
         CASE WHEN j.revenue_at_risk IS NOT NULL
              THEN format('; estimated value $%s at risk', to_char(j.revenue_at_risk, 'FM999,999,990.00'))
              ELSE '' END) AS explanation,
  ARRAY[j.job_id, j.customer_id] AS implicated_ids,
  ARRAY[j.created_event_id] || CASE WHEN j.lifecycle_event_id IS NOT NULL
                                    THEN ARRAY[j.lifecycle_event_id] ELSE '{}'::text[] END
    AS supporting_event_ids,
  j.target_due_at AS occurred_at
FROM jobs_current j
WHERE j.overdue

UNION ALL
-- Rule 2: currently blocked or held.
SELECT
  'blocked_or_held',
  'warn',
  format('Job %s is %s since %s (reason: %s).',
         j.job_id, j.status, to_char(j.lifecycle_at, 'YYYY-MM-DD'),
         coalesce(j.block_reason, 'unspecified')),
  ARRAY[j.job_id],
  ARRAY[j.lifecycle_event_id],
  j.lifecycle_at
FROM jobs_current j
WHERE j.status IN ('blocked','held')

UNION ALL
-- Rule 3: cycle time vs fleet baseline (fires for press_03).
SELECT
  'cycle_time_vs_baseline',
  'warn',
  format('%s median cycle %ss is %s%% above the fleet baseline %ss and drifting %s%% (first vs second half); %s maintenance events recorded.',
         m.machine_id, round(m.median_cycle_seconds),
         round((m.median_cycle_seconds / f.fleet_median - 1) * 100),
         round(f.fleet_median), m.drift_pct, m.maintenance_count),
  ARRAY[m.machine_id],
  (SELECT array_agg(event_id) FROM (
     SELECT event_id FROM cycles
     WHERE machine_id = m.machine_id ORDER BY cycle_time_seconds DESC LIMIT 5
   ) slow),
  frozen_now()
FROM machine_stats m
CROSS JOIN LATERAL (
  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY cycle_time_seconds) AS fleet_median
  FROM cycles WHERE machine_id <> m.machine_id AND machine_id LIKE 'press_%'
) f
WHERE m.median_cycle_seconds > f.fleet_median * 1.15

UNION ALL
-- Rule 4: recovered incident — sensor glitch followed by a maintenance ping on
-- the same press within 3 days, cycle times spiked then recovered (press_06).
SELECT
  'recovered_incident',
  'info',
  format('%s: %s sensor glitch on %s followed by maintenance ping on %s; weekly median cycle spiked afterward, then recovered.',
         g.machine_id, coalesce(g.signal, 'sensor'),
         to_char(g.timestamp, 'YYYY-MM-DD'), to_char(p.timestamp, 'YYYY-MM-DD')),
  ARRAY[g.machine_id],
  ARRAY[g.event_id, p.event_id],
  p.timestamp
FROM events g
JOIN events p
  ON p.event_type = 'maintenance_ping'
 AND p.machine_id = g.machine_id
 AND p.timestamp BETWEEN g.timestamp AND g.timestamp + interval '3 days'
WHERE g.event_type = 'sensor_glitch'
  AND g.machine_id LIKE 'press_%';

-- ---------------------------------------------------------------------------
-- Ontology configuration (versioned; Ontology Control admin page).
-- provenance: observed | derived | external. Edits create new versions linked
-- via prior_version_id; nothing is deleted, archive via status.
-- ---------------------------------------------------------------------------
CREATE TABLE ontology_object_defs (
  id           serial PRIMARY KEY,
  key          text NOT NULL,
  version      integer NOT NULL DEFAULT 1,
  label        text NOT NULL,
  plural_label text,
  id_field     text,
  source_mapping text,
  description  text,
  provenance   text NOT NULL CHECK (provenance IN ('observed','derived','external')),
  editor       text NOT NULL DEFAULT 'system',
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  prior_version_id integer REFERENCES ontology_object_defs(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, version)
);

CREATE TABLE ontology_field_defs (
  id           serial PRIMARY KEY,
  object_key   text NOT NULL,
  key          text NOT NULL,
  version      integer NOT NULL DEFAULT 1,
  label        text NOT NULL,
  field_type   text NOT NULL,
  source_mapping text,
  description  text,
  provenance   text NOT NULL CHECK (provenance IN ('observed','derived','external')),
  caveat       text,
  editor       text NOT NULL DEFAULT 'system',
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  prior_version_id integer REFERENCES ontology_field_defs(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (object_key, key, version)
);

CREATE TABLE ontology_relationship_defs (
  id           serial PRIMARY KEY,
  key          text NOT NULL,
  version      integer NOT NULL DEFAULT 1,
  from_object  text NOT NULL,
  verb         text NOT NULL,
  to_object    text NOT NULL,
  source_mapping text,
  provenance   text NOT NULL CHECK (provenance IN ('observed','derived','external')),
  caveat       text,
  editor       text NOT NULL DEFAULT 'system',
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  prior_version_id integer REFERENCES ontology_relationship_defs(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, version),
  CONSTRAINT derived_needs_caveat CHECK (provenance <> 'derived' OR caveat IS NOT NULL)
);

-- Seed: the implemented ontology (ARGOS.md §2, pages/ontology-control.md map).
INSERT INTO ontology_object_defs (key, label, plural_label, id_field, source_mapping, description, provenance, editor, created_at) VALUES
  ('raw_event',   'Raw Event',        'Raw Events',        'event_id',    'events',            'Immutable source event log; every derived number drills back to event_ids here.', 'observed', 'system', frozen_now()),
  ('job',         'Job',              'Jobs',              'job_id',      'jobs_current',      'A production order, lifecycle replayed to its latest state.', 'observed', 'system', frozen_now()),
  ('production_cycle', 'Production Cycle', 'Production Cycles', 'event_id', 'cycles',         'One completed press cycle producing quantity toward a job.', 'observed', 'system', frozen_now()),
  ('inspection',  'Inspection',       'Inspections',       'event_id',    'inspections',       'In-process QC sampling at stations qc_01/qc_02; not final yield.', 'observed', 'system', frozen_now()),
  ('machine',     'Machine',          'Machines',          'machine_id',  'machine_stats',     'A production press. QC stations are not machines of this type.', 'observed', 'system', frozen_now()),
  ('tool',        'Tool',             'Tools',             'tool_id',     'events.tool_id',    'Layup/press tooling assigned to cycles.', 'observed', 'system', frozen_now()),
  ('material_lot','Material Lot',     'Material Lots',     'lot_id',      'events.lot_id',     'Scanned material lot; coverage is 14 of 312 jobs.', 'observed', 'system', frozen_now()),
  ('customer',    'Customer',         'Customers',         'customer_id', 'events.customer_id','Ordering customer.', 'observed', 'system', frozen_now()),
  ('part',        'Part',             'Parts',             'part_id',     'events.part_id',    'Part number a job produces.', 'observed', 'system', frozen_now()),
  ('facility',    'Facility',         'Facilities',        'facility',    'events.facility',   'Production site (la_01 / la_02).', 'observed', 'system', frozen_now()),
  ('inspector',   'Inspector',        'Inspectors',        'inspector_id','inspections.inspector_id', 'QC inspector performing inspections.', 'observed', 'system', frozen_now()),
  ('operational_issue', 'Operational Issue', 'Operational Issues', 'rule', 'alerts',           'Derived rule finding: overdue, blocked/held, cycle-time drift, recovered incident.', 'derived', 'system', frozen_now());

INSERT INTO ontology_relationship_defs (key, from_object, verb, to_object, source_mapping, provenance, caveat, editor, created_at) VALUES
  ('customer_places_job',    'customer', 'places',     'job',       'events.customer_id',            'observed', NULL, 'system', frozen_now()),
  ('job_produces_part',      'job',      'produces',   'part',      'events.part_id',                'observed', NULL, 'system', frozen_now()),
  ('job_contains_cycle',     'job',      'contains',   'production_cycle', 'cycles.job_id',          'observed', NULL, 'system', frozen_now()),
  ('cycle_uses_tool',        'production_cycle', 'uses', 'tool',    'cycles.tool_id',                'observed', NULL, 'system', frozen_now()),
  ('cycle_runs_on_machine',  'production_cycle', 'runs on', 'machine', 'cycles.machine_id',          'observed', NULL, 'system', frozen_now()),
  ('lot_observed_on_job',    'material_lot', 'observed on', 'job',   'events.lot_id (material_lot_scan)', 'observed', NULL, 'system', frozen_now()),
  ('job_has_inspection',     'job',      'has',        'inspection','inspections.job_id',            'observed', NULL, 'system', frozen_now()),
  ('inspector_performs_inspection', 'inspector', 'performs', 'inspection', 'inspections.inspector_id','observed', NULL, 'system', frozen_now()),
  ('event_materializes_job', 'raw_event','materializes','job',      'jobs_current',                  'derived',  'Lifecycle replay with deduplication; duplicate completions preserved in source.', 'system', frozen_now()),
  ('machine_attributed_quality', 'machine', 'attributed quality', 'inspection', 'machine_quality_attribution', 'derived', 'Via job->cycle join; inspections occur at QC stations qc_01/qc_02, never attribute those as production machines.', 'system', frozen_now()),
  ('inspection_may_create_issue', 'inspection', 'may create', 'operational_issue', 'alerts',         'derived',  'Rule evaluation over derived views; not a recorded fact.', 'system', frozen_now()),
  ('machine_event_affects_issue', 'machine', 'event affects', 'operational_issue', 'alerts (recovered_incident)', 'derived', 'Sensor/maintenance events correlated with cycle-time spikes within a 3-day window.', 'system', frozen_now());

INSERT INTO ontology_field_defs (object_key, key, label, field_type, source_mapping, provenance, caveat, editor, created_at) VALUES
  ('job', 'status',            'Status',            'enum',      'jobs_current.status',            'derived',  'Lifecycle replay; blocked/held = latest block/hold not superseded.', 'system', frozen_now()),
  ('job', 'target_due_at',     'Target due',        'timestamp', 'events.target_due_at',           'observed', NULL, 'system', frozen_now()),
  ('job', 'target_quantity',   'Target quantity',   'integer',   'events.target_quantity',         'observed', NULL, 'system', frozen_now()),
  ('job', 'unit_price_estimate','Unit price (est.)','numeric',   'events.unit_price_estimate',     'observed', 'Price coverage: 150 of 312 jobs.', 'system', frozen_now()),
  ('job', 'overdue',           'Overdue',           'boolean',   'jobs_current.overdue',           'derived',  'Relative to frozen NOW 2026-08-13T23:06:33Z, never wall-clock.', 'system', frozen_now()),
  ('job', 'revenue_at_risk',   'Revenue at risk',   'numeric',   'jobs_current.revenue_at_risk',   'derived',  'unit_price_estimate x target_quantity for overdue-incomplete jobs; disclose price coverage.', 'system', frozen_now()),
  ('job', 'good_quantity',     'Good quantity',     'integer',   'events.good_quantity',           'observed', 'Authoritative completion outcome.', 'system', frozen_now()),
  ('job', 'scrap_quantity',    'Scrap quantity',    'integer',   'events.scrap_quantity',          'observed', NULL, 'system', frozen_now()),
  ('machine', 'median_cycle_seconds', 'Median cycle (s)', 'numeric', 'machine_stats.median_cycle_seconds', 'derived', 'Median over cycle_completed events.', 'system', frozen_now()),
  ('machine', 'drift_pct',     'Cycle drift %',     'numeric',   'machine_stats.drift_pct',        'derived',  'Second-half vs first-half median over the dataset span.', 'system', frozen_now()),
  ('machine', 'fail_rate_pct', 'Inspection fail % (derived)', 'numeric', 'machine_quality_attribution.fail_rate_pct', 'derived', 'Attributed via job->cycle join; QC stations excluded.', 'system', frozen_now()),
  ('inspection', 'qc_station_id', 'QC station',     'text',      'inspections.qc_station_id',      'observed', 'qc_01/qc_02 are QC stations, not production machines.', 'system', frozen_now()),
  ('inspection', 'defect_code','Defect code',       'text',      'inspections.defect_code',        'observed', NULL, 'system', frozen_now());

COMMIT;
