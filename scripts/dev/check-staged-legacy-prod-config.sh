#!/usr/bin/env bash
# Refuse committing legacy prod backup artifacts (plan kamespace-01 B-03).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

staged_files=$(git diff --cached --name-only --diff-filter=ACM)
[[ -z "$staged_files" ]] && exit 0

found=0

while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  case "$f" in
    *.legacy-prod.local | backups/legacy-prod-config/* | *.tar.age)
      echo "❌ check-staged-legacy-prod-config: refusing to commit legacy backup path: $f"
      found=1
      ;;
  esac
done <<<"$staged_files"

if [[ "$found" -eq 1 ]]; then
  exit 1
fi

exit 0
