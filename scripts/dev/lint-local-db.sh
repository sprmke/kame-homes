#!/usr/bin/env bash
# `supabase db lint` for the local replay workflow, without the pg_cron false failures.
#
# The local Supabase database does not load the `pg_cron` extension, so functions that
# reference `cron.job` (the scheduled-job helpers) are reported as errors even though their
# bodies are valid on hosted, where pg_cron exists. Ignore exactly that message and fail on
# every other error (production-readiness ledger PR-139).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

OUTPUT="$(mktemp)"
trap 'rm -f "$OUTPUT"' EXIT

"$ROOT/scripts/dev/bunx" --bun supabase@latest db lint \
  --local --level warning --fail-on none --output-format json >"$OUTPUT" 2>&1 || true

python3 - "$OUTPUT" <<'PY'
import json
import sys

raw = open(sys.argv[1], encoding='utf-8').read()
start, end = raw.find('{'), raw.rfind('}')
if start < 0 or end < start:
    print('db lint: could not read JSON output', file=sys.stderr)
    print(raw[-2000:], file=sys.stderr)
    sys.exit(1)

payload = json.loads(raw[start : end + 1])
IGNORED = 'relation "cron.job" does not exist'

ignored = 0
errors = []
for result in payload.get('results', []):
    for issue in result.get('issues', []):
        if issue.get('level') != 'error':
            continue
        if issue.get('message') == IGNORED:
            ignored += 1
            continue
        errors.append((result.get('function', '?'), issue.get('message', '')))

if errors:
    print(f'db lint: {len(errors)} error(s)', file=sys.stderr)
    for function, message in errors:
        print(f'  {function}: {message}', file=sys.stderr)
    sys.exit(1)

print(f'db lint: 0 errors ({ignored} pg_cron reference(s) ignored, local stack has no pg_cron)')
PY
