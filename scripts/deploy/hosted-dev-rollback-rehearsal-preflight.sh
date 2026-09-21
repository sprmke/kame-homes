#!/usr/bin/env bash
# Production-readiness docs 24 / 30 — read-only checks before a hosted-dev restore drill.
# Does not mutate Supabase, run psql restore, or deploy anything.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/dev/check-linked-project.sh
source "$ROOT/scripts/dev/check-linked-project.sh"

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy/hosted-dev-rollback-rehearsal-preflight.sh

Read-only preflight for the hosted-dev rollback rehearsal (doc 24.2 / 30.2):
  - Confirms the CLI is linked to the mt-dev project (not legacy prod)
  - Lists the newest local backups/dev dump (if any)
  - Prints the operator checklist and optional rollback --dry-run when DEV_DB_URL is set

Full procedure: docs/archive/operations/hosted-dev-rollback-rehearsal.md
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

echo "═══ Hosted-dev rollback rehearsal preflight (read-only) ═══"
print_linked_project

if [[ "$LINKED_PROJECT_KIND" != "dev" ]]; then
  echo ""
  echo "ERROR: Link MULTI_TENANT_DEV before a dev rehearsal (bun run env:status)." >&2
  echo "See docs/archive/operations/dev-staging-environment.md" >&2
  exit 1
fi

BACKUP_DIR="$ROOT/backups/dev"
latest_data="$(ls -1t "$BACKUP_DIR"/*_data.sql 2>/dev/null | head -1 || true)"
if [[ -z "$latest_data" ]]; then
  echo ""
  echo "WARN: No backups in backups/dev yet."
  echo "  Run: bun run backup:supabase:dev"
else
  latest_schema="${latest_data/_data.sql/_schema.sql}"
  echo ""
  echo "Latest local backup pair:"
  echo "  schema: $latest_schema"
  echo "  data:   $latest_data"
  if [[ ! -f "$latest_schema" ]]; then
    echo "WARN: Matching schema file missing for latest data dump." >&2
  fi
fi

if [[ -f "$ROOT/backups/deploy-log.csv" ]]; then
  echo ""
  echo "Recent deploy-log entries (last 3):"
  tail -3 "$ROOT/backups/deploy-log.csv" || true
fi

echo ""
echo "Operator checklist (destructive steps are manual — not run here):"
echo "  1. bun run backup:supabase:dev   # fresh dump before drill"
echo "  2. Provision an EMPTY replacement Supabase project (or documented fresh target)"
echo "  3. Link the empty project; bun run rollback:supabase:dev -- --fresh-target"
echo "  4. bun run rollback:functions:dev -- <known-good-git-ref>"
echo "  5. Measure wall-clock RTO; verify auth sign-in, Storage objects, crons, smoke"
echo "  6. Record results in docs/workflow/planned/production-readiness-checklist/24-hosting-and-deployment.md"
echo ""
echo "Runbook: docs/archive/operations/hosted-dev-rollback-rehearsal.md"

DB_URL="${DEV_DB_URL:-}"
[[ -z "$DB_URL" ]] && DB_URL="$(read_env_file_var "$ROOT/supabase/.env.dev.local" "DEV_DB_URL")"

if [[ -z "$DB_URL" ]]; then
  echo ""
  echo "DEV_DB_URL not set — skipping rollback --dry-run (add to supabase/.env.dev.local for full preflight)."
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  echo ""
  echo "psql not found — skipping rollback --dry-run."
  exit 0
fi

echo ""
echo "═══ rollback-supabase.sh dev --fresh-target --dry-run ═══"
chmod +x "$ROOT/scripts/deploy/rollback-supabase.sh"
"$ROOT/scripts/deploy/rollback-supabase.sh" dev --fresh-target --dry-run
