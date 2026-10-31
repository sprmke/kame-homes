#!/usr/bin/env bash
# Lightweight secret scanner for staged changes (pre-commit).
#
# Deliberately narrow: only flags high-signal patterns (private key blocks, well-known API
# key prefixes) rather than a generic entropy/JWT scanner, to avoid false-positive noise on
# this repo's many legitimate non-secret demo/example tokens (e.g. the public Supabase
# local-demo anon/service_role JWTs used throughout supabase/snippets and docs).
#
# Escape hatch: SKIP_SECRET_SCAN=1 git commit ... (use sparingly; prefer fixing the finding).
set -euo pipefail

if [[ "${SKIP_SECRET_SCAN:-}" == "1" ]]; then
  echo "check-staged-secrets: skipped (SKIP_SECRET_SCAN=1)"
  exit 0
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

staged_files=$(git diff --cached --name-only --diff-filter=ACM)
[[ -z "$staged_files" ]] && exit 0

found=0

# 1) Never allow committing real env files (only *.example variants are safe).
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  base="$(basename "$f")"
  if [[ "$base" == .env* && "$base" != *.example ]]; then
    echo "❌ check-staged-secrets: refusing to commit env file: $f"
    found=1
  fi
done <<<"$staged_files"

# 2) Scan added lines (not full file, not deleted lines) for high-signal secret patterns.
patterns=(
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'  # PEM private keys (Google service account, etc.)
  'AKIA[0-9A-Z]{16}'                    # AWS access key id
  'AIza[0-9A-Za-z_-]{35}'               # Google API key
  'GOCSPX-[0-9A-Za-z_-]{20,}'           # Google OAuth client secret
  'xox[baprs]-[0-9A-Za-z-]{10,}'        # Slack token
  'gh[pousr]_[0-9A-Za-z]{30,}'          # GitHub token
  'sk_live_[0-9A-Za-z]{16,}'            # Stripe/PayMongo secret key
  '[0-9]{8,10}:[A-Za-z0-9_-]{30,40}'    # Telegram bot token
)

regex="$(IFS='|'; echo "${patterns[*]}")"

diff_output=$(git diff --cached -U0 -- $(echo "$staged_files" | tr '\n' ' ') 2>/dev/null || true)
matches=$(echo "$diff_output" | grep -E '^\+' | grep -Ev '^\+\+\+' | grep -E -- "$regex" || true)

if [[ -n "$matches" ]]; then
  echo "❌ check-staged-secrets: possible secret(s) in staged changes:"
  echo "$matches" | sed 's/^/    /'
  echo ""
  echo "If this is a false positive (e.g. a public demo/example key), re-run with:"
  echo "  SKIP_SECRET_SCAN=1 git commit ..."
  found=1
fi

if [[ "$found" -eq 1 ]]; then
  exit 1
fi

exit 0
