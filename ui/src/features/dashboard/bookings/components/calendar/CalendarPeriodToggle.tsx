import type { CalendarPeriod } from '@/features/dashboard/bookings/components/calendar/calendarTimeGridUtils';

import { SegmentedControl } from '@/components/ui/sliding-tabs';
import { cn } from '@/lib/utils';

type Props = {
  value: CalendarPeriod;
  onChange: (next: CalendarPeriod) => void;
  className?: string;
  size?: 'default' | 'toolbar';
};

export function CalendarPeriodToggle({ value, onChange, className, size = 'toolbar' }: Props) {
  const toolbar = size === 'toolbar';

  return (
    <SegmentedControl
      value={value}
      onChange={onChange}
      size={toolbar ? 'dense' : 'compact'}
      className={className}
      listClassName={cn('border-border/60 w-fit', toolbar && 'p-0.5')}
      triggerClassName={
        toolbar
          ? 'h-6 min-h-0 px-2 py-0 text-[10px] leading-none lg:h-full lg:text-[11px]'
          : undefined
      }
      aria-label="Calendar period"
      options={[
        { value: 'month', label: 'Month' },
        { value: 'week', label: 'Week' },
        { value: 'day', label: 'Day' },
      ]}
    />
  );
}
