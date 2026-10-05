import type { RefObject } from 'react';

import { PublicListingPagination } from '@/features/guest/marketing/shared/components/PublicListingPagination';
import { listingTotalPages } from '@/features/guest/marketing/shared/lib/listingPagination';

type Props = {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  /** Results container to bring into view after a page change. */
  scrollTargetRef?: RefObject<HTMLElement | null>;
  /** Prefetch a page when the guest hovers / focuses Previous or Next. */
  onPrefetchPage?: (page: number) => void;
};

/** Centered Previous / Next pager under a listing results grid. */
export function ListingResultsPagination({
  page,
  total,
  pageSize,
  onPageChange,
  disabled,
  scrollTargetRef,
  onPrefetchPage,
}: Props) {
  const totalPages = listingTotalPages(total, pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="pt-8">
      <PublicListingPagination
        page={Math.min(page, totalPages)}
        totalPages={totalPages}
        disabled={disabled}
        onPageIntent={onPrefetchPage}
        onPageChange={(next) => {
          onPageChange(next);
          scrollTargetRef?.current?.scrollIntoView({ block: 'start' });
        }}
      />
    </div>
  );
}
