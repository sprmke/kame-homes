import { useMemo, useState } from 'react';

import { Link, useSearchParams } from 'react-router-dom';

import { Inbox, PencilLine, Star } from 'lucide-react';

import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import { hasPropertyPermission } from '@/features/dashboard/team/lib/propertyPermissions';

import { HostGuestReviewSheet } from '@/features/reviews/components/HostGuestReviewSheet';
import { RatingSummary } from '@/features/reviews/components/RatingSummary';
import { ReviewAutomationCard } from '@/features/reviews/components/ReviewAutomationCard';
import { ReviewCard } from '@/features/reviews/components/ReviewCard';
import { ReviewsLoadError } from '@/features/reviews/components/ReviewsLoadError';
import { useGuestReputation } from '@/features/reviews/hooks/useGuestReputation';
import { usePropertyReviews } from '@/features/reviews/hooks/usePropertyReviews';
import type {
  ReceivedReviewItem,
  ReviewListTab,
  ToWriteItem,
  WrittenReviewItem,
} from '@/features/reviews/lib/propertyReviewsApi';

import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { ListRowsSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { SlidingTabs, SlidingTabsList, SlidingTabsTrigger } from '@/components/ui/sliding-tabs';
import { usePageTitle } from '@/lib/pageTitle';

const TABS: Array<{ value: ReviewListTab; label: string; icon: typeof Star }> = [
  { value: 'received', label: 'Received', icon: Inbox },
  { value: 'written', label: 'Written', icon: PencilLine },
  { value: 'to_write', label: 'To write', icon: Star },
];

function parseTab(value: string | null): ReviewListTab {
  if (value === 'written' || value === 'to_write' || value === 'received') return value;
  return 'received';
}

export function PropertyReviewsPage() {
  const { property, orgSlug, propertySlug } = useOrgContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));
  const query = usePropertyReviews(tab);
  const { data: access } = usePropertyPermissions();
  const canRespond = hasPropertyPermission(access?.permissions, 'reviews.responses:edit');
  const canWriteGuest = hasPropertyPermission(access?.permissions, 'reviews.guests:edit');
  const [writeBooking, setWriteBooking] = useState<{
    bookingId: string;
    guestName: string;
  } | null>(null);

  usePageTitle(property?.name ? `${property.name} - Reviews` : undefined);

  const summary = query.data?.pages[0]?.summary;
  const items = useMemo(
    () =>
      (query.data?.pages ?? []).flatMap(
        (page) => page.items as Array<ReceivedReviewItem | WrittenReviewItem | ToWriteItem>
      ),
    [query.data?.pages]
  );

  const setTab = (next: ReviewListTab) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === 'received') params.delete('tab');
        else params.set('tab', next);
        return params;
      },
      { replace: true }
    );
  };

  return (
    <AdminMobilePage title="Reviews">
      <div className="space-y-4">
        <RatingSummary
          summary={summary}
          loading={query.isLoading}
          onDueClick={() => setTab('to_write')}
        />

        <SlidingTabs value={tab} onValueChange={(value) => setTab(parseTab(value))}>
          <SlidingTabsList size="primary" className="max-w-full">
            {TABS.map(({ value, label, icon: Icon }) => (
              <SlidingTabsTrigger key={value} value={value}>
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </SlidingTabsTrigger>
            ))}
          </SlidingTabsList>
        </SlidingTabs>

        {query.isLoading ? (
          <ListRowsSkeleton rows={5} label="Loading reviews" />
        ) : query.isError ? (
          <ReviewsLoadError onRetry={() => void query.refetch()} />
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {tab === 'to_write'
              ? 'No guests waiting for a review.'
              : tab === 'written'
                ? 'No guest reviews written yet.'
                : 'No published guest reviews yet.'}
          </p>
        ) : tab === 'received' ? (
          <div className="space-y-3">
            {(items as ReceivedReviewItem[]).map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                orgSlug={orgSlug}
                propertySlug={propertySlug}
                canRespond={canRespond}
              />
            ))}
          </div>
        ) : tab === 'written' ? (
          <div className="space-y-3">
            {(items as WrittenReviewItem[]).map((review) => (
              <article key={review.id} className="border-border bg-card rounded-xl border p-4">
                <p className="font-medium">{review.guestName || 'Guest'}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {review.overallRating}/5
                  {review.wouldHostAgain ? ' · Would host again' : ' · Would not host again'}
                  {review.status === 'submitted' ? ' · Hidden until publish' : ''}
                </p>
                {review.reviewText ? <p className="mt-2 text-sm">{review.reviewText}</p> : null}
                <Button type="button" variant="outline" className="mt-3 min-h-[44px]" asChild>
                  <Link
                    to={`${propertySectionPath(orgSlug, propertySlug, 'bookings')}/${review.bookingId}`}
                  >
                    Open booking
                  </Link>
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {(items as ToWriteItem[]).map((row) => (
              <article key={row.bookingId} className="border-border bg-card rounded-xl border p-4">
                <p className="font-medium">{row.guestName || 'Guest'}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Closes{' '}
                  {new Date(row.closesAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
                {canWriteGuest ? (
                  <Button
                    type="button"
                    className="mt-3 min-h-[44px]"
                    onClick={() =>
                      setWriteBooking({
                        bookingId: row.bookingId,
                        guestName: row.guestName || 'Guest',
                      })
                    }
                  >
                    Write review
                  </Button>
                ) : (
                  <Button type="button" variant="outline" className="mt-3 min-h-[44px]" asChild>
                    <Link
                      to={`${propertySectionPath(orgSlug, propertySlug, 'bookings')}/${row.bookingId}`}
                    >
                      Open booking
                    </Link>
                  </Button>
                )}
              </article>
            ))}
          </div>
        )}

        <ReviewAutomationCard canEdit={canWriteGuest} />

        {query.hasNextPage ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        ) : null}
      </div>

      {writeBooking ? (
        <WriteGuestReviewSheet
          bookingId={writeBooking.bookingId}
          guestName={writeBooking.guestName}
          onClose={() => setWriteBooking(null)}
        />
      ) : null}
    </AdminMobilePage>
  );
}

function WriteGuestReviewSheet({
  bookingId,
  guestName,
  onClose,
}: {
  bookingId: string;
  guestName: string;
  onClose: () => void;
}) {
  const { data } = useGuestReputation(bookingId);
  return (
    <HostGuestReviewSheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      bookingId={bookingId}
      guestName={guestName}
      draft={data?.hostReview ?? null}
    />
  );
}
