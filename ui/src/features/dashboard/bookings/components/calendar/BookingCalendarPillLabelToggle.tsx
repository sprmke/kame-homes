import {
  SegmentedControl,
  cardHeaderSegmentedListClassName,
  cardHeaderSegmentedTriggerClassName,
} from '@/components/ui/sliding-tabs';
import { cn } from '@/lib/utils';

export type BookingCalendarPillLabelMode = 'name' | 'price';

type Props = {
  value: BookingCalendarPillLabelMode;
  onChange: (next: BookingCalendarPillLabelMode) => void;
  className?: string;
  /** `toolbar` matches CalendarMonthGrid nav button height (36px). */
  size?: 'default' | 'toolbar';
};

export function BookingCalendarPillLabelToggle({
  value,
  onChange,
  className,
  size = 'toolbar',
}: Props) {
  const toolbar = size === 'toolbar';

  return (
    <SegmentedControl
      value={value}
      onChange={onChange}
      size="dense"
      equalSegments
      className={className}
      listClassName={cn(cardHeaderSegmentedListClassName, !toolbar && 'sm:h-8')}
      triggerClassName={cardHeaderSegmentedTriggerClassName}
      aria-label="Calendar pill display"
      options={[
        { value: 'name', label: 'Name' },
        { value: 'price', label: 'Price' },
      ]}
    />
  );
}
