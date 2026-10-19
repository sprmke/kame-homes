#!/usr/bin/env bash
# Production-readiness doc 16: ui/vercel.json must keep explicit cache +
# security headers. This is a config check, not a deployed-preview curl.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FILE="$ROOT/ui/vercel.json"

if [[ ! -f "$FILE" ]]; then
  echo "ERROR: missing $FILE"
  exit 1
fi

fail=0
require() {
  local needle="$1"
  if ! grep -q "$needle" "$FILE"; then
    echo "ERROR: ui/vercel.json missing: $needle"
    fail=1
  fi
}

require 'must-revalidate'
require 'max-age=31536000, immutable'
require 'Strict-Transport-Security'
require 'X-Content-Type-Options'
require 'Referrer-Policy'
require 'Permissions-Policy'
require 'Content-Security-Policy-Report-Only'
require '/index.html'
require '/icons/'
require '/favicon/'
require '/templates/'
require '/images/'
require '/marketing/'
require '/avatars/'
require '/fonts/'
require '/worklets/'

# SPA fallback must skip hashed assets: a missing old chunk has to 404, not return index.html
# under the immutable /assets/* cache header.
if ! grep -qF '"source": "/((?!assets/).*)"' "$FILE"; then
  echo "ERROR: ui/vercel.json SPA rewrite must exclude /assets/ (\"source\": \"/((?!assets/).*)\")"
  fail=1
fi

if grep -q '"immutable"' "$FILE" && ! grep -q '/assets/' "$FILE"; then
  echo "ERROR: immutable present but /assets/ rule missing (immutable must stay hashed-only)"
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "ok: ui/vercel.json has required cache and security headers (doc 16)"
