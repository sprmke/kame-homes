#!/usr/bin/env bash
# Block re-creation of retired docs paths — use docs/workflow/ instead.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VIOLATIONS=0

for retired in docs/superpowers docs/planning docs/todos; do
  if [[ -e "$ROOT/$retired" ]]; then
    echo "RETIRED PATH: $retired/ exists — use docs/workflow/planned (plans), docs/workflow/intake (specs), docs/README.md (GitHub backlog)."
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

if [[ "$VIOLATIONS" -gt 0 ]]; then
  exit 1
fi

# Workflow docs must not use YYYY-MM-DD- filename prefixes (not QA nums like 20-superhost.md)
while IFS= read -r -d '' f; do
  echo "DATE PREFIX: $(basename "$f") — use <slug>.md only (see .cursor/rules/plan-mode.mdc)."
  VIOLATIONS=$((VIOLATIONS + 1))
done < <(find "$ROOT/docs/workflow" -name '2[0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]-*.md' -print0 2>/dev/null)

if [[ "$VIOLATIONS" -gt 0 ]]; then
  exit 1
fi
