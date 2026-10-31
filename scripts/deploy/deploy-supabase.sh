#!/usr/bin/env bash
# Deploy migrations and Edge Functions to the linked Supabase project.
# Prerequisites: supabase login, supabase link --project-ref <prod-ref>
# See docs/archive/operations/production-deployment.md for the full cutover checklist (backups, secrets, UI).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

SUPABASE=("$ROOT/scripts/dev/bunx" --bun supabase@latest)
PROJECT_REF_FILE="$ROOT/supabase/.temp/project-ref"
# shellcheck source=scripts/dev/check-linked-project.sh
source "$ROOT/scripts/dev/check-linked-project.sh"

DB_ONLY=false
FUNCTIONS_ONLY=false
INCLUDE_ALL=false
ALLOW_MULTI_TENANCY=false
SKIP_BACKUP=false

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy/deploy-supabase.sh [options]

Deploy to the linked Supabase project (supabase link --project-ref <ref>).
Backs up the linked project first (schema + data) unless --skip-backup is
passed. Requires typing "prod" to confirm.

Options:
  --db-only              Run supabase db push only
  --functions-only       Run supabase functions deploy only
  --include-all          Pass --include-all to db push (migration history repair)
  --allow-multi-tenancy  Skip guard when this tree has multi-tenancy edge code
                         (requires matching DB migrations on the linked project)
  --skip-backup          Skip the automatic pre-db-push backup (loud warning; not recommended)
  -h, --help             Show this help

Examples:
  npm run deploy:supabase
  npm run deploy:supabase -- --include-all
  npm run deploy:supabase:db
  npm run deploy:supabase:functions
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-only)
      DB_ONLY=true
      shift
      ;;
    --functions-only)
      FUNCTIONS_ONLY=true
      shift
      ;;
    --include-all)
      INCLUDE_ALL=true
      shift
      ;;
    --allow-multi-tenancy)
      ALLOW_MULTI_TENANCY=true
      shift
      ;;
    --skip-backup)
      SKIP_BACKUP=true
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "$DB_ONLY" == true && "$FUNCTIONS_ONLY" == true ]]; then
  echo "Cannot use --db-only and --functions-only together." >&2
  exit 1
fi

if [[ ! -f "$PROJECT_REF_FILE" ]]; then
  echo "No linked Supabase project found (missing supabase/.temp/project-ref)." >&2
  echo "Run: npx supabase@latest login && npx supabase@latest link --project-ref <prod-ref>" >&2
  exit 1
fi

print_linked_project
if [[ "$LINKED_PROJECT_KIND" == "dev" ]]; then
  echo "" >&2
  echo "ERROR: This is the PROD deploy script but the linked project looks like DEV ($LINKED_PROJECT_REF)." >&2
  echo "Use 'bun run deploy:supabase:dev' for dev, or re-link to prod first:" >&2
  echo "  bunx supabase@latest link --project-ref <prod-ref>" >&2
  exit 1
fi

echo "════════════════════════════════════════════════════════════"
echo "  PRODUCTION Supabase deploy"
echo "  Linked project: $LINKED_PROJECT_REF"
echo "  See docs/archive/operations/production-deployment.md for the full checklist."
echo "════════════════════════════════════════════════════════════"
echo ""
if [[ "${CI:-}" == "1" || "${CI:-}" == "true" ]]; then
  confirm="${DEPLOY_CONFIRM:-}"
  echo "CI confirmation: DEPLOY_CONFIRM=${confirm:-<unset>}"
else
  echo "Type prod to confirm deploy to this project:"
  read -r confirm
fi
if [[ "$confirm" != "prod" ]]; then
  echo "Aborted (expected: prod)."
  exit 1
fi
echo

assert_functions_match_db_schema() {
  if [[ "$ALLOW_MULTI_TENANCY" == true ]]; then
    return 0
  fi

  local sd_cron="$ROOT/supabase/functions/sd-refund-cron/index.ts"
  local property_scope="$ROOT/supabase/functions/_shared/propertyScope.ts"

  if [[ -f "$property_scope" ]] || grep -q "property_id" "$sd_cron" 2>/dev/null; then
    echo "Refusing to deploy Edge Functions: this tree includes multi-tenancy code" >&2
    echo "(propertyScope.ts and/or sd-refund-cron selects guest_submissions.property_id)." >&2
    echo "Production needs matching migrations (organizations, properties, property_id columns)" >&2
    echo "before that code can run. For single-tenant prod, deploy from main:" >&2
    echo "  git checkout main && npm run deploy:supabase:functions" >&2
    echo "To override intentionally: ./scripts/deploy-supabase.sh --functions-only --allow-multi-tenancy" >&2
    exit 1
  fi
}

run_backup_if_needed() {
  if [[ "$FUNCTIONS_ONLY" == true ]]; then
    return 0
  fi
  if [[ "$SKIP_BACKUP" == true ]]; then
    echo "⚠️  WARNING: --skip-backup set — proceeding WITHOUT a pre-deploy backup." >&2
    echo "⚠️  If this db push goes wrong, you will have nothing scripted to roll back to." >&2
    return 0
  fi
  echo "→ Backing up before db push (./scripts/deploy/backup-supabase.sh prod)"
  "$ROOT/scripts/deploy/backup-supabase.sh" prod
  echo
}

run_db_push() {
  local -a push_args=(db push)
  if [[ "$INCLUDE_ALL" == true ]]; then
    push_args+=(--include-all)
  fi
  echo "→ supabase ${push_args[*]}"
  "${SUPABASE[@]}" "${push_args[@]}"
}

run_functions_deploy() {
  assert_functions_match_db_schema
  echo "→ supabase functions deploy"
  "${SUPABASE[@]}" functions deploy
}

run_backup_if_needed

DEPLOY_KIND="both"
if [[ "$DB_ONLY" == true ]]; then
  DEPLOY_KIND="db"
  run_db_push
elif [[ "$FUNCTIONS_ONLY" == true ]]; then
  DEPLOY_KIND="functions"
  run_functions_deploy
else
  run_db_push
  echo
  run_functions_deploy
fi

log_deploy "prod" "$DEPLOY_KIND"

echo
echo "Deploy complete."
