#!/usr/bin/env bash
# One-shot import/path update after features/ reorganization.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

replace_in_tree() {
  local dir="$1"
  [[ -d "$dir" ]] || return 0
  find "$dir" -type f \( \
    -name '*.ts' -o -name '*.tsx' -o -name '*.md' -o -name '*.mdc' -o -name '*.json' -o -name '*.sh' \
  \) -print0 | while IFS= read -r -d '' f; do
    if grep -q '@/features/\|features/guest-form\|features/admin/\|ui/src/features/' "$f" 2>/dev/null; then
      sed -i '' \
        -e 's|@/features/guest/form/|@/features/guest/form/|g' \
        -e 's|@/features/guest/sd-form/|@/features/guest/sd-form/|g' \
        -e 's|@/features/guest/pay-parking/|@/features/guest/pay-parking/|g' \
        -e 's|@/features/dashboard/bookings/|@/features/dashboard/bookings/|g' \
        -e 's|@/features/dashboard/org/|@/features/dashboard/org/|g' \
        -e 's|@/features/dashboard/finance/|@/features/dashboard/finance/|g' \
        -e 's|@/features/dashboard/maintenance/|@/features/dashboard/maintenance/|g' \
        -e 's|@/features/dashboard/inbox/|@/features/dashboard/inbox/|g' \
        -e 's|@/features/dashboard/pricing/|@/features/dashboard/pricing/|g' \
        -e 's|@/features/dashboard/team/|@/features/dashboard/team/|g' \
        -e 's|@/features/dashboard/property/hooks/|@/features/dashboard/property/hooks/|g' \
        -e 's|@/features/dashboard/property/components/|@/features/dashboard/property/components/|g' \
        -e 's|@/features/dashboard/property/pages/|@/features/dashboard/property/pages/|g' \
        -e 's|@/features/dashboard/property/lib/|@/features/dashboard/property/lib/|g' \
        -e 's|@/features/dashboard/property/routes|@/features/dashboard/property/routes|g' \
        -e 's|@/components/branding/KameFormBrandHeader|@/components/branding/KameFormBrandHeader|g' \
        -e 's|@/components/branding/GoogleMark|@/components/branding/GoogleMark|g' \
        -e 's|@/components/branding/TeamLogoMark|@/components/branding/TeamLogoMark|g' \
        -e 's|@/components/navigation/AdminEntryButton|@/components/navigation/AdminEntryButton|g' \
        -e 's|@/components/navigation/ScrollToTop|@/components/navigation/ScrollToTop|g' \
        -e 's|ui/src/features/guest/form/|ui/src/features/guest/form/|g' \
        -e 's|ui/src/features/guest/form|ui/src/features/guest/form|g' \
        -e 's|ui/src/features/dashboard/property/bookings/|ui/src/features/dashboard/property/bookings/|g' \
        -e 's|ui/src/features/dashboard/property/org/|ui/src/features/dashboard/property/org/|g' \
        -e 's|ui/src/features/dashboard/property/finance/|ui/src/features/dashboard/property/finance/|g' \
        -e 's|ui/src/features/dashboard/property/maintenance/|ui/src/features/dashboard/property/maintenance/|g' \
        -e 's|ui/src/features/dashboard/property/inbox/|ui/src/features/dashboard/property/inbox/|g' \
        -e 's|ui/src/features/dashboard/property/pricing/|ui/src/features/dashboard/property/pricing/|g' \
        -e 's|ui/src/features/dashboard/property/team/|ui/src/features/dashboard/property/team/|g' \
        -e 's|ui/src/features/guest/sd-form/|ui/src/features/guest/sd-form/|g' \
        -e 's|ui/src/features/guest/pay-parking/|ui/src/features/guest/pay-parking/|g' \
        -e 's|ui/src/features/dashboard/property/|ui/src/features/dashboard/property/property/|g' \
        "$f"
    fi
  done
}

replace_in_tree "$ROOT/ui/src"
replace_in_tree "$ROOT/docs"
replace_in_tree "$ROOT/.cursor"
replace_in_tree "$ROOT/.claude"
replace_in_tree "$ROOT/scripts"

# Fix double-nested paths from dashboard property pass
fix_doubles() {
  local dir="$1"
  find "$dir" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.md' -o -name '*.mdc' \) -print0 | while IFS= read -r -d '' f; do
    sed -i '' \
      -e 's|@/features/dashboard/property/org/|@/features/dashboard/org/|g' \
      -e 's|@/features/dashboard/property/finance/|@/features/dashboard/finance/|g' \
      -e 's|@/features/dashboard/property/maintenance/|@/features/dashboard/maintenance/|g' \
      -e 's|@/features/dashboard/property/inbox/|@/features/dashboard/inbox/|g' \
      -e 's|@/features/dashboard/property/pricing/|@/features/dashboard/pricing/|g' \
      -e 's|@/features/dashboard/property/team/|@/features/dashboard/team/|g' \
      -e 's|@/features/dashboard/property/bookings/|@/features/dashboard/bookings/|g' \
      -e 's|ui/src/features/dashboard/property/property/org/|ui/src/features/dashboard/property/org/|g' \
      -e 's|ui/src/features/dashboard/property/property/finance/|ui/src/features/dashboard/property/finance/|g' \
      -e 's|ui/src/features/dashboard/property/property/maintenance/|ui/src/features/dashboard/property/maintenance/|g' \
      -e 's|ui/src/features/dashboard/property/property/inbox/|ui/src/features/dashboard/property/inbox/|g' \
      -e 's|ui/src/features/dashboard/property/property/pricing/|ui/src/features/dashboard/property/pricing/|g' \
      -e 's|ui/src/features/dashboard/property/property/team/|ui/src/features/dashboard/property/team/|g' \
      -e 's|ui/src/features/dashboard/property/property/bookings/|ui/src/features/dashboard/property/bookings/|g' \
      "$f" 2>/dev/null || true
  done
}

fix_doubles "$ROOT/ui/src"
fix_doubles "$ROOT/docs"
fix_doubles "$ROOT/.cursor"
fix_doubles "$ROOT/.claude"

echo "Import paths updated."
