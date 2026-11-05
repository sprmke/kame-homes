#!/usr/bin/env bash
# Refuse commits that stage local E2E screenshot artifacts (even via git add -f).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

staged_files=$(git diff --cached --name-only --diff-filter=ACM)
[[ -z "$staged_files" ]] && exit 0

found=0
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  case "$f" in
    ui/e2e/artifacts/*)
      if [[ "$f" != "ui/e2e/artifacts/.gitkeep" ]]; then
        echo "❌ check-staged-e2e-artifacts: local screenshot artifacts must not be committed: $f"
        found=1
      fi
      ;;
  esac
done <<<"$staged_files"

if [[ "$found" -ne 0 ]]; then
  echo "   Store under ui/e2e/artifacts/ (gitignored). Unstage: git restore --staged ui/e2e/artifacts/"
  exit 1
fi
