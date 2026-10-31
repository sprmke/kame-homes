import { useMemo } from 'react';

import { AdminMultiSelectFilter } from '@/components/navigation/AdminMultiSelectFilter';

type Props = {
  categories: string[];
  value: string[];
  onChange: (next: string[]) => void;
  /** Nested under desktop Filters — local open + full-width panel. */
  nestedInPopover?: boolean;
};

export function FinanceCategoryFilter({
  categories,
  value,
  onChange,
  nestedInPopover = false,
}: Props) {
  const options = useMemo(
    () => categories.map((category) => ({ value: category, label: category })),
    [categories]
  );

  return (
    <AdminMultiSelectFilter
      options={options}
      value={value}
      onChange={onChange}
      emptyLabel="All Categories"
      pluralUnit="categories"
      ariaLabel="Category filter"
      triggerWidthClassName={nestedInPopover ? 'w-full' : 'sm:w-[10.5rem]'}
      panelAlign={nestedInPopover ? 'left' : 'right'}
      panelWidthClassName={nestedInPopover ? 'w-full' : 'w-[min(calc(100vw-24px),14rem)]'}
      panelScrollable
      emptyMessage="No categories"
      toolbarExclusive={!nestedInPopover}
    />
  );
}
