#!/usr/bin/env bash
# Production-readiness doc 00 Phase 0.3 — snapshot pg_stat_statements top-50 on hosted dev.
# Requires session pooler URI in DEV_DB_URL (supabase/.env.dev.local). Read-only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=scripts/dev/check-linked-project.sh
source "$ROOT/scripts/dev/check-linked-project.sh"

LABEL="${1:-hosted-dev}"
OUT_DIR="$ROOT/docs/workflow/planned/production-readiness-checklist/baselines"
STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
OUT_JSON="$OUT_DIR/${STAMP%%T*}-pg-stat-statements-${LABEL}.json"

DB_URL="${DEV_DB_URL:-}"
[[ -z "$DB_URL" ]] && DB_URL="$(read_env_file_var "$ROOT/supabase/.env.dev.local" "DEV_DB_URL")"

if [[ -z "$DB_URL" ]]; then
  echo "capture-pg-stat-statements: set DEV_DB_URL or add to supabase/.env.dev.local"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "capture-pg-stat-statements: psql not found"
  exit 1
fi

ext="$(psql "$DB_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'")"
if [[ "$ext" != "1" ]]; then
  echo "capture-pg-stat-statements: pg_stat_statements extension not enabled on this database"
  exit 1
fi

mkdir -p "$OUT_DIR"

rows="$(psql "$DB_URL" -v ON_ERROR_STOP=1 -At -F $'\t' <<'SQL'
SELECT
  left(regexp_replace(query, E'[\\n\\r\\t]+', ' ', 'g'), 500),
  calls::text,
  round(mean_exec_time::numeric, 3)::text,
  round(total_exec_time::numeric, 3)::text,
  rows::text
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY total_exec_time DESC
LIMIT 50;
SQL
)"

node -e "
const fs = require('fs');
const label = process.argv[1];
const outPath = process.argv[2];
const raw = process.argv[3];
const statements = raw
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [query, calls, meanMs, totalMs, rows] = line.split('\t');
    return {
      queryPreview: query,
      calls: Number(calls),
      meanExecTimeMs: Number(meanMs),
      totalExecTimeMs: Number(totalMs),
      rows: Number(rows),
    };
  });
const doc = {
  capturedAt: new Date().toISOString(),
  label,
  mode: 'hosted-dev-pg_stat_statements',
  limit: 50,
  statements,
};
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n');
console.log('wrote ' + outPath + ' (' + statements.length + ' rows)');
" "$LABEL" "$OUT_JSON" "$rows"
