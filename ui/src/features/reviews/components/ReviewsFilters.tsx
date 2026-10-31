import type { ReviewsTriState } from '@/features/reviews/lib/propertyReviewsApi';

import { AdminMultiSelectFilter } from '@/components/navigation/AdminMultiSelectFilter';
import { AdminSingleSelectFilter } from '@/components/navigation/AdminSingleSelectFilter';

const RATING_OPTIONS = [5, 4, 3, 2, 1].map((star) => ({
  value: String(star),
  label: `${star} star${star === 1 ? '' : 's'}`,
}));

const RESPONDED_OPTIONS: { value: ReviewsTriState; label: string }[] = [
  { value: 'all', label: 'All reviews' },
  { value: 'yes', label: 'Responded' },
  { value: 'no', label: 'Awaiting response' },
];

const HOST_AGAIN_OPTIONS: { value: ReviewsTriState; label: string }[] = [
  { value: 'all', label: 'All reviews' },
  { value: 'yes', label: 'Would host again' },
  { value: 'no', label: 'Would not host again' },
];

type NestedProps = {
  /** Nested under desktop Filters — local open + full-width panel. */
  nestedInPopover?: boolean;
};

export function ReviewsRatingFilter({
  value,
  onChange,
  nestedInPopover = false,
}: NestedProps & {
  value: number[];
  onChange: (next: number[]) => void;
}) {
  return (
    <AdminMultiSelectFilter
      options={RATING_OPTIONS}
      value={value.map(String)}
      onChange={(next) => onChange(next.map(Number).sort((a, b) => a - b))}
      emptyLabel="All ratings"
      pluralUnit="ratings"
      ariaLabel="Rating filter"
      triggerWidthClassName={nestedInPopover ? 'w-full' : 'sm:w-[9.5rem]'}
      panelAlign={nestedInPopover ? 'left' : 'right'}
      panelWidthClassName={nestedInPopover ? 'w-full' : 'w-[min(calc(100vw-24px),12rem)]'}
      toolbarExclusive={!nestedInPopover}
    />
  );
}

export function ReviewsResponseFilter({
  value,
  onChange,
  nestedInPopover = false,
}: NestedProps & {
  value: ReviewsTriState;
  onChange: (next: ReviewsTriState) => void;
}) {
  return (
    <AdminSingleSelectFilter
      options={RESPONDED_OPTIONS}
      value={value}
      onChange={onChange}
      ariaLabel="Response filter"
      triggerWidthClassName={nestedInPopover ? 'w-full' : 'sm:w-[11rem]'}
      panelAlign={nestedInPopover ? 'left' : 'right'}
      panelWidthClassName={nestedInPopover ? 'w-full' : 'w-[min(calc(100vw-24px),13rem)]'}
      toolbarExclusive={!nestedInPopover}
    />
  );
}

/** Org rollup: narrow the feed to one or more listings. */
export function ReviewsListingFilter({
  options,
  value,
  onChange,
  nestedInPopover = false,
}: NestedProps & {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <AdminMultiSelectFilter
      options={options}
      value={value}
      onChange={onChange}
      emptyLabel="All listings"
      pluralUnit="listings"
      ariaLabel="Listing filter"
      panelScrollable
      triggerWidthClassName={nestedInPopover ? 'w-full' : 'sm:w-[11rem]'}
      panelAlign={nestedInPopover ? 'left' : 'right'}
      panelWidthClassName={nestedInPopover ? 'w-full' : 'w-[min(calc(100vw-24px),16rem)]'}
      toolbarExclusive={!nestedInPopover}
    />
  );
}

export function ReviewsHostAgainFilter({
  value,
  onChange,
  nestedInPopover = false,
}: NestedProps & {
  value: ReviewsTriState;
  onChange: (next: ReviewsTriState) => void;
}) {
  return (
    <AdminSingleSelectFilter
      options={HOST_AGAIN_OPTIONS}
      value={value}
      onChange={onChange}
      ariaLabel="Would host again filter"
      triggerWidthClassName={nestedInPopover ? 'w-full' : 'sm:w-[12rem]'}
      panelAlign={nestedInPopover ? 'left' : 'right'}
      panelWidthClassName={nestedInPopover ? 'w-full' : 'w-[min(calc(100vw-24px),14rem)]'}
      toolbarExclusive={!nestedInPopover}
    />
  );
}
