#!/usr/bin/env bash
# AI companion conversation QA driver. See scripts/dev/ai-qa-run.mjs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
export PATH="$HOME/.deno/bin:$HOME/.bun/bin:$PATH"
exec bun "$ROOT/scripts/dev/ai-qa-run.mjs" "$@"
