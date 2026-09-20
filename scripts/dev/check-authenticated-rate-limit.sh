#!/usr/bin/env bash
# Guard: serveAdmin / serveAuthenticated keep the log-only per-user rate check
# (production-readiness doc 23 Phase 23.2). Does not enforce a 429 — only that
# the wrapper still calls logOnlyRateCheck so a later edit cannot silently drop it.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FILE="$ROOT/supabase/functions/_shared/serveEdge.ts"

if [[ ! -f "$FILE" ]]; then
  echo "MISSING $FILE" >&2
  exit 1
fi

if ! grep -q 'async function logOnlyRateCheck' "$FILE"; then
  echo "MISSING logOnlyRateCheck in serveEdge.ts" >&2
  exit 1
fi

calls="$(grep -c 'void logOnlyRateCheck(' "$FILE" || true)"
if [[ "$calls" -lt 2 ]]; then
  echo "serveAdmin/serveAuthenticated must each call logOnlyRateCheck (found $calls)" >&2
  exit 1
fi

echo "OK — authenticated wrappers still call logOnlyRateCheck ($calls sites)."
