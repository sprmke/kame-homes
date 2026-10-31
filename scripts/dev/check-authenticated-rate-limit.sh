#!/usr/bin/env bash
# Guard: serveAdmin / serveAuthenticated keep calling the per-user rate check
# (production-readiness doc 23 Phase 23.2/23.4). Enforcement itself is a
# super-admin runtime switch (`platform_settings.authenticated_rate_limit_enforce`),
# not a code path this script can observe — this only guards that a later edit
# cannot silently drop the wrapper-default check itself.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FILE="$ROOT/supabase/functions/_shared/serveEdge.ts"

if [[ ! -f "$FILE" ]]; then
  echo "MISSING $FILE" >&2
  exit 1
fi

if ! grep -q 'async function enforceOrLogRateCheck' "$FILE"; then
  echo "MISSING enforceOrLogRateCheck in serveEdge.ts" >&2
  exit 1
fi

calls="$(grep -c 'enforceOrLogRateCheck(req, logPrefix,' "$FILE" || true)"
if [[ "$calls" -lt 2 ]]; then
  echo "serveAdmin/serveAuthenticated must each call enforceOrLogRateCheck (found $calls)" >&2
  exit 1
fi

if ! grep -q 'isIdentityBlocked(' "$FILE"; then
  echo "MISSING isIdentityBlocked manual-block check in serveEdge.ts" >&2
  exit 1
fi

echo "OK — authenticated wrappers still call enforceOrLogRateCheck ($calls sites) + isIdentityBlocked."
