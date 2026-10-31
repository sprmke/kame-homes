import {
  ANALYTICS_RANGE_PRESET_LABELS,
  type AnalyticsRangePreset,
} from '@/features/dashboard/analytics/lib/analyticsDateRange';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Props = {
  preset: AnalyticsRangePreset;
  onChange: (preset: AnalyticsRangePreset) => void;
};

const PRESETS: AnalyticsRangePreset[] = ['this-month', 'last-30d', 'last-90d', 'last-12mo'];

export function AnalyticsDateRangeControl({ preset, onChange }: Props) {
  return (
    <Select value={preset} onValueChange={(value) => onChange(value as AnalyticsRangePreset)}>
      <SelectTrigger className="w-[150px]" aria-label="Date range">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRESETS.map((option) => (
          <SelectItem key={option} value={option}>
            {ANALYTICS_RANGE_PRESET_LABELS[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
