#!/usr/bin/env bash
# Load ui env profile then start Vite. Used by dev.sh --ui-only --env local|dev.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_PROFILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV_PROFILE="${2:?--env requires local or dev}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

case "$ENV_PROFILE" in
  local)
    if [[ ! -f "$ROOT/ui/.env.development.local" ]]; then
      echo "Missing ui/.env.development.local" >&2
      echo "Copy ui/.env.development.local.example → ui/.env.development.local" >&2
      exit 1
    fi
    cd "$ROOT/ui" && exec bun run dev:local-env
    ;;
  dev)
    if [[ ! -f "$ROOT/ui/.env.development.dev" ]]; then
      echo "Missing ui/.env.development.dev" >&2
      echo "Copy ui/.env.development.dev.example → ui/.env.development.dev" >&2
      exit 1
    fi
    cd "$ROOT/ui" && exec bun run dev:hosted
    ;;
  *)
    echo "Usage: run-with-vite-env.sh --env local|dev" >&2
    exit 1
    ;;
esac
