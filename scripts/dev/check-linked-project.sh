#!/usr/bin/env bash
# Shared helpers for deploy/backup/rollback/migration-status scripts:
#   - read_env_file_var <file> <KEY>   Safe KEY=value lookup (strips quotes/
#     whitespace; never fails under `set -o pipefail` when the key is absent).
#   - print_linked_project              Classify the linked Supabase project
#     as dev/prod/unknown. Sets LINKED_PROJECT_REF, LINKED_PROJECT_KIND.
#   - log_deploy <env> <kind>           Append a line to backups/deploy-log.csv
#     (timestamp, env, kind, git sha, git branch, os user) — audit trail for
#     who deployed what, when, from where.
#
# Source: `source "$ROOT/scripts/dev/check-linked-project.sh"`
# Also runnable directly: ./scripts/dev/check-linked-project.sh (bun run env:status)
set -euo pipefail

_CHECK_LINKED_PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

read_env_file_var() {
  local file="$1" key="$2" line value
  [[ -f "$file" ]] || return 0
  line="$(grep -E "^[[:space:]]*${key}=" "$file" | head -1 || true)"
  [[ -n "$line" ]] || return 0
  value="${line#*=}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
  printf '%s' "$value"
}

print_linked_project() {
  local ref_file="$_CHECK_LINKED_PROJECT_ROOT/supabase/.temp/project-ref"
  local env_file="$_CHECK_LINKED_PROJECT_ROOT/supabase/.env.dev.local"
  local dev_ref prod_ref

  LINKED_PROJECT_REF=""
  LINKED_PROJECT_KIND="unknown"

  dev_ref="$(read_env_file_var "$env_file" "DEV_PROJECT_REF")"
  prod_ref="$(read_env_file_var "$env_file" "PROD_PROJECT_REF")"

  if [[ ! -f "$ref_file" ]]; then
    echo "You are linked to: (nothing — run 'bunx supabase@latest link --project-ref <ref>')"
    return 0
  fi

  LINKED_PROJECT_REF="$(tr -d '[:space:]' <"$ref_file")"

  if [[ -n "$dev_ref" && "$LINKED_PROJECT_REF" == "$dev_ref" ]]; then
    LINKED_PROJECT_KIND="dev"
  elif [[ -n "$prod_ref" && "$LINKED_PROJECT_REF" == "$prod_ref" ]]; then
    LINKED_PROJECT_KIND="prod"
  fi

  echo "You are linked to: $LINKED_PROJECT_REF ($LINKED_PROJECT_KIND)"
}

log_deploy() {
  local env_kind="$1" deploy_kind="$2"
  local log_file="$_CHECK_LINKED_PROJECT_ROOT/backups/deploy-log.csv"
  local ts sha branch os_user

  mkdir -p "$(dirname "$log_file")"
  if [[ ! -f "$log_file" ]]; then
    echo "timestamp_utc,env,deploy_kind,git_sha,git_branch,os_user" >"$log_file"
  fi

  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  sha="$(git -C "$_CHECK_LINKED_PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  branch="$(git -C "$_CHECK_LINKED_PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
  os_user="${USER:-unknown}"

  echo "${ts},${env_kind},${deploy_kind},${sha},${branch},${os_user}" >>"$log_file"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  print_linked_project
fi
