#!/usr/bin/env bash
# CI secret scan (production-readiness doc 26.5) — full tracked tree, high-signal patterns only.
# Pre-commit uses check-staged-secrets.sh on diffs; this catches secrets already in history
# on new clones/PRs. Same patterns as the staged scanner; narrow to limit false positives.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

patterns=(
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  'AKIA[0-9A-Z]{16}'
  'AIza[0-9A-Za-z_-]{35}'
  'GOCSPX-[0-9A-Za-z_-]{20,}'
  'xox[baprs]-[0-9A-Za-z-]{10,}'
  'gh[pousr]_[0-9A-Za-z]{30,}'
  'sk_live_[0-9A-Za-z]{16,}'
  '[0-9]{8,10}:[A-Za-z0-9_-]{30,40}'
)

regex="$(IFS='|'; echo "${patterns[*]}")"

# Tracked files only; skip lockfiles, binary baselines, and known demo JWT dumps in snippets.
paths=(
  'ui'
  'supabase'
  'scripts'
  'docs'
  '.github'
)

matches=$(git grep -nE -I -- "$regex" -- "${paths[@]}" \
  ':(exclude)*.lock' \
  ':(exclude)docs/workflow/planned/production-readiness-checklist/baselines/*' \
  ':(exclude)supabase/snippets/*' \
  2>/dev/null || true)

if [[ -n "$matches" ]]; then
  echo "check-tracked-secrets: possible secret(s) in tracked files:"
  echo "$matches" | head -40
  count=$(echo "$matches" | wc -l | tr -d ' ')
  if [[ "$count" -gt 40 ]]; then
    echo "... and $((count - 40)) more lines"
  fi
  exit 1
fi

echo "check-tracked-secrets: OK"
