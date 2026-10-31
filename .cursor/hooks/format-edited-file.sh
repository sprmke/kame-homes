#!/usr/bin/env bash
# afterFileEdit hook: format the file that was just edited, if a formatter is available.
# Reads JSON with "file_path" from stdin. Must exit 0 and output JSON so the edit is not blocked.
# This repo does not currently have Prettier or another formatter configured, so by default
# this hook is a silent no-op. If you install prettier in ui/ or at the repo root later, it
# will automatically start formatting without any changes here.

set -e
input=$(cat)

if command -v jq >/dev/null 2>&1; then
  file_path=$(echo "$input" | jq -r '.file_path // empty')
else
  file_path=$(echo "$input" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/"file_path":"//;s/"$//')
fi

format_with_prettier() {
  local target="$1"
  # Prefer bunx (fast) then npx for repo-local prettier.
  if command -v bunx >/dev/null 2>&1; then
    bunx --bun prettier --write "$target" >/dev/null 2>&1 && return 0
  fi
  if command -v npx >/dev/null 2>&1; then
    npx --no-install prettier --write "$target" >/dev/null 2>&1 && return 0
  fi
  return 1
}

if [[ -n "$file_path" && -f "$file_path" ]]; then
  case "$file_path" in
    *.ts|*.tsx|*.js|*.jsx|*.json|*.md|*.mdc|*.css|*.html)
      format_with_prettier "$file_path" || true
      ;;
  esac
fi

echo '{}'
