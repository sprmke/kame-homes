#!/usr/bin/env bash
# Doc 22 — inline theme boot script hash in ui/vercel.json must match ui/index.html.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INDEX="$ROOT/ui/index.html"
VERCEL="$ROOT/ui/vercel.json"

if [[ ! -f "$INDEX" || ! -f "$VERCEL" ]]; then
  echo "check-csp-theme-hash: missing index.html or vercel.json"
  exit 1
fi

expected="$(node -e "
const fs = require('fs');
const html = fs.readFileSync(process.argv[1], 'utf8');
const m = html.match(/<script>\\n([\\s\\S]*?)\\n    <\\/script>/);
if (!m) process.exit(2);
const crypto = require('crypto');
const hash = crypto.createHash('sha256').update(m[1]).digest('base64');
console.log('sha256-' + hash);
" "$INDEX")"

if ! grep -q "$expected" "$VERCEL"; then
  echo "check-csp-theme-hash: ui/vercel.json CSP must include script hash $expected"
  echo "Recompute after editing the inline theme script in ui/index.html."
  exit 1
fi

echo "check-csp-theme-hash: OK ($expected)"
