#!/usr/bin/env bash
# Ensure Playwright CLI binary + project skill are available for Cursor / Claude Code.
# Skill lives in .agents/skills/playwright-cli (skills-lock.json); binary via bunx.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

info() { printf '→ %s\n' "$*"; }
ok() { printf '✓ %s\n' "$*"; }
warn() { printf '⚠ %s\n' "$*" >&2; }

# Restore skill if missing (also covered by setup-agents-skills)
if [[ ! -f .agents/skills/playwright-cli/SKILL.md ]]; then
  info "Installing playwright-cli skill"
  bash "$ROOT/scripts/dev/setup-agents-skills.sh"
fi

# Prefer local workspace binary (root package.json → @playwright/cli)
CLI=""
if [[ -x "$ROOT/node_modules/.bin/playwright-cli" ]]; then
  CLI="$ROOT/node_modules/.bin/playwright-cli"
elif command -v playwright-cli >/dev/null 2>&1; then
  CLI="$(command -v playwright-cli)"
elif command -v bun >/dev/null 2>&1; then
  CLI="bun x playwright-cli"
else
  CLI="npx --yes @playwright/cli"
fi

info "Checking Playwright CLI ($CLI)"
if ! $CLI --help >/dev/null 2>&1; then
  warn "playwright-cli --help failed — run: bun add -d @playwright/cli"
  exit 1
fi
ok "playwright-cli available"

# Optional: install Chromium once (skip if already present)
if [[ "${PLAYWRIGHT_CLI_SKIP_BROWSERS:-}" != "1" ]]; then
  info "Ensuring Chromium for playwright-cli (set PLAYWRIGHT_CLI_SKIP_BROWSERS=1 to skip)"
  if $CLI install-browser chromium >/dev/null 2>&1; then
    ok "Chromium ready"
  else
    warn "Could not auto-install browser — run: bun x playwright-cli install-browser chromium"
  fi
fi

cat <<EOF
OK — Playwright CLI ready.

Invoke via skill \`playwright-cli\` or:
  bun x playwright-cli open http://127.0.0.1:5173
  bun x playwright-cli snapshot

Prefer CLI + skill for coding agents (token-efficient). Playwright MCP remains in
.mcp.json for long exploratory /verify loops.
EOF
