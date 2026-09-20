#!/usr/bin/env bash
# Guards production-readiness doc 11 (cache API responses) Phase 11.1/11.7:
# `jsonSuccess`/`jsonResponse`/`jsonSuccessWithETag` default to the safe
# `private` cache class (`private, no-store`) when no class is passed, so a
# forgotten annotation fails closed rather than open — but that also means a
# genuinely public endpoint that forgets to pass a `public*` class silently
# stays private (a correctness bug, not a leak) and, the more dangerous
# direction, a `public*` class pasted onto the wrong endpoint silently makes
# a tenant/guest-PII response publicly cacheable (a cross-tenant leak).
#
# This is a two-way allowlist, same shape as check-serve-public-rate-limit.sh:
#   PUBLIC_CACHE_FILES  — functions that MUST use a `public*` class at least
#                         once (the deliberately-classified public surface).
#   Anything NOT in that list is flagged if it uses a `public*` class anyway —
#   that's either a new public endpoint that needs security review and adding
#   here, or a copy-pasted class that doesn't belong on that response.
#
# Not a parser — a ripgrep line-scan. It cannot see which cache class a given
# call site chose when a file has several `jsonSuccess`/`jsonResponse` calls
# with different classes (e.g. get-public-showcase's private preview branch
# alongside its publicDynamic branch) — that granularity is a code-review
# concern, not a CI-guard one. What it enforces is coarser and cheap: a
# public-classified file must have at least one `public*` call site, and a
# non-allowlisted file must have none.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# Functions deliberately classified with a `publicStatic`/`publicDynamic`/
# `publicAvailability` cache class in supabase/functions/_shared/httpResponse.ts.
# Keep this in sync with docs/architecture/edge-functions.md's cache-class table
# and ui/src/pwa/shared.ts#SW_CACHEABLE_FUNCTIONS (the SW allowlist is a subset —
# not every public* endpoint needs offline runtime caching).
PUBLIC_CACHE_FILES=(
  'list-public-pricing-plans/index.ts'
  'get-residence-unit-types/index.ts'
  'get-public-property/index.ts'
  'get-public-parking/index.ts'
  'get-public-host/index.ts'
  'get-public-showcase/index.ts'
  'list-public-properties/index.ts'
  'list-public-parkings/index.ts'
  'list-public-developments/index.ts'
  'list-public-place-groups/index.ts'
  'search-listings/index.ts'
  'search-suggestions/index.ts'
  'get-booked-dates/index.ts'
)

is_allowlisted() {
  local fn="$1"
  for allowed in "${PUBLIC_CACHE_FILES[@]}"; do
    if [[ "$fn" == "$allowed" ]]; then
      return 0
    fi
  done
  return 1
}

PUBLIC_CLASS_PATTERN="'public(Static|Dynamic|Availability)'"

search_files_with_public_class() {
  if command -v rg >/dev/null 2>&1; then
    rg -l "$PUBLIC_CLASS_PATTERN" supabase/functions --glob '**/index.ts' --glob '!**/*_test.ts'
  else
    grep -RIlE --include='index.ts' "$PUBLIC_CLASS_PATTERN" supabase/functions
  fi
}

has_public_class() {
  local file="$1"
  if command -v rg >/dev/null 2>&1; then
    rg -q "$PUBLIC_CLASS_PATTERN" "$file"
  else
    grep -Eq "$PUBLIC_CLASS_PATTERN" "$file"
  fi
}

fail=0

# 1. Every allowlisted file must actually use a public* class somewhere.
for fn in "${PUBLIC_CACHE_FILES[@]}"; do
  file="supabase/functions/$fn"
  if [[ ! -f "$file" ]]; then
    echo "ALLOWLIST STALE: $fn no longer exists — remove from check-cache-class.sh" >&2
    fail=1
    continue
  fi
  if ! has_public_class "$file"; then
    echo "MISSING public cache class: $fn is allowlisted as a public endpoint but has no" \
      "'publicStatic'/'publicDynamic'/'publicAvailability' call site — did the code change" \
      "silently regress it to the private default?" >&2
    fail=1
  fi
done

# 2. No non-allowlisted function file may use a public* class.
while IFS= read -r file; do
  fn="${file#supabase/functions/}"
  if is_allowlisted "$fn"; then
    continue
  fi
  echo "UNEXPECTED public cache class: $fn uses 'publicStatic'/'publicDynamic'/" \
    "'publicAvailability' but is not in PUBLIC_CACHE_FILES in" \
    "scripts/dev/check-cache-class.sh. Caching an authenticated/tenant-scoped response" \
    "publicly is a cross-tenant data leak (doc 11 edge cases) — either this is a genuine" \
    "new public endpoint (add it to the allowlist deliberately, after security review) or" \
    "the class doesn't belong here." >&2
  fail=1
done < <(search_files_with_public_class)

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "OK — public cache classes match the deliberate allowlist."
