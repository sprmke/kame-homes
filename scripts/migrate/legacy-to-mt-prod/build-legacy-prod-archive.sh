#!/usr/bin/env bash
# Plan 01 B-15 — tar legacy backup artifacts (optionally age-encrypt if AGE_PUBLIC_KEY is set).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
DATE="$(date +%Y%m%d)"
OUT="backups/legacy-prod-config/${DATE}"
ARCHIVE="${OUT}/legacy-prod-config.tar"
mkdir -p "$OUT"

FILES=(
  supabase/.env.legacy-prod.local
  ui/.env.legacy-prod.local
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || { echo "missing $f"; exit 1; }
done

tar -cf "$ARCHIVE" "${FILES[@]}"
if compgen -G "${OUT}/capture-*.json" >/dev/null 2>&1 || [[ -f "${OUT}/capture-summary.json" ]]; then
  tar -rf "$ARCHIVE" -C "$OUT" . 2>/dev/null || true
fi
for sub in "$OUT"/*/; do
  [[ -d "$sub" ]] && tar -rf "$ARCHIVE" -C "$(dirname "$sub")" "$(basename "$sub")" 2>/dev/null || true
done

shasum -a 256 "$ARCHIVE" | tee "${ARCHIVE}.sha256"

if [[ -n "${AGE_PUBLIC_KEY:-}" ]] && command -v age >/dev/null 2>&1; then
  age -r "$AGE_PUBLIC_KEY" -o "${ARCHIVE}.age" "$ARCHIVE"
  shasum -a 256 "${ARCHIVE}.age" | tee "${ARCHIVE}.age.sha256"
  echo "encrypted: ${ARCHIVE}.age"
else
  echo "note: set AGE_PUBLIC_KEY and install age for encryption (B-15 optional step)"
fi

echo "archive: $ARCHIVE"
