---
title: 'Supabase deploy guardrails, backups & rollback'
status: done
tags: [workflow, done, deployment, operations, supabase]
updated: 2026-08-06
stage: done
kind: plan
---

# Supabase Deploy Guardrails, Backups & Rollback — Implementation Plan

> **Shipped.** Tasks 1–14 complete. Guard fixed so `deploy:supabase:dev*` is allowed without `kamewave`; backups run before every db push; DB + Edge Function rollback scripts + migration/env status; docs/hooks/`package.json`/VS Code tasks in sync. Live smoke against a real project (backup → deploy → status → rollback dry-run) is the operator’s first real-world check — see Final verification §6 in this plan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing local → dev → prod Supabase deployment path bulletproof: fix a real guard-hook bug, add automated backups before every mutating deploy, add scripted rollback (DB + Edge Functions) for both environments, add read-only drift/status visibility, add an audit trail, and bring every script/doc/hook/VS Code task in the repo into sync — so the whole team has one safe, standard, easy-to-use flow.

**Architecture:** Two existing deploy scripts (`deploy-supabase.sh` prod, `deploy-supabase-dev.sh` dev) get a shared preflight/audit helper (`scripts/dev/check-linked-project.sh`) and an automatic pre-push backup step (`scripts/deploy/backup-supabase.sh`). Two new scripts add scripted rollback for Postgres (`rollback-supabase.sh`, restores a backup via `psql`) and Edge Functions (`rollback-functions.sh`, redeploys an older git ref via a throwaway `git worktree`). A read-only `migration-status.sh` shows drift between repo, dev, and prod without mutating anything. The existing `kamewave` shell-hook gate (`scripts/dev/prod-deploy-guard-lib.sh`, sourced by both `.cursor/hooks/guard-shell.sh` and `.claude/hooks/guard-shell.sh`) is corrected and extended to cover the new scripts. `package.json`, `.vscode/tasks.json`, `.gitignore`, and every relevant doc are updated to match.

**Tech Stack:** Bash (`set -euo pipefail`), Supabase CLI via the existing `scripts/dev/bunx` wrapper, `psql`/`pg_dump`-family tooling (already a documented prerequisite via `libpq`), `git worktree`, Bun scripts, VS Code tasks. No new external dependencies. No test framework exists for shell scripts in this repo — verification is `bash -n` (syntax), `shellcheck` (optional, if installed), and manual dry-run/inspection, not a test runner.

## Global Constraints

- Never touch `.claude/hooks/guard-shell.sh` or `.cursor/hooks/guard-shell.sh` — both just source `scripts/dev/prod-deploy-guard-lib.sh`; the fix belongs only in the shared lib.
- Preserve `assert_functions_match_db_schema()` and `--allow-multi-tenancy` in both deploy scripts exactly as-is.
- Do not script actual Supabase account/project creation — that stays a manual Dashboard step (already documented in `docs/archive/operations/dev-staging-environment.md` §2).
- Do not add automated CI/CD deploy steps. This is a deliberate decision, not an oversight — see "Best practices applied" below.
- Never commit real secrets, project refs, or backup dumps. `backups/` and any new env-var names must be gitignored/documented as templates only.
- All new scripts follow the existing style in `deploy-supabase.sh`/`deploy-supabase-dev.sh`: `set -euo pipefail`, `ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"`, colored `════` banners for destructive actions, typed-word confirmation, `--flag` parsing loop, `usage()` heredoc.
- Every `grep | head | cut | tr` pipeline that looks up an optional env var must end with `|| true` — under `set -o pipefail`, a `grep` that finds nothing exits 1 and would otherwise abort the whole script (this is a real bug fixed in Task 2; do not reintroduce it in later tasks).

---

## Best practices applied (why each piece exists)

The user asked this plan to follow standard deployment best practices, not just patch the one known bug. Each practice below maps to a specific task:

| Practice                                                            | Where                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fail-closed by default, explicit allow-list for safe operations** | Task 1 — the guard now exempts _specific_ safe command shapes (dev deploy, backups, dev rollback, status checks) instead of a leaky substring blocklist                                                                                   |
| **Separate credentials/projects per environment**                   | Already true (separate Supabase accounts for dev/prod) — Task 2's `print_linked_project` makes the _current_ classification visible before every action instead of trusting memory                                                        |
| **Immutable backup before any destructive/mutating action**         | Task 3 + Tasks 4/5 — `backup-supabase.sh` runs automatically before every `db push`, prod or dev, opt-out only via a loud `--skip-backup` warning                                                                                         |
| **Human-in-the-loop confirmation, defense in depth**                | Task 4 adds a typed `prod` confirmation to `deploy-supabase.sh` (it currently has _none_ — it only relies on the external `kamewave` agent hook, which does not protect a human typing the command directly in a terminal)                |
| **Rollback tested and scripted, not just documented**               | Tasks 6–7 — both DB and Edge Function rollback are real scripts with `--dry-run`, not prose runbooks a human has to hand-translate under pressure                                                                                         |
| **Read-only drift/status visibility before promoting**              | Task 8 — `migration-status.sh` shows applied-vs-pending migrations per environment; never mutates                                                                                                                                         |
| **Audit trail**                                                     | Task 2's `log_deploy()` appends every deploy (timestamp, env, kind, git SHA, git branch, OS user) to a local `backups/deploy-log.csv`, called from Tasks 4/5                                                                              |
| **Docs are the source of truth, updated in the same change**        | Tasks 12–13 — every doc that describes deploy behavior is corrected in the same plan, not left to drift                                                                                                                                   |
| **Human-in-the-loop deploys stay intentional (no auto-CD)**         | Explicitly _not_ adding a GitHub Actions deploy step — CI (`ci.yml`) stays quality-gate-only. Automated CD to prod would defeat the entire purpose of the `kamewave` gate; recorded here so it reads as a decision, not a gap             |
| **Branch protection on `main` (recommended, manual)**               | Task 13 adds a documentation note recommending the team enable required-status-checks branch protection on `main` in GitHub repo settings — this cannot be scripted from the repo itself, so it's a documented recommendation, not a task |

---

## Task 1: Fix the `kamewave` guard substring-match bug

**Bug:** `scripts/dev/prod-deploy-guard-lib.sh`'s `prod_deploy_is_blocked()` blocks any command matching `*deploy:supabase*`. Since `"deploy:supabase"` is a literal substring of `"deploy:supabase:dev"`, **the dev deploy command is currently blocked by the agent shell hook unless the user says "kamewave"** — directly contradicting `docs/archive/operations/dev-staging-environment.md` line 53 ("Dev deploys use `bun run deploy:supabase:dev` and never touch prod") and defeating the entire point of having a low-friction dev path. This task also extends the guard to recognize the new scripts added in Tasks 3, 6, 7, 8 (backup/rollback/status), keeping prod mutations blocked and dev/read-only operations exempt.

**Files:**

- Modify: `scripts/dev/prod-deploy-guard-lib.sh` (full file, 67 lines)

**Current content (for reference — do not skip reading it first):**

```bash
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

  case "$cmd" in
    *deploy:supabase*|*deploy-supabase.sh*)
      return 0
      ;;
    *"functions deploy"*)
      return 0
      ;;
    *"db push"*)
      return 0
      ;;
    *"migration repair"*)
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

Safe without unlock: local supabase (start/stop/db:reset/db:migrate), functions serve, read-only linked checks (db diff --linked, db dump --linked).
EOF
}
```

**New content — replace the entire file:**

```bash
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
```

