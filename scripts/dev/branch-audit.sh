#!/usr/bin/env bash
# Read-only branch audit. Never deletes, never checks out, never pushes.
#
# For every local and origin branch, prints:
#   merged    branch tip is an ancestor of develop
#   applied   patches from `git cherry` still missing from develop ("-" = applied)
#   newFiles  files the branch added that do not exist in develop
#   dirty     uncommitted files in a worktree checked out on that branch
#
# Usage:
#   bun run branch:audit                 # local + origin
#   bun run branch:audit -- --local      # local only
#   bun run branch:audit -- --remote     # origin only
#
# A branch is safe to delete only when merged=yes (or applied=0), newFiles=0 and dirty=0.
# See .agent/skills/branch-lifecycle/SKILL.md.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

BASE="${BASE_BRANCH:-develop}"
SCOPE="all"
for arg in "$@"; do
  case "$arg" in
    --local) SCOPE="local" ;;
    --remote) SCOPE="remote" ;;
    -h | --help)
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

if ! git rev-parse --verify --quiet "$BASE" >/dev/null; then
  echo "Base branch '$BASE' not found." >&2
  exit 1
fi

git fetch origin --prune --quiet 2>/dev/null || echo "warning: fetch failed, using local refs" >&2

# Newline-delimited list of branches whose worktree has uncommitted files.
# (bash 3.2 on macOS has no associative arrays.)
DIRTY_BRANCHES=""
while IFS= read -r line; do
  [[ "$line" == "worktree "* ]] || continue
  wt="${line#worktree }"
  [[ -d "$wt" ]] || continue
  if [[ -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ]]; then
    br="$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"
    if [[ -n "$br" && "$br" != "HEAD" ]]; then
      DIRTY_BRANCHES="${DIRTY_BRANCHES}${br}"$'\n'
    fi
  fi
done < <(git worktree list --porcelain)

audit_one() {
  local ref="$1" name="$2"
  local merged="no"
  git merge-base --is-ancestor "$ref" "$BASE" 2>/dev/null && merged="yes"

  local applied=0
  applied="$(git cherry "$BASE" "$ref" 2>/dev/null | grep -c '^+')"

  local new_files=0
  local mb
  mb="$(git merge-base "$BASE" "$ref" 2>/dev/null || true)"
  if [[ -n "$mb" ]]; then
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      git cat-file -e "$BASE:$f" 2>/dev/null || new_files=$((new_files + 1))
    done < <(git diff --name-status "$mb".."$ref" 2>/dev/null | awk '$1=="A"{print $2}')
  fi

  local dirty="clean"
  if printf '%s' "$DIRTY_BRANCHES" | grep -Fxq "$name"; then dirty="DIRTY"; fi

  local verdict
  if [[ "$merged" == "yes" ]] || [[ "$applied" -eq 0 ]]; then
    if [[ "$new_files" -eq 0 && "$dirty" == "clean" ]]; then
      verdict="delete-candidate"
    else
      verdict="check"
    fi
  else
    verdict="keep-unmerged"
  fi

  local last
  last="$(git log -1 --format='%ad' --date=short "$ref" 2>/dev/null)"
  printf '%-46s %-6s %-8s %-8s %-8s %-10s %s\n' \
    "$name" "$merged" "$applied" "$new_files" "$dirty" "$verdict" "$last"
}

printf '%-46s %-6s %-8s %-8s %-8s %-10s %s\n' \
  BRANCH MERGED UNAPPLIED NEWFILES WORKTREE VERDICT LAST

if [[ "$SCOPE" != "remote" ]]; then
  while IFS= read -r b; do
    [[ "$b" == "$BASE" || "$b" == "main" ]] && continue
    audit_one "refs/heads/$b" "$b"
  done < <(git for-each-ref --format='%(refname:short)' refs/heads)
fi

if [[ "$SCOPE" != "local" ]]; then
  while IFS= read -r b; do
    [[ -z "$b" ]] && continue
    audit_one "refs/remotes/origin/$b" "origin/$b"
  done < <(git for-each-ref --format='%(refname:short)' refs/remotes/origin |
    sed -n 's|^origin/||p' | grep -vE '^(HEAD|develop|main)$')
fi

cat <<'EOF'

Verdicts:
  delete-candidate  merged or fully applied, no new files, no dirty worktree
  check             a file it added is missing from develop, or a worktree has uncommitted files
  keep-unmerged     patches still missing from develop

Nothing was deleted. Report first; delete only after the user agrees.
EOF
