#!/usr/bin/env bash
# Ensure _to-prompt.md and _to-plan.md item titles use the status emoji legend.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VALID='^(✅|🧪|🚧|📋|🔵|❌) '

check_file() {
  local file="$1"
  local rel="${file#"$ROOT"/}"
  local line_num=0
  local expect_title=0
  local errors=0

  while IFS= read -r line || [[ -n "$line" ]]; do
    line_num=$((line_num + 1))

    if [[ "$line" == '===' ]]; then
      expect_title=1
      continue
    fi

    if ((expect_title == 0)); then
      continue
    fi

    # Skip blank lines after ===
    if [[ -z "${line//[[:space:]]/}" ]]; then
      continue
    fi

    expect_title=0

    if [[ ! "$line" =~ $VALID ]]; then
      echo "check-workflow-scratchpads: ${rel}:${line_num}: item title must start with ✅ 🧪 🚧 📋 🔵 or ❌ — got: ${line}" >&2
      errors=$((errors + 1))
    fi
  done <"$file"

  return "$errors"
}

total=0
for file in "$ROOT/docs/workflow/intake/_to-prompt.md" "$ROOT/docs/workflow/intake/_to-plan.md"; do
  if [[ ! -f "$file" ]]; then
    echo "check-workflow-scratchpads: missing $file" >&2
    exit 1
  fi
  file_errors=0
  check_file "$file" || file_errors=$?
  total=$((total + file_errors))
done

if ((total > 0)); then
  echo "check-workflow-scratchpads: fix ${total} item title(s). See .agent/skills/workflow-intake-scratchpads/SKILL.md" >&2
  exit 1
fi