Note on the `rollback-supabase.sh`/`rollback-functions.sh` raw-script exemption patterns: they require `dev` to appear immediately after the script name (a leading space before it), e.g. `./scripts/deploy/rollback-supabase.sh dev --dry-run`. This deliberately does **not** match a prod invocation that happens to mention "dev" elsewhere in its arguments (e.g. `rollback-supabase.sh prod --file backups/dev/x.sql`), which would be a false-negative security hole. The npm-script forms (`rollback:supabase:dev`, `rollback:functions:dev`) are the primary supported interface and don't have this ambiguity.

**Steps:**

1. Read the current file to confirm it matches the "Current content" block above (guards against drift since this file was last read).
2. Replace the full file with the "New content" block above.
3. `bash -n scripts/dev/prod-deploy-guard-lib.sh` — must report no syntax errors (sourced files can still be syntax-checked directly).
4. `command -v shellcheck >/dev/null 2>&1 && shellcheck scripts/dev/prod-deploy-guard-lib.sh || echo "shellcheck not installed — skipping"`.
5. Manual verification (source the lib and call the function directly — no side effects, nothing here touches Supabase):
   ```bash
   bash -c '
     source scripts/dev/prod-deploy-guard-lib.sh
     assert() { if [[ "$2" == "blocked" ]]; then prod_deploy_is_blocked "$1" && echo "PASS blocked: $1" || echo "FAIL expected blocked: $1"; else prod_deploy_is_blocked "$1" && echo "FAIL expected allowed: $1" || echo "PASS allowed: $1"; fi; }
     assert "bun run deploy:supabase:dev" allowed
     assert "bun run deploy:supabase:dev:db" allowed
     assert "bun run deploy:supabase:dev:functions" allowed
     assert "bun run backup:supabase:dev" allowed
     assert "bun run backup:supabase:prod" allowed
     assert "bun run rollback:supabase:dev" allowed
     assert "bun run rollback:functions:dev -- main" allowed
     assert "bun run migrations:status:dev" allowed
     assert "bun run migrations:status:prod" allowed
     assert "bun run env:status" allowed
     assert "bun run deploy:supabase" blocked
     assert "bun run deploy:supabase:db" blocked
     assert "bun run deploy:supabase:functions" blocked
     assert "bun run rollback:supabase:prod" blocked
     assert "bun run rollback:functions:prod -- main" blocked
     assert "supabase db push" blocked
     assert "supabase functions deploy" blocked
     assert "bun run deploy:supabase kamewave" allowed
   '
   ```
   Every line must print `PASS`. If any prints `FAIL`, fix the pattern before continuing — this is the single highest-value check in the whole plan since it's the actual safety boundary.
6. Commit: `git add scripts/dev/prod-deploy-guard-lib.sh && git commit -m "fix: stop kamewave guard from blocking dev deploy commands"`.

---

## Task 2: Shared preflight/audit helper — `scripts/dev/check-linked-project.sh`

**Files:**

- Create: `scripts/dev/check-linked-project.sh`

**Content:**

```bash
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
```

**Steps:**

1. Write the file, then `chmod +x scripts/dev/check-linked-project.sh`.
2. `bash -n scripts/dev/check-linked-project.sh`
3. `command -v shellcheck >/dev/null 2>&1 && shellcheck scripts/dev/check-linked-project.sh || echo "shellcheck not installed — skipping"`
4. Manual inspect:
   - `./scripts/dev/check-linked-project.sh` — runs directly (no Supabase project linked yet on a fresh checkout is fine), must print `You are linked to: ...` and exit 0, never crash even if `supabase/.env.dev.local` doesn't exist.
   - `bash -c 'source scripts/dev/check-linked-project.sh; read_env_file_var supabase/.env.dev.example DEV_PROJECT_REF'` — must print `replace-with-dev-project-ref` (proves quote/whitespace stripping and the "key found" path both work) without any error, even though `set -o pipefail` is active.
   - `bash -c 'source scripts/dev/check-linked-project.sh; read_env_file_var supabase/.env.dev.example NOT_A_REAL_KEY; echo "exit:$?"'` — must print `exit:0` (proves the "key absent" path does not trip `set -e`/`pipefail`, which was the bug being avoided).
5. Commit: `git add scripts/dev/check-linked-project.sh && git commit -m "feat: add shared linked-project preflight and deploy-log helper"`.

---

## Task 3: `scripts/deploy/backup-supabase.sh`

**Files:**

- Create: `scripts/deploy/backup-supabase.sh`

**Content:**

```bash
#!/usr/bin/env bash
# Back up the linked <dev|prod> Supabase project's public schema
# (`supabase db dump --linked`) and data (`--data-only`) into
# backups/<env>/<UTC-timestamp>_{schema,data}.sql (gitignored). Read-only
# against the remote project — never mutates anything. Runs automatically as
# the first step of deploy-supabase.sh / deploy-supabase-dev.sh unless
# --skip-backup is passed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

SUPABASE=("$ROOT/scripts/dev/bunx" --bun supabase@latest)
# shellcheck source=scripts/dev/check-linked-project.sh
source "$ROOT/scripts/dev/check-linked-project.sh"

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy/backup-supabase.sh <dev|prod> [--dry-run]

Dumps the schema and data of the CURRENTLY LINKED <dev|prod> Supabase project
into backups/<env>/<UTC-timestamp>_{schema,data}.sql (gitignored). Read-only
against the remote project.

Options:
  --dry-run   Print the dump commands and target paths; do not execute
  -h, --help  Show this help

Examples:
  bun run backup:supabase:dev
  bun run backup:supabase:prod
  ./scripts/deploy/backup-supabase.sh dev --dry-run
EOF
}

ENV_ARG=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    dev | prod)
      ENV_ARG="$1"
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
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$ENV_ARG" ]]; then
  echo "Missing required argument: dev or prod" >&2
  usage >&2
  exit 1
fi

print_linked_project
if [[ "$LINKED_PROJECT_KIND" != "$ENV_ARG" && "$LINKED_PROJECT_KIND" != "unknown" ]]; then
  echo "" >&2
  echo "ERROR: You asked to back up '$ENV_ARG' but the linked project looks like '$LINKED_PROJECT_KIND' ($LINKED_PROJECT_REF)." >&2
  echo "Re-link to $ENV_ARG first, then re-run." >&2
  exit 1
fi
if [[ "$LINKED_PROJECT_KIND" == "unknown" ]]; then
  echo "WARNING: could not classify the linked project as dev or prod (add DEV_PROJECT_REF/PROD_PROJECT_REF to supabase/.env.dev.local to enable this check)." >&2
  echo "Proceeding to back up whatever is linked ($LINKED_PROJECT_REF) as '$ENV_ARG'." >&2
fi

BACKUP_DIR="$ROOT/backups/$ENV_ARG"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SCHEMA_FILE="$BACKUP_DIR/${STAMP}_schema.sql"
DATA_FILE="$BACKUP_DIR/${STAMP}_data.sql"

if [[ "$DRY_RUN" == true ]]; then
  echo "[dry-run] mkdir -p $BACKUP_DIR"
  echo "[dry-run] supabase db dump --linked -f $SCHEMA_FILE"
  echo "[dry-run] supabase db dump --linked --data-only -f $DATA_FILE"
  exit 0
fi

mkdir -p "$BACKUP_DIR"

echo "→ supabase db dump --linked -f $SCHEMA_FILE"
"${SUPABASE[@]}" db dump --linked -f "$SCHEMA_FILE"

echo "→ supabase db dump --linked --data-only -f $DATA_FILE"
"${SUPABASE[@]}" db dump --linked --data-only -f "$DATA_FILE"

echo ""
echo "Backup complete ($ENV_ARG):"
echo "  schema: $SCHEMA_FILE"
echo "  data:   $DATA_FILE"
```

