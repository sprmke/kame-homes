#!/usr/bin/env bash
# Checklist 38 — scan the full git history for secrets (gitleaks).
# Local/CI helper: skips with a hint when gitleaks is not installed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "check-gitleaks: gitleaks not installed — https://github.com/gitleaks/gitleaks"
  echo "check-gitleaks: SKIP (no scan ran)"
  exit 0
fi

report="$(mktemp)"
trap 'rm -f "$report"' EXIT

if gitleaks detect --source . --config .gitleaks.toml --report-format json --report-path "$report" --no-banner --redact >/dev/null 2>&1; then
  echo "check-gitleaks: OK — no secrets in history"
  exit 0
fi

echo "check-gitleaks: FINDINGS" >&2
python3 - "$report" <<'PY' >&2 || cat "$report" >&2
import json, sys
data = json.load(open(sys.argv[1]))
for finding in data[:50]:
    print(f"  {finding['RuleID']} {finding['File']}:{finding.get('StartLine')}")
print(f"  total: {len(data)}")
PY
exit 1
