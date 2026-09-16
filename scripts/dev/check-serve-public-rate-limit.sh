#!/usr/bin/env bash
# Ensure scrapeable servePublic handlers import a rate limiter or are allowlisted.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

ALLOWLIST=(
  'paymongo-webhook'
  'approval-email-webhook'
  'meta-inbox-webhook'
  'push-fanout'
  'claim-sd-voucher'
  'submit-guest-review'
)

search_files() {
  if command -v rg >/dev/null 2>&1; then
    rg -l 'servePublic\(' supabase/functions --glob '**/index.ts'
  else
    grep -RIl --include='index.ts' 'servePublic(' supabase/functions
  fi
}

has_match() {
  local pattern="$1"
  local file="$2"
  if command -v rg >/dev/null 2>&1; then
    rg -q "$pattern" "$file"
  else
    grep -Eq "$pattern" "$file"
  fi
}

fail=0
while IFS= read -r file; do
  fn="$(basename "$(dirname "$file")")"
  for allowed in "${ALLOWLIST[@]}"; do
    if [[ "$fn" == "$allowed" ]]; then
      continue 2
    fi
  done
  if has_match 'publicGetRateLimitGate\(' "$file"; then
    if ! has_match "from ['\"].*publicEndpointRateLimit" "$file"; then
      echo "MISSING publicGetRateLimitGate import: $fn ($file)" >&2
      fail=1
      continue
    fi
    continue
  fi
  if has_match 'rateLimitGate|antiSpamGate|checkIpRateLimit' "$file"; then
    continue
  fi
  echo "MISSING rate limit: $fn ($file)" >&2
  fail=1
done < <(search_files)

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "OK — servePublic handlers have rate limit or are allowlisted."