**Steps:**

1. Write the file, `chmod +x scripts/deploy/backup-supabase.sh`.
2. `bash -n scripts/deploy/backup-supabase.sh`
3. `command -v shellcheck >/dev/null 2>&1 && shellcheck scripts/deploy/backup-supabase.sh || echo "shellcheck not installed — skipping"`
4. Manual inspect:
   - `./scripts/deploy/backup-supabase.sh` (no arg) → usage + exit 1.
   - `./scripts/deploy/backup-supabase.sh dev --dry-run` → prints the three `[dry-run]` lines and exits 0 without creating `backups/` (confirm with `ls backups 2>&1` reporting "No such file or directory" afterward, since no real project is linked yet on a fresh machine — if a project happens to already be linked and misclassified, the script may exit 1 at the classification check instead, which is also correct behavior to confirm).
5. Commit: `git add scripts/deploy/backup-supabase.sh && git commit -m "feat: add backup-supabase.sh (schema + data dump per environment)"`.

---

## Task 4: Wire backup + linked-project checks + typed confirm + audit log into `deploy-supabase.sh` (prod)

This closes the biggest real gap: today `deploy-supabase.sh` has **zero interactive confirmation** and **zero ref-safety check** of its own — it relies entirely on the external `kamewave` agent hook, which does not protect a human running the command directly in a terminal.

**Files:**

