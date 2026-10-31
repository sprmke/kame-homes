#!/usr/bin/env bash
# Clear Superpowers lean mode marker when agent stops (Cursor stop / Claude Stop).

set -euo pipefail

ROOT="${CURSOR_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}}"
# shellcheck source=../../scripts/dev/superpowers-lean-lib.sh
source "$ROOT/scripts/dev/superpowers-lean-lib.sh"

superpowers_lean_deactivate "$ROOT"
echo '{}'
