#!/usr/bin/env bash
# Deploy migrations and Edge Functions to the DEV Supabase project (never prod without kamewave).
# Reads DEV_PROJECT_REF from supabase/.env.dev.local
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

SUPABASE=("$ROOT/scripts/dev/bunx" --bun supabase@latest)
ENV_FILE="$ROOT/supabase/.env.dev.local"
PROJECT_REF_FILE="$ROOT/supabase/.temp/project-ref"
# shellcheck source=scripts/dev/check-linked-project.sh
source "$ROOT/scripts/dev/check-linked-project.sh"
# shellcheck source=scripts/deploy/ci-deploy-lib.sh
source "$ROOT/scripts/deploy/ci-deploy-lib.sh"

DB_ONLY=false
FUNCTIONS_ONLY=false
# Dev often has out-of-order migration history (parallel branches merging to develop).
# Default on; pass --no-include-all to mirror prod-style strict ordering.
INCLUDE_ALL=true
# MULTI_TENANT_DEV (fwor…) always uses multi-tenant edge code — same default as ci-deploy.sh.
ALLOW_MULTI_TENANCY=true
SKIP_BACKUP=false
CI_MODE=false

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy/deploy-supabase-dev.sh [options]

Deploy to the DEV Supabase project (supabase/.env.dev.local → DEV_PROJECT_REF).
Refuses when DEV_PROJECT_REF matches the currently linked prod ref. Backs up
the dev project first (schema + data) unless --skip-backup is passed.

Options:
  --db-only              Run supabase db push only
  --functions-only       Run supabase functions deploy only
  --include-all          Pass --include-all to db push (default for dev deploys)
  --no-include-all       Omit --include-all (strict migration order; may fail on develop)
  --allow-multi-tenancy  Allow multi-tenant edge function deploy (default for dev)
  --no-allow-multi-tenancy  Refuse function deploy when multi-tenant edge code is present
  --skip-backup          Skip the automatic pre-db-push backup (loud warning; not recommended)
  --ci                   CI mode (requires DEPLOY_CONFIRM=dev; no interactive prompt)
  -h, --help             Show this help

Examples:
  bun run deploy:supabase:dev
  bun run deploy:supabase:dev -- --db-only
  bun run deploy:supabase:dev -- --functions-only
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-only) DB_ONLY=true; shift ;;
    --functions-only) FUNCTIONS_ONLY=true; shift ;;
    --include-all) INCLUDE_ALL=true; shift ;;
    --no-include-all) INCLUDE_ALL=false; shift ;;
    --allow-multi-tenancy) ALLOW_MULTI_TENANCY=true; shift ;;
    --no-allow-multi-tenancy) ALLOW_MULTI_TENANCY=false; shift ;;
    --skip-backup) SKIP_BACKUP=true; shift ;;
    --ci) CI_MODE=true; export CI=1; shift ;;
    -h | --help) usage; exit 0 ;;
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

ci_deploy_reject_skip_backup_in_ci "$SKIP_BACKUP"

if ci_deploy_is_ci || [[ "$CI_MODE" == true ]]; then
  export CI=1
  if [[ -n "${SUPABASE_PROJECT_REF:-}" ]]; then
    DEV_REF="$(tr -d '[:space:]' <<<"${SUPABASE_PROJECT_REF}")"
    PROD_REF_GUARD="$(tr -d '[:space:]' <<<"${LEGACY_PROD_PROJECT_REF:-${PROD_PROJECT_REF:-}}")"
  fi
fi

if [[ ! -f "$ENV_FILE" && -z "${DEV_REF:-}" ]]; then
  echo "Missing supabase/.env.dev.local" >&2
  echo "Copy supabase/.env.dev.example → supabase/.env.dev.local and set DEV_PROJECT_REF." >&2
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
  # Local deploy uses `supabase login`; a stale PAT in .env.dev.local overrides the CLI session.
  if ! ci_deploy_is_ci; then
    unset SUPABASE_ACCESS_TOKEN
  fi
fi

if [[ -z "${DEV_REF:-}" ]]; then
  DEV_REF="$(tr -d '[:space:]' <<<"${DEV_PROJECT_REF:-}")"
fi
if [[ -z "${PROD_REF_GUARD:-}" ]]; then
  PROD_REF_GUARD="$(tr -d '[:space:]' <<<"${PROD_PROJECT_REF:-}")"
fi
if [[ -z "$DEV_REF" ]]; then
  echo "DEV_PROJECT_REF is empty in supabase/.env.dev.local" >&2
  exit 1
fi

if [[ -n "$PROD_REF_GUARD" && "$DEV_REF" == "$PROD_REF_GUARD" ]]; then
  echo "Refusing dev deploy: DEV_PROJECT_REF matches PROD_PROJECT_REF in .env.dev.local." >&2
  echo "Use a separate Supabase project for dev." >&2
  exit 1
fi

if [[ "$ALLOW_MULTI_TENANCY" == true ]]; then
  ci_deploy_assert_not_legacy_ref "$DEV_REF" "${LEGACY_PROD_PROJECT_REF:-$PROD_REF_GUARD}"
fi

print_linked_project
LINKED_REF="$LINKED_PROJECT_REF"

if [[ -n "$LINKED_REF" && "$LINKED_REF" != "$DEV_REF" ]]; then
  echo "Note: CLI is currently linked to $LINKED_REF; will re-link to dev ($DEV_REF)." >&2
fi

echo "════════════════════════════════════════════════════════════"
echo "  DEV Supabase deploy"
echo "  Project ref: $DEV_REF"
echo "  See docs/archive/operations/dev-staging-environment.md"
echo "════════════════════════════════════════════════════════════"
echo ""
ci_deploy_confirm "dev"

if [[ "$LINKED_REF" == "$DEV_REF" ]]; then
  echo "Already linked to $DEV_REF — skipping supabase link"
else
  echo "→ supabase link --project-ref $DEV_REF"
  "${SUPABASE[@]}" link --project-ref "$DEV_REF"
fi

LINKED_AFTER="$(tr -d '[:space:]' <"$PROJECT_REF_FILE")"
if ci_deploy_is_ci; then
  ci_deploy_assert_target_ref "$DEV_REF" "$LINKED_AFTER"
fi

assert_functions_match_db_schema() {
  if [[ "$ALLOW_MULTI_TENANCY" == true ]]; then
    return 0
  fi
  local sd_cron="$ROOT/supabase/functions/sd-refund-cron/index.ts"
  local property_scope="$ROOT/supabase/functions/_shared/propertyScope.ts"
  if [[ -f "$property_scope" ]] || grep -q "property_id" "$sd_cron" 2>/dev/null; then
    echo "Refusing function deploy: multi-tenancy edge code detected." >&2
    echo "Ensure dev DB has matching migrations, or pass --allow-multi-tenancy intentionally." >&2
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
  echo "→ Backing up before db push (./scripts/deploy/backup-supabase.sh dev)"
  "$ROOT/scripts/deploy/backup-supabase.sh" dev
  echo
}

run_db_push() {
  local -a push_args=(db push)
  if [[ "$INCLUDE_ALL" == true ]]; then
    push_args+=(--include-all)
    echo "Using db push --include-all (dev default — applies migrations even when timestamps predate remote head)"
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

log_deploy "dev" "$DEPLOY_KIND"

echo
echo "Dev deploy complete (linked ref is now $DEV_REF)."
if [[ -n "$LINKED_REF" && "$LINKED_REF" != "$DEV_REF" ]]; then
  echo "Re-link prod before any production deploy:"
  echo "  bunx supabase@latest link --project-ref $LINKED_REF"
fi
