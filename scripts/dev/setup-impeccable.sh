#!/usr/bin/env bash
# Install Impeccable (+ other locked .agents/skills) and wire Cursor/Claude symlinks.
# Prefer: bun run setup:agents-skills (same work). Kept for backcompat.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec bash "$ROOT/scripts/dev/setup-agents-skills.sh"
