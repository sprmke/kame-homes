#!/usr/bin/env bash
# CORS smoke for cost/abuse plan §2.4 — run against hosted dev or local functions.
# Usage: BASE_URL=https://<ref>.supabase.co/functions/v1 ./scripts/dev/check-cors-origins.sh
#
# Security property under test:
#   - an allowed origin gets a usable CORS response (echoed origin, or `*` on
#     public endpoints where the gateway answers the preflight itself)
#   - a blocked origin is never echoed back in Access-Control-Allow-Origin
#     (an absent header is the safest outcome and passes)
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:54321/functions/v1}"
PATH_SUFFIX="${CORS_PROBE_PATH:-/get-public-platform-status}"

ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-http://localhost:5173}"
BLOCKED_ORIGIN="${BLOCKED_ORIGIN:-https://evil-cors-probe.example}"

probe() {
  local origin="$1"
  curl -s -D - -o /dev/null -X OPTIONS \
    -H "Origin: ${origin}" \
    -H 'Access-Control-Request-Method: GET' \
    "${BASE_URL}${PATH_SUFFIX}" | tr -d '\r'
}

echo "== Allowed origin (${ALLOWED_ORIGIN}) =="
allowed_headers=$(probe "$ALLOWED_ORIGIN")
allowed_acao=$(echo "$allowed_headers" | grep -i "^access-control-allow-origin:" || true)
if [[ -z "$allowed_acao" ]]; then
  echo "Missing Access-Control-Allow-Origin for allowed origin" >&2
  echo "$allowed_headers"
  exit 1
fi
if ! echo "$allowed_acao" | grep -qiE ": (\*|${ALLOWED_ORIGIN})$"; then
  echo "Expected Allow-Origin to echo the allowed origin (or *)" >&2
  echo "$allowed_headers"
  exit 1
fi
echo "$allowed_acao"

echo "== Blocked origin (${BLOCKED_ORIGIN}) =="
blocked_headers=$(probe "$BLOCKED_ORIGIN")
if echo "$blocked_headers" | grep -qi "^access-control-allow-origin: ${BLOCKED_ORIGIN}$"; then
  echo "Blocked origin must not be echoed in Allow-Origin" >&2
  echo "$blocked_headers"
  exit 1
fi
if echo "$blocked_headers" | grep -qi "^access-control-allow-origin:"; then
  echo "blocked origin not echoed (gateway answered *)"
else
  echo "blocked origin not echoed (no Allow-Origin header)"
fi

echo "CORS probe OK."
