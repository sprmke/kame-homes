#!/usr/bin/env bash
# Host edge-functions server with merged supabase/.temp/functions-serve.env.
# Mirrors dev.sh edge portion. Foreground process for the edge-functions terminal.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

for _ in $(seq 1 90); do
  if bun run status:supabase >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

docker rm -f supabase_edge_runtime_guest-form-management >/dev/null 2>&1 || true

(
  for _ in $(seq 1 60); do
    if docker ps --format '{{.Names}}' | grep -q '^supabase_edge_runtime_guest-form-management$'; then
      sleep 2
      docker restart supabase_kong_guest-form-management >/dev/null 2>&1 || true
      break
    fi
    sleep 1
  done
) &

./scripts/dev/build-local-functions-env.sh >/dev/null
exec ./scripts/dev/bunx --bun supabase@latest functions serve --env-file "$ROOT/supabase/.temp/functions-serve.env"
