#!/usr/bin/env bash
# SessionStart: list active workflow docs for AI context.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROGRESS_DIR="$ROOT/docs/workflow/in-progress"

escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  printf '%s' "$s"
}

shopt -s nullglob
files=("$PROGRESS_DIR"/*.md)
shopt -u nullglob

if ((${#files[@]} == 0)); then
  status="Workflow in-progress: (none) — use /workflow-start when picking up a planned item."
else
  basenames=""
  for f in "${files[@]}"; do
    basenames+="$(basename "$f"), "
  done
  basenames="${basenames%, }"
  status="Workflow in-progress: ${basenames} — primary session docs under docs/workflow/in-progress/."
fi

escaped=$(escape_for_json "$status")
printf '{\n  "additional_context": "%s"\n}\n' "$escaped"
