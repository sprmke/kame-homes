#!/usr/bin/env bash
# Verify ui/src file names match .cursor/rules/naming-conventions.mdc
# Exit 1 on violations. See docs/archive/reference/naming-audit.md for intentional exceptions.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/ui/src"
VIOLATIONS=0

fail() {
  echo "VIOLATION: $1"
  VIOLATIONS=$((VIOLATIONS + 1))
}

is_pascal_case() {
  [[ "$1" =~ ^[A-Z][a-zA-Z0-9]*$ ]]
}

is_camel_case() {
  [[ "$1" =~ ^[a-z][a-zA-Z0-9]*$ ]]
}

is_use_hook() {
  [[ "$1" =~ ^use[A-Z][a-zA-Z0-9]*$ ]]
}

while IFS= read -r -d '' f; do
  rel="${f#"$SRC"/}"
  base=$(basename "$f")
  name="${base%.*}"
  ext="${base##*.}"

  # Skip shadcn primitives
  if [[ "$rel" == components/ui/* ]]; then
    continue
  fi

  # Skip route composition modules
  if [[ "$rel" == */routes/* ]]; then
    continue
  fi

  # Vite entry / env
  if [[ "$name" == "main" ]] || [[ "$name" == "vite-env.d" ]]; then
    continue
  fi

  if [[ "$ext" == "tsx" ]]; then
    if [[ "$rel" == */components/* ]] || [[ "$rel" == */pages/* ]] || [[ "$rel" == components/* ]]; then
      if ! is_pascal_case "$name"; then
        fail "$rel (expected PascalCase.tsx)"
      fi
    fi
  fi

  if [[ "$ext" == "ts" ]]; then
    # Vitest co-located specs (e.g. voucherRevealWheel.test.ts)
    if [[ "$base" == *.test.ts ]]; then
      continue
    fi

    if [[ "$rel" == */hooks/* ]]; then
      if ! is_use_hook "$name"; then
        fail "$rel (expected usePascalCase.ts)"
      fi
    fi

    if [[ "$rel" == */lib/* ]] || [[ "$rel" == */schemas/* ]] || [[ "$rel" == */utils/* ]] || [[ "$rel" == lib/* ]] || [[ "$rel" == utils/* ]]; then
      if [[ "$rel" == "lib/utils.ts" ]]; then
        continue
      fi
      if [[ "$name" == *-* ]]; then
        fail "$rel (hyphenated util/lib — use camelCase.ts)"
      fi
      if ! is_camel_case "$name"; then
        fail "$rel (expected camelCase.ts)"
      fi
    fi

    if [[ "$rel" == */components/* ]] && [[ "$ext" == "ts" ]]; then
      if [[ "$name" == *-* ]]; then
        fail "$rel (hyphenated co-located util — use camelCase.ts)"
      fi
      if ! is_camel_case "$name"; then
        fail "$rel (expected camelCase.ts in components/)"
      fi
    fi
  fi
done < <(find "$SRC" -type f \( -name '*.ts' -o -name '*.tsx' \) -print0)

if [[ "$VIOLATIONS" -gt 0 ]]; then
  echo ""
  echo "$VIOLATIONS naming violation(s). See docs/archive/reference/naming-audit.md"
  exit 1
fi

echo "OK — ui/src filenames match naming conventions."
