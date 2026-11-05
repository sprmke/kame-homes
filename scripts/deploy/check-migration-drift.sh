#!/usr/bin/env bash
# Verify that every local migration is applied to the linked Supabase project.
#
# Plan: docs/workflow/planned/supabase-capacity-and-operational-readiness.md (Phase 8)
#
# Read-only: `supabase migration list --linked` only reads migration history.
# Run after a deploy (or before a release audit). Exit codes:
#   0 = local and remote migration history match
#   1 = drift detected
#   2 = could not reach the CLI / linked project
set -euo pipefail

if command -v supabase >/dev/null 2>&1; then
  SUPABASE_BIN=(supabase)
elif command -v bunx >/dev/null 2>&1; then
  SUPABASE_BIN=(bunx supabase@latest)
else
  echo "[migration-drift] neither supabase nor bunx is available" >&2
  exit 2
fi

if ! OUT="$("${SUPABASE_BIN[@]}" migration list --linked 2>/dev/null)"; then
  echo "[migration-drift] could not read migration history (is the project linked?)" >&2
  exit 2
fi

# Columns: Local | Remote | Time (UTC). A missing side is a drift.
DRIFT="$(printf '%s\n' "$OUT" | awk -F'|' '
  NF >= 3 {
    gsub(/[ \t]/, "", $1);
    gsub(/[ \t]/, "", $2);
    if ($1 ~ /^[0-9]+$/ && $2 == "") print "local-only  " $1;
    else if ($1 == "" && $2 ~ /^[0-9]+$/) print "remote-only " $2;
  }
')"

if [ -n "$DRIFT" ]; then
  echo "[migration-drift] drift detected:" >&2
  printf '%s\n' "$DRIFT" >&2
  exit 1
fi

LOCAL_COUNT="$(printf '%s\n' "$OUT" | awk -F'|' 'NF >= 3 { a=$1; gsub(/[ \t]/, "", a); if (a ~ /^[0-9]+$/) c++ } END { print c + 0 }')"
echo "[migration-drift] OK: ${LOCAL_COUNT} migrations match the linked project"
