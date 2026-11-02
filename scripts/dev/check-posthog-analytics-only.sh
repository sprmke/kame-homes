#!/usr/bin/env bash
# Guards the observability split (plan D1/D2): PostHog is analytics only, Sentry owns faults.
#
# Why a guard and not just a convention: the double-reporting this plan removed was not a
# decision anyone made, it was drift. `captureAppException` and `capturePostHogException`
# each looked reasonable at the call site, and the duplication only became visible when
# someone compared the two vendors' issue lists. A rule in a doc does not stop the next
# person adding the convenient one-liner back.
#
# Escape hatches are deliberately narrow: the Sentry modules (where the SDK's own
# `captureException` legitimately appears) and the shared scrub list.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# Paths allowed to contain error-capture APIs.
ALLOWED_RE='^(ui/src/lib/sentry/|supabase/functions/_shared/sentry|supabase/functions/_shared/telemetryScrub\.ts|supabase/functions/_shared/httpResponse\.ts)'

# Each pattern is a thing that must not exist in PostHog-facing code.
PATTERNS=(
  'captureAppException'
  'capturePostHogException'
  'posthog\.captureException'
  'capture_exceptions: true'
  '\$exception'
  'PostHogErrorBoundary'
)

fail=0

for pattern in "${PATTERNS[@]}"; do
  while IFS= read -r hit; do
    file="${hit%%:*}"
    if [[ "$file" =~ $ALLOWED_RE ]]; then
      continue
    fi
    echo "DISALLOWED: '$pattern' outside a Sentry module" >&2
    echo "  $hit" >&2
    fail=1
  done < <(
    if command -v rg >/dev/null 2>&1; then
      rg -n --no-heading "$pattern" ui/src supabase/functions \
        --glob '!**/*.test.ts' --glob '!**/*_test.ts' --glob '!**/node_modules/**' || true
    else
      grep -RnE "$pattern" ui/src supabase/functions 2>/dev/null \
        | grep -vE '\.(test|_test)\.ts' || true
    fi
  )
done

if [[ "$fail" -ne 0 ]]; then
  echo "" >&2
  echo "PostHog owns product outcomes only; Sentry owns faults." >&2
  echo "See docs/architecture/observability.md and plan phase P1." >&2
  exit 1
fi

echo "OK — PostHog exception capture is gone; errors belong to Sentry."
