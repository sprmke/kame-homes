#!/usr/bin/env bash
# Update @/lib and @/utils paths after shared-directory reorganization.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

replace_tree() {
  local dir="$1"
  [[ -d "$dir" ]] || return 0
  find "$dir" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.md' -o -name '*.mdc' \) -print0 | while IFS= read -r -d '' f; do
    sed -i '' \
      -e 's|@/lib/supabaseClient|@/lib/supabase/client|g' \
      -e 's|@/lib/theme|@/lib/theme/preferences|g' \
      -e 's|@/lib/applyBrandCssVariables|@/lib/theme/applyBrandCssVariables|g' \
      -e 's|@/lib/brandColor|@/lib/theme/brandColor|g' \
      -e 's|@/lib/fieldValidation|@/lib/validation/fieldValidation|g' \
      -e 's|@/lib/adminSettingsValidation|@/lib/validation/adminSettings|g' \
      -e 's|@/lib/formPlaceholders|@/lib/constants/formPlaceholders|g' \
      -e 's|@/lib/dateNavigation|@/lib/date/navigation|g' \
      -e 's|@/lib/pagination|@/lib/table/pagination|g' \
      -e 's|@/lib/toastMessages|@/lib/feedback/toastMessages|g' \
      -e 's|@/lib/gafDefaults|@/features/dashboard/bookings/lib/gafDefaults|g' \
      -e 's|@/lib/petDefaults|@/features/dashboard/bookings/lib/petDefaults|g' \
      -e 's|@/lib/settingsFieldLabel|@/features/dashboard/org/lib/settingsFieldLabel|g' \
      -e 's|@/utils/currency|@/utils/format/currency|g' \
      -e 's|@/utils/dates|@/utils/format/dates|g' \
      -e 's|@/utils/bookingDisplay|@/utils/format/bookingDisplay|g' \
      -e 's|@/utils/formatters|@/utils/text/formatters|g' \
      -e 's|@/utils/helpers|@/utils/text/helpers|g' \
      -e 's|@/utils/mockData|@/utils/dev/mockData|g' \
      -e 's|@/utils/bookingFormatter|@/features/guest/form/lib/bookingFormatter|g' \
      -e 's|@/components/charts/chartPalette|@/lib/charts/chartPalette|g' \
      -e 's|@/components/charts/chartStyles|@/lib/charts/chartStyles|g' \
      -e 's|@/layouts/guestNavState|@/layouts/guest/navState|g' \
      -e 's|ui/src/lib/supabaseClient|ui/src/lib/supabase/client|g' \
      -e 's|ui/src/lib/fieldValidation|ui/src/lib/validation/fieldValidation|g' \
      -e 's|ui/src/utils/bookingDisplay|ui/src/utils/format/bookingDisplay|g' \
      -e 's|ui/src/utils/currency|ui/src/utils/format/currency|g' \
      "$f" 2>/dev/null || true
  done
}

replace_tree "$ROOT/ui/src"
replace_tree "$ROOT/docs"
replace_tree "$ROOT/.cursor"
replace_tree "$ROOT/.claude"
replace_tree "$ROOT/supabase"

# Fix relative imports inside moved modules
sed -i '' \
  -e "s|from './dates'|from '@/utils/format/dates'|g" \
  "$ROOT/ui/src/utils/text/formatters.ts" \
  "$ROOT/ui/src/utils/format/bookingDisplay.ts" \
  "$ROOT/ui/src/features/guest/form/lib/bookingFormatter.ts" 2>/dev/null || true

sed -i '' \
  -e "s|from '@/lib/gafDefaults'|from './gafDefaults'|g" \
  "$ROOT/ui/src/features/dashboard/bookings/lib/petDefaults.ts"

echo "Shared lib/utils paths updated."
