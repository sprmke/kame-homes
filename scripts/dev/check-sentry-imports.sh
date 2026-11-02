#!/usr/bin/env bash
# Keeps one Sentry entry point in the browser bundle.
#
# The SDK is ~55 KiB gzip of the initial chunk (measured in plan phase S0.1). A second
# static import from a feature module would not fail the build or any test, it would just
# make the bundle planner's chunk assumptions wrong and eventually cost every visitor.
# Every SDK call goes through `ui/src/lib/sentry/**` instead.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

fail=0

while IFS= read -r hit; do
  file="${hit%%:*}"
  case "$file" in
    ui/src/lib/sentry/*) continue ;;
  esac
  echo "DISALLOWED: @sentry import outside ui/src/lib/sentry" >&2
  echo "  $hit" >&2
  fail=1
done < <(
  if command -v rg >/dev/null 2>&1; then
    rg -n --no-heading "from '@sentry/|require\('@sentry/" ui/src \
      --glob '!**/*.test.ts' --glob '!**/node_modules/**' || true
  else
    grep -RnE "from '@sentry/|require\('@sentry/" ui/src 2>/dev/null \
      | grep -vE '\.test\.ts' || true
  fi
)

if [[ "$fail" -ne 0 ]]; then
  echo "" >&2
  echo "Import from @/lib/sentry/{init,capture,scope,router} instead." >&2
  exit 1
fi

echo "OK — the Sentry SDK has a single import surface."
