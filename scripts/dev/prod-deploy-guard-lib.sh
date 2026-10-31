#!/usr/bin/env bash
# Shared prod-deploy guard for Cursor + Claude Code shell hooks.
# Source this file; do not execute directly.

PROD_DEPLOY_UNLOCK_WORD="kamewave"

# Returns 0 when the command string contains the unlock word (case-insensitive).
prod_deploy_is_unlocked() {
  local cmd="$1"
  local lower_cmd
  lower_cmd=$(printf '%s' "$cmd" | tr '[:upper:]' '[:lower:]')
  [[ "$lower_cmd" == *"${PROD_DEPLOY_UNLOCK_WORD}"* ]]
}

# Returns 0 when the command should be blocked as a production Supabase/DB mutation.
# Read-only linked inspection (db diff/dump --linked, status) is NOT blocked here.
prod_deploy_is_blocked() {
  local cmd="$1"

  if prod_deploy_is_unlocked "$cmd"; then
    return 1
  fi

  # Dev-targeted and read-only commands are always safe without kamewave — checked
  # FIRST so they can't be caught by the broader prod-shaped patterns below (e.g.
  # "deploy:supabase:dev" contains the substring "deploy:supabase"). Each of these
  # scripts has its own independent safety net (DEV/PROD ref check + typed
  # confirmation for dev deploy/rollback; read-only for backup/status).
  case "$cmd" in
    *deploy:supabase:dev*|*deploy-supabase-dev.sh*)
      return 1
      ;;
    *rollback:supabase:dev*|*rollback-supabase.sh" dev"*|*rollback-supabase.sh" "*" dev"*)
      return 1
      ;;
    *rollback:functions:dev*|*rollback-functions.sh" dev"*|*rollback-functions.sh" "*" dev"*)
      return 1
      ;;
    *backup:supabase:*|*backup-supabase.sh*)
      return 1
      ;;
    *migrations:status:*|*migration-status.sh*)
      return 1
      ;;
    *env:status*|*check-linked-project.sh*)
      return 1
      ;;
  esac

  case "$cmd" in
    *deploy:supabase*|*deploy-supabase.sh*)
      return 0
      ;;
    *rollback:supabase:prod*|*rollback-supabase.sh*)
      return 0
      ;;
    *rollback:functions:prod*|*rollback-functions.sh*)
      return 0
      ;;
    *"functions deploy"*)
      return 0
      ;;
    *"db push"*)
      return 0
      ;;
    *"migration repair"*)
      # Local-only history repair is safe; remote / unspecified targets are not.
      [[ "$cmd" == *"--local"* ]] && return 1
      return 0
      ;;
    *"migration up"*)
      # Local-only apply is safe; remote / unspecified targets are not.
      [[ "$cmd" == *"--local"* ]] && return 1
      return 0
      ;;
    *"db reset"*"--linked"*)
      return 0
      ;;
    *"--db-url"*)
      # Remote connection string — treat as prod-adjacent unless clearly local.
      [[ "$cmd" == *"127.0.0.1"* || "$cmd" == *"localhost"* || "$cmd" == *":54322"* ]] && return 1
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

prod_deploy_block_reason() {
  cat <<EOF
Blocked: this command can change the linked Supabase production project or remote database.

We develop on git branches with live production — do not deploy DB migrations, push schema, or deploy Edge Functions to prod until the team explicitly approves.

To authorize for this shell command only, the user must say the unlock word "${PROD_DEPLOY_UNLOCK_WORD}" in chat, then rerun with that word present in the command (e.g. KAMEWAVE=${PROD_DEPLOY_UNLOCK_WORD} bun run deploy:supabase).

Safe without unlock: local supabase (start/stop/db:reset/db:migrate), functions serve, dev deploy (deploy:supabase:dev and its --db-only/--functions-only variants), backups (any env), dev rollback (rollback:supabase:dev, rollback:functions:dev), migration/env status checks, read-only linked checks (db diff --linked, db dump --linked).
EOF
}
