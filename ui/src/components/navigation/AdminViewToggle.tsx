import { SegmentedControl } from '@/components/ui/sliding-tabs';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

export type AdminViewToggleOption<T extends string> = {
  value: T;
  label: string;
  Icon: LucideIcon;
};

type Props<T extends string> = {
  value: T;
  onChange: (next: T) => void;
  options: AdminViewToggleOption<T>[];
  hideValues?: T[];
  className?: string;
  ariaLabel?: string;
};

export function AdminViewToggle<T extends string>({
  value,
  onChange,
  options,
  hideValues = [],
  className,
  ariaLabel = 'Choose list view',
}: Props<T>) {
  return (
    <SegmentedControl
      value={value}
      onChange={onChange}
      size="dense"
      fullWidth
      options={options.map(({ value: optionValue, label, Icon }) => ({
        value: optionValue,
        label,
        icon: Icon,
      }))}
      hideValues={hideValues}
      className={cn('w-full shrink-0 lg:w-auto', className)}
      listClassName="lg:w-fit"
      triggerClassName="gap-1 px-2 lg:flex-initial lg:px-2.5"
      aria-label={ariaLabel}
    />
  );
}