- Modify: `scripts/deploy/deploy-supabase.sh` (full file replacement — the edits touch enough of the file's flow that a full replace is clearer than a hunk list)

**New full content:**

```bash
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
echo "Type prod to confirm deploy to this project:"
read -r confirm
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
```

**Steps:**

1. Replace the full file with the content above.
2. `bash -n scripts/deploy/deploy-supabase.sh`
3. `command -v shellcheck >/dev/null 2>&1 && shellcheck scripts/deploy/deploy-supabase.sh || echo "shellcheck not installed — skipping"`
4. Manual inspect:
   - `./scripts/deploy/deploy-supabase.sh --help` → confirm `--skip-backup` appears and usage text mentions the typed `prod` confirm.
   - `grep -n "print_linked_project\|read -r confirm\|run_backup_if_needed\|log_deploy" scripts/deploy/deploy-supabase.sh` → confirm ordering: `print_linked_project` before the confirm prompt, `run_backup_if_needed` before the dispatch block, `log_deploy` after it.
   - `echo "not-prod" | ./scripts/deploy/deploy-supabase.sh --db-only` (only if a project happens to be linked already — otherwise it exits earlier at the "no linked project" check, which is also a valid pass) → must print `Aborted (expected: prod).` and exit non-zero without ever reaching `run_db_push`.
5. Commit: `git add scripts/deploy/deploy-supabase.sh && git commit -m "feat: add backup, typed confirm, and audit log to prod deploy script"`.

---

## Task 5: Wire backup + linked-project banner + audit log into `deploy-supabase-dev.sh`

**Files:**

- Modify: `scripts/deploy/deploy-supabase-dev.sh` (full file replacement)

**New full content:**

```bash
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

DB_ONLY=false
FUNCTIONS_ONLY=false
INCLUDE_ALL=false
ALLOW_MULTI_TENANCY=false
SKIP_BACKUP=false

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy/deploy-supabase-dev.sh [options]

Deploy to the DEV Supabase project (supabase/.env.dev.local → DEV_PROJECT_REF).
Refuses when DEV_PROJECT_REF matches the currently linked prod ref. Backs up
the dev project first (schema + data) unless --skip-backup is passed.

Options:
  --db-only              Run supabase db push only
  --functions-only       Run supabase functions deploy only
  --include-all          Pass --include-all to db push
  --allow-multi-tenancy  Skip multi-tenancy guard on function deploy
  --skip-backup          Skip the automatic pre-db-push backup (loud warning; not recommended)
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
    --allow-multi-tenancy) ALLOW_MULTI_TENANCY=true; shift ;;
    --skip-backup) SKIP_BACKUP=true; shift ;;
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

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing supabase/.env.dev.local" >&2
  echo "Copy supabase/.env.dev.example → supabase/.env.dev.local and set DEV_PROJECT_REF." >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

DEV_REF="$(tr -d '[:space:]' <<<"${DEV_PROJECT_REF:-}")"
if [[ -z "$DEV_REF" ]]; then
  echo "DEV_PROJECT_REF is empty in supabase/.env.dev.local" >&2
  exit 1
fi

PROD_REF_GUARD="$(tr -d '[:space:]' <<<"${PROD_PROJECT_REF:-}")"
if [[ -n "$PROD_REF_GUARD" && "$DEV_REF" == "$PROD_REF_GUARD" ]]; then
  echo "Refusing dev deploy: DEV_PROJECT_REF matches PROD_PROJECT_REF in .env.dev.local." >&2
  echo "Use a separate Supabase project for dev." >&2
  exit 1
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
echo "Type dev to confirm deploy to this project:"
read -r confirm
if [[ "$confirm" != "dev" ]]; then
  echo "Aborted (expected: dev)."
  exit 1
fi

echo "→ supabase link --project-ref $DEV_REF"
"${SUPABASE[@]}" link --project-ref "$DEV_REF"

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
```

**Steps:**

1. Replace the full file with the content above.
2. `bash -n scripts/deploy/deploy-supabase-dev.sh`
3. `command -v shellcheck >/dev/null 2>&1 && shellcheck scripts/deploy/deploy-supabase-dev.sh || echo "shellcheck not installed — skipping"`
4. Manual inspect: `./scripts/deploy/deploy-supabase-dev.sh --help` shows `--skip-backup`; `grep -n "run_backup_if_needed\|log_deploy\|link --project-ref" scripts/deploy/deploy-supabase-dev.sh` confirms ordering (link → backup → dispatch → log).
5. Commit: `git add scripts/deploy/deploy-supabase-dev.sh && git commit -m "feat: add backup and audit log to dev deploy script"`.

---

## Task 6: `scripts/deploy/rollback-supabase.sh` (DB restore)

**Files:**

- Create: `scripts/deploy/rollback-supabase.sh`
- Modify: `supabase/.env.dev.example` (document optional `DEV_DB_URL`)

**`rollback-supabase.sh` content:**

```bash
#!/usr/bin/env bash
# Restore a backup (from ./scripts/deploy/backup-supabase.sh) into the LINKED
# <dev|prod> Supabase project via psql. Requires a Postgres connection string
# — PROD_DB_URL for prod (same convention as scripts/data/sync-prod-public-data-to-local.sh,
# read from supabase/.env.local), DEV_DB_URL for dev (same convention, read
# from supabase/.env.dev.local). See docs/archive/operations/production-deployment.md
# §12 and docs/archive/operations/migration-runbook.md §6 before restoring.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/dev/check-linked-project.sh
source "$ROOT/scripts/dev/check-linked-project.sh"

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy/rollback-supabase.sh <dev|prod> [options]

Restores a backup produced by ./scripts/deploy/backup-supabase.sh into the
CURRENTLY LINKED <dev|prod> Supabase project via psql.

Requires a Postgres connection string:
  prod: PROD_DB_URL env var, or a PROD_DB_URL= line in supabase/.env.local
  dev:  DEV_DB_URL env var, or a DEV_DB_URL= line in supabase/.env.dev.local
Get the URI from Dashboard → Project Settings → Database → Connect → Session pooler.

Options:
  --file <path>   Restore this specific *_data.sql (or *_schema.sql) file
                   instead of the most recent backups/<env>/*_data.sql
  --schema        Also restore the matching *_schema.sql file FIRST
                   (structural rollback — read migration-runbook.md §6 first)
  --dry-run       Print the psql command(s) that would run; do not execute
  -h, --help      Show this help

Examples:
  DEV_DB_URL='postgresql://...' bun run rollback:supabase:dev
  bun run rollback:supabase:dev -- --dry-run
  PROD_DB_URL='postgresql://...' bun run rollback:supabase:prod   # requires kamewave
  ./scripts/deploy/rollback-supabase.sh prod --file backups/prod/20260806T120000Z_data.sql
EOF
}

ENV_ARG=""
BACKUP_FILE=""
RESTORE_SCHEMA=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    dev | prod)
      if [[ -n "$ENV_ARG" ]]; then
        echo "Unexpected extra positional argument: $1" >&2
        usage >&2
        exit 1
      fi
      ENV_ARG="$1"
      shift
      ;;
    --file)
      BACKUP_FILE="${2:-}"
      if [[ -z "$BACKUP_FILE" ]]; then
        echo "--file requires a path" >&2
        exit 1
      fi
      shift 2
      ;;
    --schema)
      RESTORE_SCHEMA=true
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
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$ENV_ARG" ]]; then
  echo "Missing required argument: dev or prod" >&2
  usage >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql not found." >&2
  echo "macOS: brew install libpq, then add libpq's bin/ to PATH (see scripts/data/sync-prod-public-data-to-local.sh header)." >&2
  exit 1
fi

DB_URL=""
if [[ "$ENV_ARG" == "prod" ]]; then
  DB_URL="${PROD_DB_URL:-}"
  [[ -z "$DB_URL" ]] && DB_URL="$(read_env_file_var "$ROOT/supabase/.env.local" "PROD_DB_URL")"
else
  DB_URL="${DEV_DB_URL:-}"
  [[ -z "$DB_URL" ]] && DB_URL="$(read_env_file_var "$ROOT/supabase/.env.dev.local" "DEV_DB_URL")"
fi

if [[ -z "$DB_URL" ]]; then
  UPPER_ENV="$(printf '%s' "$ENV_ARG" | tr '[:lower:]' '[:upper:]')"
  echo "ERROR: Set ${UPPER_ENV}_DB_URL (Dashboard → Connect → Session pooler URI)." >&2
  exit 1
fi

print_linked_project
if [[ "$LINKED_PROJECT_KIND" != "$ENV_ARG" ]]; then
  echo "" >&2
  echo "ERROR: You asked to roll back '$ENV_ARG' but the linked project looks like '$LINKED_PROJECT_KIND' ($LINKED_PROJECT_REF)." >&2
  echo "Re-link to $ENV_ARG first, then re-run." >&2
  exit 1
fi

BACKUP_DIR="$ROOT/backups/$ENV_ARG"
DATA_FILE=""
SCHEMA_FILE=""

if [[ -n "$BACKUP_FILE" ]]; then
  DATA_FILE="$BACKUP_FILE"
  SCHEMA_FILE="${BACKUP_FILE/_data.sql/_schema.sql}"
else
  DATA_FILE="$(ls -1t "$BACKUP_DIR"/*_data.sql 2>/dev/null | head -1 || true)"
  if [[ -z "$DATA_FILE" ]]; then
    echo "ERROR: No backups found in $BACKUP_DIR." >&2
    echo "Run: bun run backup:supabase:$ENV_ARG" >&2
    exit 1
  fi
  SCHEMA_FILE="${DATA_FILE/_data.sql/_schema.sql}"
fi

if [[ ! -f "$DATA_FILE" ]]; then
  echo "ERROR: Data backup file not found: $DATA_FILE" >&2
  exit 1
fi

if [[ "$RESTORE_SCHEMA" == true && ! -f "$SCHEMA_FILE" ]]; then
  echo "ERROR: --schema was set but matching schema file not found: $SCHEMA_FILE" >&2
  exit 1
fi

echo "════════════════════════════════════════════════════════════"
echo "  ROLLBACK — $ENV_ARG"
echo "  Linked project: $LINKED_PROJECT_REF"
if [[ "$RESTORE_SCHEMA" == true ]]; then
  echo "  Schema file: $SCHEMA_FILE"
fi
echo "  Data file:   $DATA_FILE"
echo "  See docs/archive/operations/migration-runbook.md §6 (restore caveats)"
echo "════════════════════════════════════════════════════════════"

if [[ "$DRY_RUN" == true ]]; then
  if [[ "$RESTORE_SCHEMA" == true ]]; then
    echo "[dry-run] psql \"\$DB_URL\" -v ON_ERROR_STOP=1 -f $SCHEMA_FILE"
  fi
  echo "[dry-run] psql \"\$DB_URL\" -v ON_ERROR_STOP=1 -f $DATA_FILE"
  exit 0
fi

echo ""
echo "Type $ENV_ARG to confirm restoring into this project (existing rows may be overwritten/duplicated — see caveats above):"
read -r confirm
if [[ "$confirm" != "$ENV_ARG" ]]; then
  echo "Aborted (expected: $ENV_ARG)."
  exit 1
fi

if [[ "$RESTORE_SCHEMA" == true ]]; then
  echo "→ Restoring schema from $SCHEMA_FILE"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SCHEMA_FILE"
fi

echo "→ Restoring data from $DATA_FILE"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$DATA_FILE"

log_deploy "$ENV_ARG" "rollback"

echo ""
echo "Rollback complete ($ENV_ARG)."
```

**`supabase/.env.dev.example` edit** — insert after the `# Safety: set to your production project ref …` comment block (after the `# PROD_PROJECT_REF=replace-with-prod-project-ref` line):

```

# Optional: dev Postgres connection string for ./scripts/deploy/rollback-supabase.sh dev
# (Dashboard → Connect → Session pooler URI). Never commit a real value.
# DEV_DB_URL=postgresql://postgres.[DEV_REF]:PASSWORD@aws-0-....pooler.supabase.com:6543/postgres
```

**Steps:**

1. Write `rollback-supabase.sh`, `chmod +x scripts/deploy/rollback-supabase.sh`.
2. Apply the `supabase/.env.dev.example` edit.
3. `bash -n scripts/deploy/rollback-supabase.sh`
4. `command -v shellcheck >/dev/null 2>&1 && shellcheck scripts/deploy/rollback-supabase.sh || echo "shellcheck not installed — skipping"`
5. Manual dry-run:
   - `./scripts/deploy/rollback-supabase.sh` (no args) → usage + exit 1.
   - `./scripts/deploy/rollback-supabase.sh dev --dry-run` with no `DEV_DB_URL` set anywhere → exits 1 with the "Set DEV_DB_URL" error (connection info is required before anything else happens, by design).
   - `DEV_DB_URL='postgresql://fake' ./scripts/deploy/rollback-supabase.sh dev --dry-run` → reaches the linked-project check and either prints the `[dry-run]` psql lines or the "no backups found in backups/dev" error — in both cases, confirm no real `psql` process ever runs (`ps aux | grep -c "[p]sql"` unaffected).
6. Commit: `git add scripts/deploy/rollback-supabase.sh supabase/.env.dev.example && git commit -m "feat: add rollback-supabase.sh (restore from backup via psql)"`.

---

## Task 7: `scripts/deploy/rollback-functions.sh` (Edge Functions rollback via git worktree)

**Files:**

- Create: `scripts/deploy/rollback-functions.sh`

**Content:**

```bash
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
```

**Steps:**

1. Write, `chmod +x scripts/deploy/rollback-functions.sh`.
2. `bash -n scripts/deploy/rollback-functions.sh`
3. `command -v shellcheck >/dev/null 2>&1 && shellcheck scripts/deploy/rollback-functions.sh || echo "shellcheck not installed — skipping"`
4. Manual dry-run: `./scripts/deploy/rollback-functions.sh dev main --dry-run` — if no dev project is linked yet this will correctly exit 1 at the linked-project check (that's a valid pass on a fresh machine); if a dev project _is_ linked, it must print the `git worktree add` + `supabase functions deploy` lines and exit 0 without creating a worktree (`git worktree list` shows no `rollback-functions-*` entry afterward). Then `./scripts/deploy/rollback-functions.sh dev not-a-real-ref --dry-run` → must error `not a valid git ref` before reaching the linked-project check, regardless of link state.
5. Commit: `git add scripts/deploy/rollback-functions.sh && git commit -m "feat: add rollback-functions.sh (redeploy edge functions from an older git ref)"`.

---

## Task 8: `scripts/deploy/migration-status.sh` (read-only migration drift)

**Files:**

- Create: `scripts/deploy/migration-status.sh`

**Content:**

```bash
#!/usr/bin/env bash
# Read-only: show applied vs. pending migrations for dev or prod
# (`supabase migration list --linked`). Never mutates schema — safe without
# kamewave for both dev and prod.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

SUPABASE=("$ROOT/scripts/dev/bunx" --bun supabase@latest)
ENV_FILE="$ROOT/supabase/.env.dev.local"
# shellcheck source=scripts/dev/check-linked-project.sh
source "$ROOT/scripts/dev/check-linked-project.sh"

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy/migration-status.sh <dev|prod>

Read-only. Shows `supabase migration list --linked` for the requested
environment (dev re-links via DEV_PROJECT_REF from supabase/.env.dev.local;
prod uses whatever is currently linked and warns if it doesn't look like prod).
EOF
}

ENV_ARG="${1:-}"
if [[ "$ENV_ARG" != "dev" && "$ENV_ARG" != "prod" ]]; then
  usage >&2
  exit 1
fi

if [[ "$ENV_ARG" == "dev" ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERROR: Missing supabase/.env.dev.local (copy from supabase/.env.dev.example)." >&2
    exit 1
  fi
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
  DEV_REF="$(tr -d '[:space:]' <<<"${DEV_PROJECT_REF:-}")"
  if [[ -z "$DEV_REF" ]]; then
    echo "ERROR: DEV_PROJECT_REF is empty in supabase/.env.dev.local" >&2
    exit 1
  fi
  echo "→ supabase link --project-ref $DEV_REF"
  "${SUPABASE[@]}" link --project-ref "$DEV_REF" >/dev/null
fi

print_linked_project
if [[ "$ENV_ARG" == "prod" && "$LINKED_PROJECT_KIND" != "prod" ]]; then
  echo "WARNING: asked for prod migration status but linked project looks like '$LINKED_PROJECT_KIND'." >&2
  echo "Re-link to prod first: bunx supabase@latest link --project-ref <prod-ref>" >&2
fi

echo ""
echo "→ supabase migration list --linked"
"${SUPABASE[@]}" migration list --linked
```

**Steps:**

1. Write, `chmod +x scripts/deploy/migration-status.sh`.
2. `bash -n scripts/deploy/migration-status.sh`
3. `command -v shellcheck >/dev/null 2>&1 && shellcheck scripts/deploy/migration-status.sh || echo "shellcheck not installed — skipping"`
4. Manual inspect: `./scripts/deploy/migration-status.sh` (no arg) → usage, exit 1; `./scripts/deploy/migration-status.sh badenv` → same. If `supabase/.env.dev.local` doesn't exist on this machine, `./scripts/deploy/migration-status.sh dev` must fail with the "Missing supabase/.env.dev.local" error, not crash with an unset-variable error.
5. Commit: `git add scripts/deploy/migration-status.sh && git commit -m "feat: add read-only migration-status.sh for dev/prod drift visibility"`.

---

## Task 9: `package.json` npm scripts

**Files:**

- Modify: `package.json` (lines 49–52)

**Replace:**

```json
    "deploy:supabase": "./scripts/deploy/deploy-supabase.sh",
    "deploy:supabase:db": "./scripts/deploy/deploy-supabase.sh --db-only",
    "deploy:supabase:functions": "./scripts/deploy/deploy-supabase.sh --functions-only",
    "deploy:supabase:dev": "./scripts/deploy/deploy-supabase-dev.sh"
```

**With:**

```json
    "deploy:supabase": "./scripts/deploy/deploy-supabase.sh",
    "deploy:supabase:db": "./scripts/deploy/deploy-supabase.sh --db-only",
    "deploy:supabase:functions": "./scripts/deploy/deploy-supabase.sh --functions-only",
    "deploy:supabase:dev": "./scripts/deploy/deploy-supabase-dev.sh",
    "deploy:supabase:dev:db": "./scripts/deploy/deploy-supabase-dev.sh --db-only",
    "deploy:supabase:dev:functions": "./scripts/deploy/deploy-supabase-dev.sh --functions-only",
    "backup:supabase:dev": "./scripts/deploy/backup-supabase.sh dev",
    "backup:supabase:prod": "./scripts/deploy/backup-supabase.sh prod",
    "rollback:supabase:dev": "./scripts/deploy/rollback-supabase.sh dev",
    "rollback:supabase:prod": "./scripts/deploy/rollback-supabase.sh prod",
    "rollback:functions:dev": "./scripts/deploy/rollback-functions.sh dev",
    "rollback:functions:prod": "./scripts/deploy/rollback-functions.sh prod",
    "migrations:status:dev": "./scripts/deploy/migration-status.sh dev",
    "migrations:status:prod": "./scripts/deploy/migration-status.sh prod",
    "env:status": "./scripts/dev/check-linked-project.sh"
```

**Steps:**

1. Apply the edit (note the added trailing comma after `deploy:supabase:dev`'s value).
2. `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('valid JSON')"`
3. Manual inspect: `bun run` (no args) lists all scripts — confirm every new key appears; `bun run deploy:supabase:dev:db -- --help` reaches `deploy-supabase-dev.sh`'s usage and exits 0 (proves `--db-only` composes correctly with forwarded `--help`).
4. Commit: `git add package.json && git commit -m "feat: add npm scripts for backup, rollback, and migration/env status"`.

---

## Task 10: `.vscode/tasks.json`

**Files:**

- Modify: `.vscode/tasks.json` — insert new task objects immediately before the `"Preview: Emails from DB"` task (label at line 189; insert before its opening `{`).

**Insert (9 new task objects, matching the existing task-object shape used by neighboring `Deploy:`/`Supabase:` tasks — read one of those first, e.g. the `"Deploy: Supabase dev (db + functions)"` task at line 171, and mirror its exact key set):**

```json
    {
      "label": "Deploy: Supabase dev (db only)",
      "type": "shell",
      "command": "bun run deploy:supabase:dev:db",
      "options": { "cwd": "${workspaceFolder}" }
    },
    {
      "label": "Deploy: Supabase dev (functions only)",
      "type": "shell",
      "command": "bun run deploy:supabase:dev:functions",
      "options": { "cwd": "${workspaceFolder}" }
    },
    {
      "label": "Backup: Supabase dev",
      "type": "shell",
      "command": "bun run backup:supabase:dev",
      "options": { "cwd": "${workspaceFolder}" }
    },
    {
      "label": "Backup: Supabase prod",
      "type": "shell",
      "command": "bun run backup:supabase:prod",
      "options": { "cwd": "${workspaceFolder}" }
    },
    {
      "label": "Rollback: Supabase dev",
      "type": "shell",
      "command": "bun run rollback:supabase:dev",
      "options": { "cwd": "${workspaceFolder}" }
    },
    {
      "label": "Rollback: Supabase PROD (requires kamewave)",
      "type": "shell",
      "command": "bun run rollback:supabase:prod",
      "options": { "cwd": "${workspaceFolder}" }
    },
    {
      "label": "Env: Status (linked project)",
      "type": "shell",
      "command": "bun run env:status",
      "options": { "cwd": "${workspaceFolder}" }
    },
    {
      "label": "Migrations: Status (dev)",
      "type": "shell",
      "command": "bun run migrations:status:dev",
      "options": { "cwd": "${workspaceFolder}" }
    },
    {
      "label": "Migrations: Status (prod)",
      "type": "shell",
      "command": "bun run migrations:status:prod",
      "options": { "cwd": "${workspaceFolder}" }
    },
```

Match whatever exact key set/formatting the existing neighboring task objects use (read `.vscode/tasks.json` lines 165–189 first) — the shape above is the minimum; carry over any `problemMatcher` or `presentation` keys already established as this file's convention if present.

Note: `rollback:functions:*` tasks are intentionally omitted from `tasks.json` — they require a git-ref argument, which is better suited to CLI usage (`bun run rollback:functions:dev -- main`) than a canned VS Code task. This is a deliberate choice, not an oversight.

**Steps:**

1. Read `.vscode/tasks.json` lines 160–202 first to confirm the exact task-object shape (some tasks may include `problemMatcher: []` or `presentation` blocks not shown in this plan's assumed shape — match whatever is actually there).
2. Apply the insertion.
3. `node -e "JSON.parse(require('fs').readFileSync('.vscode/tasks.json','utf8')); console.log('valid JSON')"`
4. Manual inspect in VS Code: Terminal → Run Task → confirm all 9 new labels appear in the picker.
5. Commit: `git add .vscode/tasks.json && git commit -m "feat: add VS Code tasks for backup, rollback, and status scripts"`.

---

## Task 11: `.gitignore` — ignore `backups/`

**Files:**

- Modify: `.gitignore`

**Edit** — insert a new section after the `supabase/.env.dev.local` line (in the existing "Environment files" block):

```

# Deploy artifacts (DB backups, deploy audit log — may contain PII/refs, never commit)
backups/
.worktrees/
```

**Steps:**

1. Apply the edit.
2. `git check-ignore -v backups/dev/test_data.sql` (create the empty dir first: `mkdir -p backups/dev && touch backups/dev/test_data.sql`) — must report the new `.gitignore` rule as the match. Clean up the test file afterward: `rm -rf backups`.
3. `git check-ignore -v .worktrees/rollback-functions-test` — must also match.
4. Commit: `git add .gitignore && git commit -m "chore: gitignore backups/ and .worktrees/"`.

---

## Task 12: `scripts/README.md`

**Files:**

- Modify: `scripts/README.md`

**Edit 1 — Dev table:** add a row for the new helper after the existing `check-ai-tooling-sync.sh` row:

```
| `check-linked-project.sh`              | deploy/backup/rollback/migration-status scripts, `bun run env:status` | Print "You are linked to: <ref> (<dev\|prod\|unknown>)"; `log_deploy()` writes `backups/deploy-log.csv` |
```

**Edit 2 — replace the entire "## Deploy" section with:**

```markdown
## Deploy (`scripts/deploy/`)

| Script                   | npm script                                 | Purpose                                                                                                        |
| ------------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `deploy-supabase.sh`     | `bun run deploy:supabase`                  | `db push` + `functions deploy` to linked **prod** project (backup first, typed `prod` confirm, kamewave-gated) |
| `deploy-supabase-dev.sh` | `bun run deploy:supabase:dev`              | `db push` + `functions deploy` to linked **dev** project (backup first, typed `dev` confirm, no kamewave)      |
| `backup-supabase.sh`     | `bun run backup:supabase:dev` / `:prod`    | `supabase db dump --linked` (schema + data) → `backups/<env>/` (gitignored); read-only                         |
| `rollback-supabase.sh`   | `bun run rollback:supabase:dev` / `:prod`  | Restore most recent (or `--file`) backup via `psql`; prod is kamewave-gated                                    |
| `rollback-functions.sh`  | `bun run rollback:functions:dev` / `:prod` | Redeploy Edge Functions from an older git ref via a throwaway `git worktree`; prod is kamewave-gated           |
| `migration-status.sh`    | `bun run migrations:status:dev` / `:prod`  | Read-only `supabase migration list --linked` per environment                                                   |

Every deploy and rollback appends an audit line to `backups/deploy-log.csv` (timestamp, env, kind, git SHA/branch, OS user) via `log_deploy()` in `scripts/dev/check-linked-project.sh`.
```

**Steps:**

1. Apply both edits.
2. `bunx prettier --check scripts/README.md` (repo's `format:check` script globs `.md`) — fix table alignment if flagged; run `bunx prettier --write scripts/README.md` if so, then re-check.
3. Manual inspect: re-read the rendered tables for column-alignment sanity.
4. Commit: `git add scripts/README.md && git commit -m "docs: document backup/rollback/status scripts in scripts/README.md"`.

---

## Task 13: Docs pass A — `dev-staging-environment.md` + `production-deployment.md`

**Files:**

- Modify: `docs/archive/operations/dev-staging-environment.md`
- Modify: `docs/archive/operations/production-deployment.md`

### `dev-staging-environment.md`

**Edit 1 — fix the kamewave/dev-deploy claim (line 53):** replace

```
**Important:** Production Supabase deploys stay blocked until a human says unlock word **`kamewave`** in chat (`.cursor/rules/no-prod-deploy.mdc`). Dev deploys use `bun run deploy:supabase:dev` and never touch prod.
```

with

```
**Important:** Production Supabase deploys stay blocked until a human says unlock word **`kamewave`** in chat (`.cursor/rules/no-prod-deploy.mdc`). Dev deploys (`bun run deploy:supabase:dev`, `:dev:db`, `:dev:functions`) run **without** the kamewave prompt — the script's own DEV/PROD ref check plus a typed `dev` confirmation is the safety net, and it never touches prod.
```

**Edit 2 — §6 VS Code tasks table:** add rows after the `Deploy: Supabase dev` row (line 439):

```
| **Deploy: Supabase dev (db only)**        | `bun run deploy:supabase:dev:db`                             |
| **Deploy: Supabase dev (functions only)** | `bun run deploy:supabase:dev:functions`                      |
| **Backup: Supabase dev / prod**           | `bun run backup:supabase:dev` / `:prod`                      |
| **Rollback: Supabase dev / PROD**         | `bun run rollback:supabase:dev` / `:prod` (prod = kamewave)  |
| **Env: Status**                           | `bun run env:status`                                          |
| **Migrations: Status (dev / prod)**       | `bun run migrations:status:dev` / `:prod`                     |
```

**Edit 3 — §7 "Which Supabase project am I linked to?":** add after the table (after line 454):

```

Or the scripted version: `bun run env:status` (prints ref + `dev`/`prod`/`unknown` classification).
```

**Edit 4 — §9 Quick reference commands:** add after `bun run deploy:supabase:dev` (line 488):

```

# Back up dev / prod (also runs automatically before deploy — skip with --skip-backup)
bun run backup:supabase:dev
bun run backup:supabase:prod

# Roll back to most recent backup
bun run rollback:supabase:dev
bun run rollback:supabase:prod   # requires kamewave

# Check who's applied what migrations where (read-only)
bun run migrations:status:dev
bun run migrations:status:prod
```

**Edit 5 — §10 Related files table:** add rows after the `deploy-supabase-dev.sh` row (line 503):

```
| [`scripts/deploy/backup-supabase.sh`](../../../scripts/deploy/backup-supabase.sh)       | Pre-deploy backups (dev + prod)        |
| [`scripts/deploy/rollback-supabase.sh`](../../../scripts/deploy/rollback-supabase.sh)   | DB restore from backup                 |
| [`scripts/deploy/rollback-functions.sh`](../../../scripts/deploy/rollback-functions.sh) | Edge Functions rollback (git worktree) |
| [`scripts/deploy/migration-status.sh`](../../../scripts/deploy/migration-status.sh)     | Read-only migration drift check        |
| [`scripts/dev/check-linked-project.sh`](../../../scripts/dev/check-linked-project.sh)   | Linked-project preflight + audit log   |
```

**Edit 6 — append a new final section (after line 505, end of file):**

````markdown
---

## 11. Backups & rollback

Every `deploy:supabase*` run backs up first (`backup-supabase.sh`) unless `--skip-backup` is passed — schema and data dumps land in `backups/<env>/<UTC-timestamp>_{schema,data}.sql` (gitignored). Every deploy and rollback also appends a row to `backups/deploy-log.csv` (timestamp, env, kind, git SHA/branch, OS user) — a lightweight audit trail of who deployed what, when.

```bash
# Manual backup
bun run backup:supabase:dev
bun run backup:supabase:prod

# Restore the most recent backup (add --schema to also restore structure)
bun run rollback:supabase:dev
bun run rollback:supabase:prod       # requires kamewave + typed "prod" confirm

# Roll back Edge Functions to an older commit (no local checkout needed)
bun run rollback:functions:dev -- main
bun run rollback:functions:prod -- main   # requires kamewave
```
````

Both rollback scripts refuse to run if the currently linked project doesn't match the `<dev|prod>` argument, and both support `--dry-run` to preview the exact restore command without executing it. `rollback-supabase.sh` needs a Postgres connection string — `DEV_DB_URL` / `PROD_DB_URL` — supplied at runtime (same convention as `PROD_DB_URL` in `scripts/data/sync-prod-public-data-to-local.sh`); it is never committed.

See [`production-deployment.md`](./production-deployment.md) §1 and §12 for the prod-specific checklist, and [`migration-runbook.md`](./migration-runbook.md) §6 for restore caveats.

````

### `production-deployment.md`

**Edit 1 — §1, insert before the "Patterns" line (before current line 44):**
```markdown
**Automated (preferred):** `bun run backup:supabase:prod` runs `supabase db dump --linked` (schema) and `--data-only` (data) into `backups/prod/<UTC-timestamp>_{schema,data}.sql` (gitignored). It refuses to run unless the linked project actually looks like prod. This also runs automatically as the first step of `bun run deploy:supabase` / `deploy:supabase:db` (skip via `--skip-backup`, not recommended — prints a loud warning).

**Manual (fallback / Pro+ Dashboard snapshot) — pick one or both, treat output as PII:**
````

(This replaces the standalone `**Patterns (pick one or both — treat output as PII):**` line at current line 44 — fold its wording into the new "Manual (fallback...)" line above rather than keeping both.)

**Edit 2 — §12 Rollback / incidents, replace the section body (current lines 236–244) with:**

```markdown
## 12. Rollback / incidents

**First option — automated restore:** `bun run rollback:supabase:prod` restores the most recent `backups/prod/*_data.sql` (add `--schema` to also restore the matching `*_schema.sql` first) via `psql` against the linked project. Same `kamewave` gate as prod deploy, plus a typed `prod` confirmation. Dry-run first: `./scripts/deploy/rollback-supabase.sh prod --dry-run`.

**Edge Functions rollback:** `bun run rollback:functions:prod -- <git-ref>` (e.g. `main`) redeploys `supabase/functions/` from an older commit via a throwaway `git worktree` — no need to check out that commit on your machine.

Otherwise prefer **fix-forward** (correct data SQL + re-**`push`**) unless you staged a downtime restore window.

**Postgres logical restore caveats:** data dump column lists must align with restored schema migrations — mismatched eras break **`INSERT`** / **`COPY`**.

Phase 0 **schema** rollback DDL only (**not** full rewind of every later migration): **`migration-runbook.md` §6**.

Migration history repair / **`--include-all`**: **§5.1** ibid., **§3** above table.
```

**Edit 3 — Quick command reference, add after `bun run deploy:supabase:functions` (current line 257):**

```

# Backups & rollback
bun run backup:supabase:prod
bun run rollback:supabase:prod   # requires kamewave
bun run migrations:status:prod   # read-only drift check
```

**Editorial re-read (part of this task, don't skip):** after applying all edits above, re-read `dev-staging-environment.md` §1–§4 and `production-deployment.md` §0–§12 end to end. Confirm every command referenced (`deploy:supabase:dev*`, `db push`, `functions deploy`, `migration list --linked`, the new backup/rollback/status scripts) matches actual script behavior after Task 1's guard fix, and that no stale claim survives (e.g. nothing implies dev deploy still needs kamewave). Do not attempt to script actual Supabase project creation — the existing manual Dashboard step stays manual.

**Steps:**

1. Apply all edits to both files.
2. `bunx prettier --check docs/archive/operations/dev-staging-environment.md docs/archive/operations/production-deployment.md` — fix any table-formatting complaints with `--write` then re-check.
3. Manual inspect: `grep -n "kamewave" docs/archive/operations/dev-staging-environment.md` — confirm the line ~53 area reads correctly; `grep -rn "backup:supabase\|rollback:supabase\|rollback:functions\|migrations:status" docs/archive/operations/*.md` — confirm every new script appears in both files.
4. Do the editorial re-read described above; fix anything found.
5. Commit both files together: `git add docs/archive/operations/dev-staging-environment.md docs/archive/operations/production-deployment.md && git commit -m "docs: document backup/rollback/status tooling in dev and prod runbooks"`.

---

## Task 14: Docs pass B — migration-runbook, architecture summary, rule doc, CLAUDE.md, workflow index/stub

**Files:**

- Modify: `docs/archive/operations/migration-runbook.md`
- Modify: `docs/architecture/deployment.md`
- Modify: `.cursor/rules/no-prod-deploy.mdc`
- Modify: `CLAUDE.md`
- Modify: `docs/workflow/in-progress/ci-cd-environments/dev-staging-environment.md`

### `migration-runbook.md`

**Edit 1 — §5 step 1 (current line 242), append a sentence:**

```
1. Backup the DB: **Pro+** Dashboard → Database → Backups; **Free** → **`pg_dump`** (pooler URI from **Connect** — **§3.5.3** URI guidance) **and/or** **`bunx supabase@latest db dump --linked --data-only`**; keep dumps **off git** (**PII**). Or automated: `bun run backup:supabase:prod` (also runs automatically before `deploy:supabase`/`deploy:supabase:db` unless `--skip-backup`).
```

**Edit 2 — §6 Rollback, insert a paragraph right after the `## 6. Rollback` heading (before current line 281):**

```markdown
**Automated first option:** `bun run rollback:supabase:prod` restores the most recent `backups/prod/*_data.sql` (or `--schema` too) via `psql`, kamewave-gated with a typed `prod` confirm; `bun run rollback:functions:prod -- <git-ref>` redeploys Edge Functions from an older commit via a throwaway `git worktree`. See `production-deployment.md` §12.
```

### `docs/architecture/deployment.md`

**Edit — after the "Dev deploy:" bullet (current line 23):**

```markdown
- **Backups & rollback:** `bun run backup:supabase:<dev|prod>`, `rollback:supabase:<dev|prod>`, `rollback:functions:<dev|prod>` — see `production-deployment.md` §1/§12.
- **Env / migration status:** `bun run env:status`, `migrations:status:dev`, `migrations:status:prod` (read-only).
```

### `.cursor/rules/no-prod-deploy.mdc`

**Edit 1 — Blocked table, add a row after "Deploy scripts" (current line 34):**

```
| Rollback (prod)                   | `bun run rollback:supabase:prod`, `rollback:functions:prod`, `./scripts/deploy/rollback-supabase.sh prod`, `rollback-functions.sh prod` |
```

**Edit 2 — Allowed table, add rows after "Prod → local sync" (current line 55):**

```
| Dev deploy / rollback     | `bun run deploy:supabase:dev` (+ `:dev:db`/`:dev:functions`), `deploy-supabase-dev.sh`, `rollback:supabase:dev`, `rollback:functions:dev` — the dev script's own DEV/PROD ref check + typed `dev` confirm is the safety net |
| Backups (any env)         | `bun run backup:supabase:dev` / `:prod` — same primitive as `db dump --linked`, non-destructive |
| Env / migration status    | `bun run env:status`, `migrations:status:dev`, `migrations:status:prod` — read-only |
```

**Edit 3 — Shell hook enforcement section (current line 68), extend the sentence:**

```markdown
`.cursor/hooks/guard-shell.sh` and `.claude/hooks/guard-shell.sh` **deny** blocked commands unless **`kamewave`** appears in the command string. Rules alone are not enough — hooks are the backstop. The shared lib (`scripts/dev/prod-deploy-guard-lib.sh`) checks dev-targeted/read-only command shapes first, so a dev deploy/backup/status command is never mistaken for a prod one.
```

### `CLAUDE.md`

**Edit — Commands block, after `bun run deploy:supabase:dev     # deploy migrations + functions to dev project`:**

```
bun run backup:supabase:dev / :prod     # pre-deploy backups (also automatic before deploy)
bun run rollback:supabase:dev / :prod   # restore most recent backup (prod: kamewave required)
bun run env:status                      # which Supabase project is linked (dev/prod/unknown)
```

### `docs/workflow/in-progress/ci-cd-environments/dev-staging-environment.md`

**Edit — "Shipped in repo" table, add rows after the "Dev deploy script" row (current line 25):**

```
| Backup / rollback / status | `scripts/deploy/backup-supabase.sh`, `rollback-supabase.sh`, `rollback-functions.sh`, `migration-status.sh` |
| Linked-project + audit helper | `scripts/dev/check-linked-project.sh` (also writes `backups/deploy-log.csv`) |
```

(This plan is already registered in `docs/workflow/planned/README.md` — done at plan-authoring time, not an execution task.)

**Recommendation to record, not a task (cannot be scripted from this repo):** note in `production-deployment.md` §0 Preconditions, as a new bullet, that the team should enable **GitHub branch protection on `main`** requiring the `quality` CI check (`ci.yml`) to pass before merge — since prod deploys are documented as "must deploy from `main`" (§4), an unprotected `main` means that guarantee currently depends on discipline, not enforcement. Add:

```
| Branch protection (recommended) | Enable required-status-checks on `main` (GitHub repo Settings → Branches) so the `quality` CI job must pass before merge — prod deploys assume `main` is always green. |
```

as a new row in the §0 Preconditions table.

**Steps:**

1. Apply all edits across the five files.
2. `bunx prettier --check docs/archive/operations/migration-runbook.md docs/architecture/deployment.md CLAUDE.md docs/workflow/in-progress/ci-cd-environments/dev-staging-environment.md` and separately `bunx prettier --check .cursor/rules/no-prod-deploy.mdc` (repo's `format:check` script globs `.mdc` too) — fix with `--write` + re-check as needed.
3. Manual inspect: `grep -n "rollback:supabase:prod\|rollback:functions:prod" .cursor/rules/no-prod-deploy.mdc` confirms the new Blocked row; `grep -n "backup:supabase\|env:status\|migrations:status" .cursor/rules/no-prod-deploy.mdc` confirms the new Allowed rows.
4. Re-run Task 1's manual verification block one more time now that every script name it references actually exists as a real file (catches any naming drift introduced across Tasks 2–14).
5. Commit: `git add docs/archive/operations/migration-runbook.md docs/architecture/deployment.md .cursor/rules/no-prod-deploy.mdc CLAUDE.md docs/workflow/in-progress/ci-cd-environments/dev-staging-environment.md && git commit -m "docs: sync migration runbook, architecture summary, rule doc, and CLAUDE.md with new deploy tooling"`.

---

## Final end-to-end verification (after Task 14)

1. `bun run lint && bun run type-check && bun run build && bun run check:filenames` — confirm nothing in this plan broke the existing quality gate (none of these tasks touch `ui/` or TypeScript, so this is a fast regression check).
2. Re-run the Task 1 guard assertion block in full — every line must still print `PASS`.
3. `find scripts/deploy scripts/dev -name '*.sh' -newer package.json -exec bash -n {} \;` — quick syntax sweep across every new/modified script in one shot (no output = all pass).
4. `command -v shellcheck >/dev/null 2>&1 && shellcheck scripts/deploy/*.sh scripts/dev/check-linked-project.sh scripts/dev/prod-deploy-guard-lib.sh || echo "shellcheck not installed — skipping full sweep"`.
5. `git log --oneline -14` — confirm 14 commits landed (one per task), each independently reviewable.
6. Manual walkthrough against a real dev Supabase project, once one exists (this cannot be verified without live credentials, so treat it as the operator's first real-world smoke test, not a plan-completion blocker):
   - `bun run env:status` shows `dev`.
   - `bun run backup:supabase:dev` produces two files under `backups/dev/`.
   - `bun run deploy:supabase:dev -- --db-only` runs the typed `dev` confirm, backs up first, pushes.
   - `bun run migrations:status:dev` shows the pushed migration as applied.
   - `bun run rollback:supabase:dev -- --dry-run` shows the correct restore command against the backup just taken.
7. Confirm the plan's own docs edits render correctly: open `docs/archive/operations/dev-staging-environment.md` and `production-deployment.md` in a Markdown preview and check the new tables/sections aren't malformed.

## Critical files for implementation

- `scripts/dev/prod-deploy-guard-lib.sh` — the actual safety boundary; get Task 1 right first.
- `scripts/dev/check-linked-project.sh` — shared by every other new script; get Task 2 right second.
- `scripts/deploy/deploy-supabase.sh` / `deploy-supabase-dev.sh` — existing scripts being extended, not replaced in spirit.
- `scripts/deploy/backup-supabase.sh`, `rollback-supabase.sh`, `rollback-functions.sh`, `migration-status.sh` — new.
- `package.json`, `.vscode/tasks.json`, `.gitignore` — plumbing.
- `docs/archive/operations/dev-staging-environment.md`, `production-deployment.md`, `migration-runbook.md`, `docs/architecture/deployment.md`, `.cursor/rules/no-prod-deploy.mdc`, `CLAUDE.md` — must all describe the same real behavior after this plan lands.
