#!/usr/bin/env bash
# Sync intake scratchpad status emojis from docs/workflow/{planned,in-progress,done,wont-do}/.
# Usage: sync-workflow-scratchpads.sh [--dry-run] [--report] [--slug=foo]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec node "$ROOT/scripts/dev/sync-workflow-scratchpads.mjs" "$@"
