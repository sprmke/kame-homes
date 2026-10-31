import type { MaintenanceTelegramFilter } from '@/features/dashboard/maintenance/lib/types';

import { AdminSingleSelectFilter } from '@/components/navigation/AdminSingleSelectFilter';

const OPTIONS: { value: MaintenanceTelegramFilter; label: string }[] = [
  { value: 'all', label: 'All reminders' },
  { value: 'enabled', label: 'Telegram on' },
  { value: 'disabled', label: 'Telegram off' },
];

type Props = {
  value: MaintenanceTelegramFilter;
  onChange: (next: MaintenanceTelegramFilter) => void;
  /** Nested under desktop Filters — local open + full-width panel. */
  nestedInPopover?: boolean;
};

export function MaintenanceTelegramFilter({ value, onChange, nestedInPopover = false }: Props) {
  return (
    <AdminSingleSelectFilter
      options={OPTIONS}
      value={value}
      onChange={onChange}
      ariaLabel="Telegram filter"
      triggerWidthClassName={nestedInPopover ? 'w-full' : 'sm:w-[10.5rem]'}
      panelAlign={nestedInPopover ? 'left' : 'right'}
      panelWidthClassName={nestedInPopover ? 'w-full' : 'w-[min(calc(100vw-24px),12rem)]'}
      toolbarExclusive={!nestedInPopover}
    />
  );
}
