#!/usr/bin/env bash
# Lists cron secret env vars referenced in edge code (cost-abuse P0-6 helper).
# Does not read hosted values — run against Supabase Dashboard → Edge secrets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "Cron secret env keys referenced in supabase/functions:"
rg -o "[A-Z0-9_]+_CRON_SECRET" supabase/functions --no-filename | sort -u

echo ""
echo "Verify each is set on hosted dev (and prod before cutover)."
echo "Optional: compare with supabase secrets list (requires supabase CLI + link)."
