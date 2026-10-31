#!/usr/bin/env bash
# Bump updated: frontmatter on staged intake scratchpads.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

today="$(date +%Y-%m-%d)"
staged="$(git diff --cached --name-only -- \
  'docs/workflow/intake/_to-prompt.md' \
  'docs/workflow/intake/_to-plan.md' || true)"
[[ -n "$staged" ]] || exit 0

while IFS= read -r file; do
  [[ -f "$file" ]] || continue
  if grep -q '^updated:' "$file"; then
    perl -pi -e "s/^updated: .*/updated: ${today}/" "$file"
    git add "$file"
  fi
done <<<"$staged"
