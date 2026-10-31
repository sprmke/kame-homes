#!/usr/bin/env bash
# Redeploy Edge Functions from an older git ref (rollback after a bad
# functions deploy). Uses a throwaway git worktree (.worktrees/, gitignored)
# so your current branch/working tree is untouched. Formalizes the manual
# pattern already documented in production-deployment.md §4
# ("git checkout main && npm run deploy:supabase:functions").
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

SUPABASE=("$ROOT/scripts/dev/bunx" --bun supabase@latest)
# shellcheck source=scripts/dev/check-linked-project.sh
source "$ROOT/scripts/dev/check-linked-project.sh"

ENV_ARG=""
GIT_REF=""
ALLOW_MULTI_TENANCY=false
DRY_RUN=false

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy/rollback-functions.sh <dev|prod> <git-ref> [options]

Checks out supabase/functions/ from <git-ref> into a throwaway git worktree,
then runs `supabase functions deploy` against the CURRENTLY LINKED <dev|prod>
project. Does not touch your current branch or working tree.

<git-ref> examples: main, a1b2c3d, HEAD~3, v1.2.0

Options:
  --allow-multi-tenancy   Skip the multi-tenancy schema guard
  --dry-run               Show the worktree + deploy commands; do not execute
  -h, --help              Show this help

Examples:
  bun run rollback:functions:dev -- main
  bun run rollback:functions:prod -- main    # requires kamewave
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    dev | prod)
      ENV_ARG="$1"
      shift
      ;;
    --allow-multi-tenancy)
      ALLOW_MULTI_TENANCY=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      if [[ -z "$GIT_REF" ]]; then
        GIT_REF="$1"
        shift
      else
        echo "Unexpected extra argument: $1" >&2
        usage >&2
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$ENV_ARG" || -z "$GIT_REF" ]]; then
  echo "Missing required arguments: <dev|prod> <git-ref>" >&2
  usage >&2
  exit 1
fi

if ! git rev-parse --verify "$GIT_REF" >/dev/null 2>&1; then
  echo "ERROR: '$GIT_REF' is not a valid git ref in this repo." >&2
  exit 1
fi

print_linked_project
if [[ -z "$LINKED_PROJECT_REF" ]]; then
  echo "" >&2
  echo "ERROR: No linked Supabase project (missing supabase/.temp/project-ref)." >&2
  echo "Link first: bunx supabase@latest link --project-ref <${ENV_ARG}-ref>" >&2
  exit 1
fi
if [[ "$LINKED_PROJECT_KIND" != "$ENV_ARG" ]]; then
  echo "" >&2
  echo "ERROR: You asked to roll back functions on '$ENV_ARG' but the linked project looks like '$LINKED_PROJECT_KIND' ($LINKED_PROJECT_REF)." >&2
  exit 1
fi

WORKTREE_DIR="$ROOT/.worktrees/rollback-functions-$(date -u +%Y%m%dT%H%M%SZ)"

cleanup() {
  git worktree remove --force "$WORKTREE_DIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if [[ "$DRY_RUN" == true ]]; then
  echo "[dry-run] git worktree add $WORKTREE_DIR $GIT_REF"
  echo "[dry-run] cd $WORKTREE_DIR && supabase functions deploy"
  exit 0
fi

echo "════════════════════════════════════════════════════════════"
echo "  ROLLBACK FUNCTIONS — $ENV_ARG"
echo "  Linked project: $LINKED_PROJECT_REF"
echo "  From git ref:   $GIT_REF"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Type $ENV_ARG to confirm redeploying Edge Functions from $GIT_REF:"
read -r confirm
if [[ "$confirm" != "$ENV_ARG" ]]; then
  echo "Aborted (expected: $ENV_ARG)."
  exit 1
fi

echo "→ git worktree add $WORKTREE_DIR $GIT_REF"
git worktree add "$WORKTREE_DIR" "$GIT_REF" >/dev/null

if [[ "$ALLOW_MULTI_TENANCY" != true ]]; then
  sd_cron="$WORKTREE_DIR/supabase/functions/sd-refund-cron/index.ts"
  property_scope="$WORKTREE_DIR/supabase/functions/_shared/propertyScope.ts"
  if [[ -f "$property_scope" ]] || grep -q "property_id" "$sd_cron" 2>/dev/null; then
    echo "Refusing: $GIT_REF's functions include multi-tenancy edge code (see deploy-supabase.sh guard)." >&2
    echo "Pass --allow-multi-tenancy to override intentionally." >&2
    exit 1
  fi
fi

echo "→ supabase functions deploy (from $GIT_REF worktree)"
(cd "$WORKTREE_DIR" && "${SUPABASE[@]}" functions deploy)

log_deploy "$ENV_ARG" "rollback-functions"

echo ""
echo "Functions rolled back to $GIT_REF on $ENV_ARG."
