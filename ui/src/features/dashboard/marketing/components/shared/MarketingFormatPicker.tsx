import { MarketingFormatIcon } from '@/features/dashboard/marketing/components/shared/MarketingFormatIcon';
import {
  formatPickerSubtitle,
  marketingFormatMeta,
} from '@/features/dashboard/marketing/lib/marketingFormats';

import { SlidingTabs, SlidingTabsList, SlidingTabsTrigger } from '@/components/ui/sliding-tabs';
import { cn } from '@/lib/utils';

export type MarketingFormatOption = {
  value: string;
  width: number;
  height: number;
};

type Props = {
  options: MarketingFormatOption[];
  value: string;
  onChange: (value: string) => void;
};

export function MarketingFormatPicker({ options, value, onChange }: Props) {
  return (
    <SlidingTabs value={value} onValueChange={onChange}>
      <SlidingTabsList
        size="compact"
        className="bg-muted/40 !flex h-auto w-full max-w-full gap-1 overflow-visible p-1.5"
        pillClassName="bg-card rounded-md shadow-sm"
        aria-label="Canvas size"
        remeasureDeps={[options.length, value]}
      >
        {options.map((option) => {
          const meta = marketingFormatMeta(option.width, option.height);
          const selected = option.value === value;
          return (
            <SlidingTabsTrigger
              key={option.value}
              value={option.value}
              title={formatPickerSubtitle(meta)}
              className={cn(
                '!flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1.5 py-2 text-center',
                '!h-auto whitespace-normal lg:!h-auto lg:!min-h-[52px]'
              )}
            >
              <MarketingFormatIcon
                orientation={meta.orientation}
                selected={selected}
                className="size-6 shrink-0"
              />
              <span
                className={cn('text-[11px] font-medium leading-tight', selected && 'text-primary')}
              >
                {meta.orientationLabel}
              </span>
              <span className="text-muted-foreground text-[10px] leading-tight">
                {meta.aspectLabel}
              </span>
            </SlidingTabsTrigger>
          );
        })}
      </SlidingTabsList>
    </SlidingTabs>
  );
}
