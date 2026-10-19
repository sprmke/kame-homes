#!/usr/bin/env bash
# Doc 22 — ui/index.html must stay free of inline scripts and inline event handlers, so the
# Content-Security-Policy in ui/vercel.json can stay hash-free (Vite rewrites inline script
# whitespace at build time, which silently broke the old hash). Boot code lives in
# ui/public/theme-init.js and ui/public/async-styles.js. Name kept for the CI step.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INDEX="$ROOT/ui/index.html"
VERCEL="$ROOT/ui/vercel.json"

for f in "$INDEX" "$VERCEL" "$ROOT/ui/public/theme-init.js" "$ROOT/ui/public/async-styles.js"; do
  [[ -f "$f" ]] || { echo "check-csp-theme-hash: missing $f"; exit 1; }
done

node -e "
const fs = require('fs');
const html = fs.readFileSync(process.argv[1], 'utf8').replace(/<!--[\\s\\S]*?-->/g, '');
const problems = [];
for (const m of html.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/g)) {
  if (!/\\bsrc=/.test(m[1]) && m[2].trim()) problems.push('inline <script> body');
}
if (/<[a-z][^>]*\\son[a-z]+\\s*=/i.test(html)) problems.push('inline on* event handler');
const csp = fs.readFileSync(process.argv[2], 'utf8');
if (/'unsafe-inline'[^;]*;?/.test((csp.match(/script-src[^;]*/) || [''])[0])) problems.push(\"script-src allows 'unsafe-inline'\");
if (problems.length) { console.error('check-csp-theme-hash: ' + problems.join(', ')); process.exit(1); }
" "$INDEX" "$VERCEL"

echo "check-csp-theme-hash: OK (no inline scripts or handlers in ui/index.html)"
