#!/usr/bin/env bash
# Load ui/.env.development into the environment, then run the given command.
# Used so GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (local GoTrue OAuth) live next to
# other Vite dev vars without a separate repo-root .env file.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
export PATH="/usr/local/bin:/opt/homebrew/bin:${HOME}/.bun/bin:${PATH}"
if [[ -f ui/.env.development ]]; then
  set -a
  # shellcheck disable=SC1091
  source ui/.env.development
  set +a
fi
exec "$@"
