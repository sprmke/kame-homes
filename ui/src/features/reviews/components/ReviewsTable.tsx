import type { ReactNode } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import {
  ExternalLink,
  Flag,
  Megaphone,
  PencilLine,
  Reply,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';

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
import { ReviewAvatar } from '@/features/reviews/components/ReviewAvatar';
import { ReviewWindowBadge } from '@/features/reviews/components/ReviewWindowBadge';
import type {
  ReceivedReviewItem,
  ToWriteItem,
  WrittenReviewItem,
} from '@/features/reviews/lib/propertyReviewsApi';

import { ResponsiveOverflowMenu } from '@/components/mobile/ResponsiveOverflowMenu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatManilaLongDate, formatStayDateRange } from '@/utils/format/dates';

/** Org rows carry their own listing; property rows inherit the route's. */
export type ReviewScopeProps<T> = {
  orgSlug: string;
  resolvePropertySlug: (item: T) => string;
  resolvePropertyName?: (item: T) => string;
  showProperty?: boolean;
};

function GuestCell({ name, secondary }: { name: string; secondary?: string | null }) {
  return (
    <div className="flex min-w-[140px] items-center gap-2.5 sm:min-w-[160px] sm:gap-3">
      <ReviewAvatar name={name} className="size-8 shrink-0" />
      <div className="min-w-0 space-y-0.5">
        <p className={cn('truncate font-bold', adminTableBodyText.primary)}>{name}</p>
        {secondary ? (
          <p className={cn('truncate md:hidden', adminTableBodyText.secondary)}>{secondary}</p>
        ) : null}
      </div>
    </div>
  );
}

function PropertyCell({ name }: { name: string }) {
  return (
    <p className={cn('max-w-[11rem] truncate font-medium', adminTableBodyText.primary)}>{name}</p>
  );
}

function RatingCell({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <RatingStars value={value} className="shrink-0" />
      <span className="text-foreground text-xs font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function ExcerptCell({ text }: { text: string | null }) {
  if (!text?.trim()) return <span className={adminTableBodyText.secondary}>-</span>;
  return <p className={cn('line-clamp-2 max-w-[340px]', adminTableBodyText.secondary)}>{text}</p>;
}

function Row({
  index,
  onOpen,
  children,
}: {
  index: number;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <tr
      role="button"
      tabIndex={0}
      className={adminTableRowClass(index)}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      {children}
    </tr>
  );
}

/** Keeps a row action from also triggering the row's own open handler. */
function ActionCell({ children }: { children: ReactNode }) {
  return (
    <td className={adminTableCell.action} onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-end gap-0.5">{children}</div>
    </td>
  );
}

export function ReceivedReviewsTable({
  rows,
  orgSlug,
  resolvePropertySlug,
  resolvePropertyName,
  showProperty = false,
  canRespond,
  onOpen,
  onRespond,
  onReport,
}: ReviewScopeProps<ReceivedReviewItem> & {
  rows: ReceivedReviewItem[];
  canRespond: (review: ReceivedReviewItem) => boolean;
  onOpen: (review: ReceivedReviewItem) => void;
  onRespond: (review: ReceivedReviewItem) => void;
  onReport: (review: ReceivedReviewItem) => void;
}) {
  const navigate = useNavigate();

  return (
    <AdminDataTable minWidth={showProperty ? 800 : 680}>
      <AdminTableHeadRow>
        <AdminTableTh className="pl-4 pr-3 sm:pl-5">Guest</AdminTableTh>
        {showProperty ? (
          <AdminTableTh className="hidden px-3 sm:table-cell sm:px-4">Listing</AdminTableTh>
        ) : null}
        <AdminTableTh className="px-3 sm:px-4">Rating</AdminTableTh>
        <AdminTableTh className="hidden px-3 sm:px-4 md:table-cell">Review</AdminTableTh>
        <AdminTableTh className="hidden px-3 sm:px-4 lg:table-cell">Response</AdminTableTh>
        <AdminTableTh className="hidden px-3 sm:px-4 xl:table-cell">Stay</AdminTableTh>
        <AdminTableTh className="pl-2 pr-3 sm:pl-3 sm:pr-4">
          <span className="sr-only">Actions</span>
        </AdminTableTh>
      </AdminTableHeadRow>
      <tbody>
        {rows.map((review, index) => {
          const guestName = review.guestName || 'Guest';
          const stayRange = formatStayDateRange(review.checkInDate, review.checkOutDate);
          const propertySlug = resolvePropertySlug(review);
          const propertyName = resolvePropertyName?.(review) ?? '';
          const bookingHref = `${propertySectionPath(orgSlug, propertySlug, 'bookings')}/${review.bookingId}`;
          const marketingHref = `${propertySectionPath(orgSlug, propertySlug, 'marketing')}?tab=design&reviewId=${encodeURIComponent(review.id)}`;
          const mayRespond = canRespond(review);

          return (
            <Row key={review.id} index={index} onOpen={() => onOpen(review)}>
              <td className={adminTableCell.status}>
                <GuestCell name={guestName} secondary={propertyName || stayRange} />
              </td>
              {showProperty ? (
                <td className={cn('hidden sm:table-cell', adminTableCell.body)}>
                  <PropertyCell name={propertyName} />
                </td>
              ) : null}
              <td className={adminTableCell.body}>
                <RatingCell value={review.starRating} />
              </td>
              <td className={cn('hidden md:table-cell', adminTableCell.body)}>
                <ExcerptCell text={review.reviewText} />
              </td>
              <td className={cn('hidden lg:table-cell', adminTableCell.body)}>
                {review.responseText ? (
                  <Badge variant="success" className="font-medium">
                    Responded
                  </Badge>
                ) : (
                  <span className={adminTableBodyText.secondary}>-</span>
                )}
              </td>
              <td
                className={cn(
                  'hidden xl:table-cell',
                  adminTableBodyText.secondary,
                  adminTableCell.body
                )}
              >
                {stayRange ?? '-'}
              </td>
              <ActionCell>
                {mayRespond ? (
                  <button
                    type="button"
                    className={adminTableIconButtonClass}
                    aria-label={review.responseText ? 'Edit response' : 'Respond'}
                    onClick={() => onRespond(review)}
                  >
                    <Reply className="size-4" aria-hidden />
                  </button>
                ) : null}
                <ResponsiveOverflowMenu
                  label={`Actions for ${guestName}'s review`}
                  actionGroups={[
                    [
                      {
                        key: 'booking',
                        label: 'Open booking',
                        icon: <ExternalLink className="size-4" aria-hidden />,
                        onSelect: () => navigate(bookingHref),
                      },
                      {
                        key: 'marketing',
                        label: 'Use in marketing',
                        icon: <Megaphone className="size-4" aria-hidden />,
                        onSelect: () => navigate(marketingHref),
                      },
                    ],
                    ...(mayRespond
                      ? [
                          [
                            {
                              key: 'report',
                              label: 'Report',
                              icon: <Flag className="size-4" aria-hidden />,
                              destructive: true,
                              onSelect: () => onReport(review),
                            },
                          ],
                        ]
                      : []),
                  ]}
                />
              </ActionCell>
            </Row>
          );
        })}
      </tbody>
    </AdminDataTable>
  );
}

export function WrittenReviewsTable({
  rows,
  resolvePropertyName,
  showProperty = false,
  onOpen,
}: Pick<ReviewScopeProps<WrittenReviewItem>, 'resolvePropertyName' | 'showProperty'> & {
  rows: WrittenReviewItem[];
  onOpen: (review: WrittenReviewItem) => void;
}) {
  return (
    <AdminDataTable minWidth={showProperty ? 760 : 640}>
      <AdminTableHeadRow>
        <AdminTableTh className="pl-4 pr-3 sm:pl-5">Guest</AdminTableTh>
        {showProperty ? (
          <AdminTableTh className="hidden px-3 sm:table-cell sm:px-4">Listing</AdminTableTh>
        ) : null}
        <AdminTableTh className="px-3 sm:px-4">Rating</AdminTableTh>
        <AdminTableTh className="hidden px-3 sm:px-4 md:table-cell">Review</AdminTableTh>
        <AdminTableTh className="hidden px-3 sm:px-4 lg:table-cell">Host again</AdminTableTh>
        <AdminTableTh className="hidden px-3 sm:px-4 xl:table-cell">Submitted</AdminTableTh>
        <AdminTableTh className="pl-2 pr-3 sm:pl-3 sm:pr-4">
          <span className="sr-only">Actions</span>
        </AdminTableTh>
      </AdminTableHeadRow>
      <tbody>
        {rows.map((review, index) => {
          const guestName = review.guestName || 'Guest';
          const submitted = formatManilaLongDate(review.submittedAt);
          const propertyName = resolvePropertyName?.(review) ?? '';

          return (
            <Row key={review.id} index={index} onOpen={() => onOpen(review)}>
              <td className={adminTableCell.status}>
                <GuestCell name={guestName} secondary={propertyName || submitted || null} />
              </td>
              {showProperty ? (
                <td className={cn('hidden sm:table-cell', adminTableCell.body)}>
                  <PropertyCell name={propertyName} />
                </td>
              ) : null}
              <td className={adminTableCell.body}>
                <RatingCell value={review.overallRating} />
              </td>
              <td className={cn('hidden md:table-cell', adminTableCell.body)}>
                <ExcerptCell text={review.reviewText} />
              </td>
              <td className={cn('hidden lg:table-cell', adminTableCell.body)}>
                <div className="inline-flex flex-col items-start gap-1">
                  <Badge
                    variant={review.wouldHostAgain ? 'success' : 'destructive'}
                    className="font-medium"
                  >
                    {review.wouldHostAgain ? (
                      <ThumbsUp className="size-3" aria-hidden />
                    ) : (
                      <ThumbsDown className="size-3" aria-hidden />
                    )}
                    {review.wouldHostAgain ? 'Yes' : 'No'}
                  </Badge>
                  {review.status === 'submitted' ? (
                    <Badge variant="outline" className="font-medium">
                      Hidden until publish
                    </Badge>
                  ) : null}
                </div>
              </td>
              <td
                className={cn(
                  'hidden xl:table-cell',
                  adminTableBodyText.secondary,
                  adminTableCell.body
                )}
              >
                {submitted || '-'}
              </td>
              <ActionCell>
                <button
                  type="button"
                  className={adminTableIconButtonClass}
                  aria-label={`Open ${guestName}'s review`}
                  onClick={() => onOpen(review)}
                >
                  <ExternalLink className="size-4" aria-hidden />
                </button>
              </ActionCell>
            </Row>
          );
        })}
      </tbody>
    </AdminDataTable>
  );
}

export function ToWriteReviewsTable({
  rows,
  orgSlug,
  resolvePropertySlug,
  resolvePropertyName,
  showProperty = false,
  canWrite,
  onWrite,
}: ReviewScopeProps<ToWriteItem> & {
  rows: ToWriteItem[];
  canWrite: (row: ToWriteItem) => boolean;
  onWrite: (row: ToWriteItem) => void;
}) {
  return (
    <AdminDataTable minWidth={showProperty ? 680 : 560}>
      <AdminTableHeadRow>
        <AdminTableTh className="pl-4 pr-3 sm:pl-5">Guest</AdminTableTh>
        {showProperty ? (
          <AdminTableTh className="hidden px-3 sm:table-cell sm:px-4">Listing</AdminTableTh>
        ) : null}
        <AdminTableTh className="hidden px-3 sm:px-4 md:table-cell">Stay</AdminTableTh>
        <AdminTableTh className="px-3 sm:px-4">Window</AdminTableTh>
        <AdminTableTh className="pl-2 pr-3 sm:pl-3 sm:pr-4">
          <span className="sr-only">Actions</span>
        </AdminTableTh>
      </AdminTableHeadRow>
      <tbody>
        {rows.map((row, index) => {
          const guestName = row.guestName || 'Guest';
          const stayRange = formatStayDateRange(row.checkInDate, row.checkOutDate);
          const propertyName = resolvePropertyName?.(row) ?? '';
          const bookingHref = `${propertySectionPath(orgSlug, resolvePropertySlug(row), 'bookings')}/${row.bookingId}`;
          const mayWrite = canWrite(row);

          return (
            <Row
              key={row.bookingId}
              index={index}
              onOpen={() => (mayWrite ? onWrite(row) : undefined)}
            >
              <td className={adminTableCell.status}>
                <GuestCell name={guestName} secondary={propertyName || stayRange} />
              </td>
              {showProperty ? (
                <td className={cn('hidden sm:table-cell', adminTableCell.body)}>
                  <PropertyCell name={propertyName} />
                </td>
              ) : null}
              <td
                className={cn(
                  'hidden md:table-cell',
                  adminTableBodyText.secondary,
                  adminTableCell.body
                )}
              >
                {stayRange ?? '-'}
              </td>
              <td className={adminTableCell.body}>
                <ReviewWindowBadge closesAt={row.closesAt} />
              </td>
              <ActionCell>
                {mayWrite ? (
                  <button
                    type="button"
                    className={adminTableIconButtonClass}
                    aria-label={`Write review for ${guestName}`}
                    onClick={() => onWrite(row)}
                  >
                    <PencilLine className="size-4" aria-hidden />
                  </button>
                ) : (
                  <Link
                    to={bookingHref}
                    className={adminTableIconButtonClass}
                    aria-label={`Open booking for ${guestName}`}
                  >
                    <ExternalLink className="size-4" aria-hidden />
                  </Link>
                )}
              </ActionCell>
            </Row>
          );
        })}
      </tbody>
    </AdminDataTable>
  );
}
