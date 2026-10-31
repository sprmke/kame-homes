#!/usr/bin/env bash
# Cloud Agent start (every boot): docker + nested-VM fixes, local Supabase stack.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

"$ROOT/.cursor/write-env-files.sh"
"$ROOT/.cursor/docker-up.sh"

echo "==== [start] supabase start ===="
bun run start:supabase

docker restart supabase_kong_guest-form-management >/dev/null 2>&1 || true

echo "==== [start] local Supabase is up (API :54321, Studio :54323) ===="
