#!/usr/bin/env bash
# Remove claude-mem from user-scoped AI tooling (Cursor global MCP/hooks, Claude Code plugin).
# Project MCP (.mcp.json) never included claude-mem — this cleans machine-local installs only.
#
# Usage:
#   bun run cleanup:claude-mem           # disable + stop processes
#   bun run cleanup:claude-mem -- --purge  # also delete ~/.claude-mem data (~40MB+)

set -euo pipefail

PURGE=0
for arg in "$@"; do
  case "$arg" in
    --purge) PURGE=1 ;;
    -h | --help)
      cat <<'EOF'
Usage: bun run cleanup:claude-mem [-- --purge]

Disables claude-mem@thedotmack and removes user-scoped wiring:
  - ~/.claude/settings.json  (enabledPlugins.claude-mem → false)
  - ~/.cursor/mcp.json       (claude-mem server entry)
  - ~/.cursor/hooks.json     (claude-mem cursor hooks)
  - Stops claude-mem worker / MCP / chroma processes

--purge  Also remove ~/.claude-mem/ (SQLite, logs, vector index). Irreversible.

GFM uses docs/PROJECT.md + route guides for session context — not claude-mem.
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)" >&2
      exit 1
      ;;
  esac
done

info() { printf '→ %s\n' "$*"; }
ok() { printf '✓ %s\n' "$*"; }
warn() { printf '⚠ %s\n' "$*" >&2; }

HOME_DIR="${HOME:?}"
CLAUDE_SETTINGS="$HOME_DIR/.claude/settings.json"
CURSOR_MCP="$HOME_DIR/.cursor/mcp.json"
CURSOR_HOOKS="$HOME_DIR/.cursor/hooks.json"
MEM_DIR="$HOME_DIR/.claude-mem"
WORKER="$HOME_DIR/.claude/plugins/cache/thedotmack/claude-mem/13.14.0/scripts/worker-service.cjs"

stop_processes() {
  info "Stopping claude-mem processes"
  if [[ -f "$WORKER" ]] && command -v node >/dev/null 2>&1; then
    node "$WORKER" stop 2>/dev/null || true
  fi
  pkill -f 'claude-mem/.*/scripts/worker-service.cjs' 2>/dev/null || true
  pkill -f 'claude-mem/.*/scripts/mcp-server.cjs' 2>/dev/null || true
  pkill -f 'chroma-mcp.*\.claude-mem/chroma' 2>/dev/null || true
  ok "Processes stopped (or were not running)"
}

disable_claude_plugin() {
  if [[ ! -f "$CLAUDE_SETTINGS" ]]; then
    warn "No $CLAUDE_SETTINGS — skip"
    return 0
  fi
  if ! command -v jq >/dev/null 2>&1; then
    warn "jq not found — manually set claude-mem@thedotmack: false in $CLAUDE_SETTINGS"
    return 0
  fi
  info "Disabling claude-mem in Claude Code settings"
  tmp="$(mktemp)"
  jq '.enabledPlugins["claude-mem@thedotmack"] = false' "$CLAUDE_SETTINGS" >"$tmp"
  mv "$tmp" "$CLAUDE_SETTINGS"
  ok "Claude plugin disabled"
}

clean_cursor_mcp() {
  if [[ ! -f "$CURSOR_MCP" ]]; then
    warn "No $CURSOR_MCP — skip"
    return 0
  fi
  if ! command -v jq >/dev/null 2>&1; then
    warn "jq not found — manually remove claude-mem from $CURSOR_MCP"
    return 0
  fi
  if ! jq -e '.mcpServers["claude-mem"]' "$CURSOR_MCP" >/dev/null 2>&1; then
    ok "Cursor MCP: claude-mem already absent"
    return 0
  fi
  info "Removing claude-mem from Cursor global MCP"
  tmp="$(mktemp)"
  jq 'del(.mcpServers["claude-mem"])' "$CURSOR_MCP" >"$tmp"
  mv "$tmp" "$CURSOR_MCP"
  ok "Cursor MCP cleaned"
}

clean_cursor_hooks() {
  if [[ ! -f "$CURSOR_HOOKS" ]]; then
    warn "No $CURSOR_HOOKS — skip"
    return 0
  fi
  if grep -q 'thedotmack\|claude-mem\|worker-service\.cjs' "$CURSOR_HOOKS" 2>/dev/null; then
    info "Removing claude-mem hooks from Cursor global hooks.json"
    printf '%s\n' '{"version":1,"hooks":{}}' >"$CURSOR_HOOKS"
    ok "Cursor hooks cleaned (global hooks reset to empty — project hooks in repo still apply)"
  else
    ok "Cursor hooks: no claude-mem entries"
  fi
}

purge_data() {
  if [[ ! -d "$MEM_DIR" ]]; then
    ok "No ~/.claude-mem to purge"
    return 0
  fi
  info "Purging $MEM_DIR"
  rm -rf "$MEM_DIR"
  ok "Data removed"
}

stop_processes
disable_claude_plugin
clean_cursor_mcp
clean_cursor_hooks

if [[ "$PURGE" -eq 1 ]]; then
  purge_data
else
  warn "~/.claude-mem kept (use --purge to delete). Reload Cursor / Claude Code after this script."
fi

ok "claude-mem cleanup complete"
