#!/usr/bin/env bash
# Serve edge functions locally against a hosted dev Supabase project (hybrid mode).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

export PATH="/usr/local/bin:/opt/homebrew/bin:${HOME}/.bun/bin:${PATH}"

if ! docker info >/dev/null 2>&1; then
  echo "Docker is required for supabase functions serve (edge-runtime container)." >&2
  echo "Start Docker Desktop, or use ./dev.sh --ui-only --env dev against deployed dev functions." >&2
  exit 1
fi

FUNCS_ENV="$("$ROOT/scripts/dev/build-remote-functions-env.sh")"
# shellcheck source=/dev/null
source "$ROOT/scripts/dev/export-remote-supabase-runtime-env.sh"

echo "Remote API mode: http://127.0.0.1:54321/functions/v1 → ${DEV_SUPABASE_URL}"
echo "Run UI in another terminal: ./dev.sh --ui-only --env dev (hybrid URLs in ui/.env.development.dev)"
echo ""

exec "$ROOT/scripts/dev/bunx" --bun supabase@latest functions serve --env-file "$FUNCS_ENV"
