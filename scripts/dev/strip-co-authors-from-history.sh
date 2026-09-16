#!/usr/bin/env bash
# Rewrite git history to remove Co-authored-by trailers from commit messages.
#
# Usage:
#   bash scripts/dev/strip-co-authors-from-history.sh [rev-range]
#
# Default rev-range: HEAD (all commits reachable from current branch tip).
# Example (last 5 commits only): HEAD~5..HEAD
#
# After running, you must force-push rewritten branches:
#   git push --force-with-lease origin <branch>
#
# Requires a clean working tree (commit or stash unstaged changes first).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree is not clean. Commit or stash changes before rewriting history." >&2
  exit 1
fi

REV_RANGE="${1:-HEAD}"
MSG_FILTER="$ROOT/scripts/dev/strip-commit-co-author-trailers.sh"

export FILTER_BRANCH_SQUELCH_WARNING=1

git filter-branch -f --msg-filter "
  tmp=\$(mktemp)
  cat >\"\$tmp\"
  bash \"$MSG_FILTER\" \"\$tmp\"
  cat \"\$tmp\"
  rm -f \"\$tmp\"
" "$REV_RANGE"

echo ""
echo "Done. Verify with: git log -5 --format='%B' | rg -i 'co-authored' || echo 'No co-author trailers in sample.'"
echo "Then force-push with lease: git push --force-with-lease origin \$(git branch --show-current)"
