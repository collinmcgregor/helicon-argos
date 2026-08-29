#!/usr/bin/env bash
# One-command, idempotent ingest: schema (drop/recreate) + bulk load of all
# 19,519 events via psql \copy. The repo CSV is missing five metadata columns
# (target_due_at, target_quantity, unit_price_estimate, lot_id, signal), so we
# regenerate a complete TSV from manufacturing_events.jsonl with jq.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f .env.local ]; then
    DATABASE_URL=$(grep -E '^DATABASE_URL=' .env.local | head -1 | cut -d= -f2- | tr -d '"')
    export DATABASE_URL
  fi
fi
[ -n "${DATABASE_URL:-}" ] || { echo "DATABASE_URL not set (env or .env.local)" >&2; exit 1; }

TSV=$(mktemp -t argos_events.XXXXXX.tsv)
trap 'rm -f "$TSV"' EXIT

jq -r '
  [ .event_id, .timestamp, .event_type, .job_id, .part_id, .customer_id,
    .machine_id, .material, .quantity,
    .metadata.facility, .metadata.priority, .metadata.tool_id,
    .metadata.cycle_time_seconds, .metadata.defect_code, .metadata.inspector_id,
    .metadata.operator_id, .metadata.good_quantity, .metadata.scrap_quantity,
    .metadata.reason, .metadata.target_due_at, .metadata.target_quantity,
    .metadata.unit_price_estimate, .metadata.lot_id, .metadata.signal ]
  | map(if . == null then "\\N" else tostring end) | join("\t")
' manufacturing_events.jsonl > "$TSV"

echo "Prepared $(wc -l < "$TSV" | tr -d ' ') rows -> $TSV"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -c "\\copy events (event_id, timestamp, event_type, job_id, part_id, customer_id, machine_id, material, quantity, facility, priority, tool_id, cycle_time_seconds, defect_code, inspector_id, operator_id, good_quantity, scrap_quantity, reason, target_due_at, target_quantity, unit_price_estimate, lot_id, signal) FROM '$TSV'" \
  -c "ANALYZE events;"

echo "Ingest complete."
