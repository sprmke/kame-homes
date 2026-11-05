import { Link } from 'react-router-dom';

import { ArrowUpRight, Building2, PencilLine } from 'lucide-react';

import {
  AdminDataTable,
  AdminTableHeadRow,
  AdminTableTh,
  adminTableBodyText,
  adminTableCell,
  adminTableIconButtonClass,
  adminTableRowClass,
} from '@/features/dashboard/bookings/components/AdminDataTable';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';

import { RatingStars } from '@/features/reviews/components/RatingStars';
import { ReviewsEmptyState } from '@/features/reviews/components/ReviewsEmptyState';
import type { OrgPropertyReviewRow } from '@/features/reviews/lib/orgReviewsApi';
import { formatReviewAverage } from '@/features/reviews/lib/propertyReviewsApi';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Props = {
  rows: OrgPropertyReviewRow[];
  orgSlug: string;
  /** Narrows the review feed to this listing and returns to From guests. */
  onShowReviews: (row: OrgPropertyReviewRow) => void;
  onShowToWrite: (row: OrgPropertyReviewRow) => void;
};

/** Response rate reads as a dash, not 0%, until a listing has a review. */
function responseLabel(row: OrgPropertyReviewRow): string {
  if (row.count === 0) return '–';
  return `${Math.round(row.responseRate * 100)}%`;
}

export function OrgPropertyReviewsTable({ rows, orgSlug, onShowReviews, onShowToWrite }: Props) {
  if (rows.length === 0) {
    return (
      <ReviewsEmptyState
        icon={Building2}
        title="No listings match your search"
        description="Clear the search to see every listing in this organization."
      />
    );
  }

  return (
    <AdminDataTable minWidth={720}>
      <AdminTableHeadRow>
        <AdminTableTh className="pl-4 pr-3 sm:pl-5">Listing</AdminTableTh>
        <AdminTableTh className="px-3 sm:px-4">Rating</AdminTableTh>
        <AdminTableTh className="hidden px-3 sm:px-4 md:table-cell">Reviews</AdminTableTh>
        <AdminTableTh className="hidden px-3 sm:px-4 lg:table-cell">Responded</AdminTableTh>
        <AdminTableTh className="px-3 sm:px-4">To write</AdminTableTh>
        <AdminTableTh className="pl-2 pr-3 sm:pl-3 sm:pr-4">
          <span className="sr-only">Actions</span>
        </AdminTableTh>
      </AdminTableHeadRow>
      <tbody>
        {rows.map((row, index) => (
          <tr
            key={row.propertyId}
            role="button"
            tabIndex={0}
            className={adminTableRowClass(index)}
            onClick={() => onShowReviews(row)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onShowReviews(row);
              }
            }}
          >
            <td className={adminTableCell.status}>
              <p className={cn('max-w-[14rem] truncate font-bold', adminTableBodyText.primary)}>
                {row.propertyName}
              </p>
            </td>
            <td className={adminTableCell.body}>
              {row.count === 0 ? (
                <span className={adminTableBodyText.secondary}>–</span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <RatingStars value={row.avgOverall ?? 0} className="shrink-0" />
                  <span className="text-foreground text-xs font-semibold tabular-nums">
                    {formatReviewAverage(row.avgOverall)}
                  </span>
                </div>
              )}
            </td>
            <td
              className={cn(
                'hidden md:table-cell',
                adminTableBodyText.secondary,
                adminTableCell.body
              )}
            >
              <span className="tabular-nums">{row.count}</span>
            </td>
            <td
              className={cn(
                'hidden lg:table-cell',
                adminTableBodyText.secondary,
                adminTableCell.body
              )}
            >
              <span className="tabular-nums">{responseLabel(row)}</span>
            </td>
            <td className={adminTableCell.body} onClick={(event) => event.stopPropagation()}>
              {row.dueCount > 0 ? (
                <button
                  type="button"
                  className="focus-visible:ring-ring rounded-full focus-visible:outline-none focus-visible:ring-2"
                  onClick={() => onShowToWrite(row)}
                  aria-label={`Write ${row.dueCount} review${row.dueCount === 1 ? '' : 's'} for ${row.propertyName}`}
                >
                  <Badge variant="outline" className="font-medium">
                    <PencilLine className="size-3" aria-hidden />
                    {row.dueCount}
                  </Badge>
                </button>
              ) : (
                <span className={adminTableBodyText.secondary}>–</span>
              )}
            </td>
            <td className={adminTableCell.action} onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-end gap-0.5">
                <Link
                  to={propertySectionPath(orgSlug, row.propertySlug, 'reviews')}
                  className={adminTableIconButtonClass}
                  aria-label={`Open ${row.propertyName} reviews`}
                >
                  <ArrowUpRight className="size-4" aria-hidden />
                </Link>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </AdminDataTable>
  );
}

export function OrgPropertyReviewsCardGrid({ rows, orgSlug, onShowReviews, onShowToWrite }: Props) {
  if (rows.length === 0) {
    return (
      <ReviewsEmptyState
        icon={Building2}
        title="No listings match your search"
        description="Clear the search to see every listing in this organization."
      />
    );
  }

  return (
    <div className="native-stagger grid grid-cols-1 items-stretch gap-2 sm:grid-cols-2 sm:gap-3.5 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((row) => (
        <div
          key={row.propertyId}
          role="button"
          tabIndex={0}
          onClick={() => onShowReviews(row)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onShowReviews(row);
            }
          }}
          className="surface-card native-press focus-visible:ring-primary/40 flex min-h-[8.5rem] cursor-pointer flex-col gap-2 p-3.5 text-left outline-none focus-visible:ring-2"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-foreground min-w-0 truncate text-[13px] font-semibold">
              {row.propertyName}
            </p>
            <Link
              to={propertySectionPath(orgSlug, row.propertySlug, 'reviews')}
              onClick={(event) => event.stopPropagation()}
              className="admin-overflow-trigger shrink-0"
              aria-label={`Open ${row.propertyName} reviews`}
            >
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </div>

          {row.count === 0 ? (
            <p className="text-data-secondary">No reviews yet</p>
          ) : (
            <div className="space-y-1">
              <RatingStars value={row.avgOverall ?? 0} />
              <p className="text-data-secondary">
                {formatReviewAverage(row.avgOverall)} · {row.count} review
                {row.count === 1 ? '' : 's'} · {responseLabel(row)} responded
              </p>
            </div>
          )}

          <div className="mt-auto pt-1" onClick={(event) => event.stopPropagation()}>
            {row.dueCount > 0 ? (
              <button
                type="button"
                onClick={() => onShowToWrite(row)}
                className="focus-visible:ring-ring rounded-full focus-visible:outline-none focus-visible:ring-2"
              >
                <Badge variant="outline" className="font-medium">
                  <PencilLine className="size-3" aria-hidden />
                  {row.dueCount} to write
                </Badge>
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
