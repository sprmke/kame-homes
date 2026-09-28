import { formatDateRangeDisplay, type DatePreset } from '@/lib/date/navigation';

import { useDashboardCompactChrome } from '@/features/dashboard/lib/dashboardChromeContext';

/** Date range label for headers and pickers; respects compact dashboard chrome. */
export function useDateRangeDisplayLabel(from: Date, to: Date, preset: DatePreset): string {
  const compact = useDashboardCompactChrome();
  return formatDateRangeDisplay(from, to, preset, { compact });
}
