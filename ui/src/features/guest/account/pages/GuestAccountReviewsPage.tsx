import { useEffect, useMemo, useState } from 'react';

import { Link, useSearchParams } from 'react-router-dom';

import { Inbox, PencilLine, Star } from 'lucide-react';

import { GuestAccountContentCard } from '@/features/guest/account/components/GuestAccountContentCard';
import { GuestAccountEmptyState } from '@/features/guest/account/components/GuestAccountEmptyState';
import { storeGuestBookingAccessToken } from '@/features/guest/form/lib/guestBookingAccess';
import { guestReviewPath } from '@/features/guest/lib/guestPublicPaths';

import { GuestReviewResponseSheet } from '@/features/reviews/components/GuestReviewResponseSheet';
import { ReportReviewSheet } from '@/features/reviews/components/ReportReviewSheet';
import { ReputationSummary } from '@/features/reviews/components/ReputationSummary';
import { ReviewResponseBlock } from '@/features/reviews/components/ReviewResponseBlock';
import { ReviewWindowBadge } from '@/features/reviews/components/ReviewWindowBadge';
import {
  useGuestMyReviews,
  useReportReviewAsGuest,
} from '@/features/reviews/hooks/useGuestMyReviews';
import type {
  GuestAboutYouItem,
  GuestByYouItem,
  GuestReviewListTab,
  GuestToWriteItem,
} from '@/features/reviews/lib/guestReviewsApi';

import { ResponsiveOverflowMenu } from '@/components/mobile/ResponsiveOverflowMenu';
import { GuestReviewsPageSkeleton } from '@/components/skeletons/GuestAccountSkeletons';
import { Button } from '@/components/ui/button';
import { SlidingTabs, SlidingTabsList, SlidingTabsTrigger } from '@/components/ui/sliding-tabs';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { formatStayDateRange } from '@/utils/format/dates';

const TABS: Array<{ value: GuestReviewListTab; label: string; icon: typeof Star }> = [
  { value: 'to_write', label: 'To write', icon: PencilLine },
  { value: 'by_you', label: 'By you', icon: Star },
  { value: 'about_you', label: 'About you', icon: Inbox },
];

export function GuestAccountReviewsPage() {
  usePageTitle(publicPageTitle('Reviews'));
  const [searchParams, setSearchParams] = useSearchParams();
  const tabRaw = searchParams.get('tab');
  const tab: GuestReviewListTab =
    tabRaw === 'by_you' || tabRaw === 'about_you' ? tabRaw : 'to_write';
  const query = useGuestMyReviews(tab);
  const report = useReportReviewAsGuest();
  const [respond, setRespond] = useState<{ bookingId: string; text: string | null } | null>(null);
  const [reportTarget, setReportTarget] = useState<string | null>(null);

  const items = useMemo(
    () =>
      (query.data?.pages ?? []).flatMap(
        (page) => page.items as Array<GuestToWriteItem | GuestByYouItem | GuestAboutYouItem>
      ),
    [query.data?.pages]
  );
  const reputation = query.data?.pages[0]?.reputation ?? null;

  // `/guest-review` reads the booking access token from sessionStorage, so the
  // links below work without putting the token in the URL.
  useEffect(() => {
    for (const item of items) {
      if (item.accessToken) storeGuestBookingAccessToken(item.bookingId, item.accessToken);
    }
  }, [items]);

  const setTab = (next: GuestReviewListTab) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === 'to_write') params.delete('tab');
        else params.set('tab', next);
        return params;
      },
      { replace: true }
    );
  };

  return (
    <div className="space-y-4">
      <SlidingTabs value={tab} onValueChange={(value) => setTab(value as GuestReviewListTab)}>
        <SlidingTabsList className="w-full">
          {TABS.map((item) => (
            <SlidingTabsTrigger key={item.value} value={item.value} className="min-h-[44px]">
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </SlidingTabsTrigger>
          ))}
        </SlidingTabsList>
      </SlidingTabs>

      {query.isLoading ? (
        <GuestAccountContentCard>
          <GuestReviewsPageSkeleton />
        </GuestAccountContentCard>
      ) : query.isError ? (
        <GuestAccountContentCard>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm">Could not load reviews</p>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={() => void query.refetch()}
            >
              Try again
            </Button>
          </div>
        </GuestAccountContentCard>
      ) : items.length === 0 ? (
        <GuestAccountEmptyState
          message={
            tab === 'to_write'
              ? 'No stays to review'
              : tab === 'about_you'
                ? 'No reviews yet'
                : 'No reviews yet'
          }
        />
      ) : (
        <div className="space-y-3">
          {tab === 'about_you' && reputation ? <ReputationSummary reputation={reputation} /> : null}
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={'id' in item ? item.id : item.bookingId}>
                {tab === 'to_write' ? (
                  <ToWriteCard item={item as GuestToWriteItem} />
                ) : tab === 'by_you' ? (
                  <ByYouCard item={item as GuestByYouItem} />
                ) : (
                  <AboutYouCard
                    item={item as GuestAboutYouItem}
                    onRespond={() =>
                      setRespond({
                        bookingId: item.bookingId,
                        text: (item as GuestAboutYouItem).responseText,
                      })
                    }
                    onReport={() => setReportTarget((item as GuestAboutYouItem).id)}
                  />
                )}
              </li>
            ))}
          </ul>
          {query.hasNextPage ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          ) : null}
        </div>
      )}

      <GuestReviewResponseSheet
        open={respond != null}
        onOpenChange={(open) => {
          if (!open) setRespond(null);
        }}
        bookingId={respond?.bookingId ?? ''}
        existingText={respond?.text ?? null}
      />
      <ReportReviewSheet
        open={reportTarget != null}
        onOpenChange={(open) => {
          if (!open) setReportTarget(null);
        }}
        reviewKind="host_guest_review"
        reviewId={reportTarget ?? ''}
        onSubmit={(input) => report.mutateAsync(input)}
        shell="guest"
      />
    </div>
  );
}

function StayMeta({
  propertyName,
  checkInDate,
  checkOutDate,
}: {
  propertyName: string;
  checkInDate: string | null;
  checkOutDate: string | null;
}) {
  const range = formatStayDateRange(checkInDate, checkOutDate);
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">{propertyName}</p>
      {range ? <p className="text-muted-foreground text-sm">{range}</p> : null}
    </div>
  );
}

function ToWriteCard({ item }: { item: GuestToWriteItem }) {
  return (
    <GuestAccountContentCard>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <StayMeta
          propertyName={item.propertyName}
          checkInDate={item.checkInDate}
          checkOutDate={item.checkOutDate}
        />
        <div className="flex shrink-0 items-center justify-between gap-2 sm:ml-auto sm:justify-end">
          <ReviewWindowBadge closesAt={item.closesAt} />
          {item.propertySlug ? (
            <Button asChild className="min-h-[44px]">
              <Link to={guestReviewPath(item.propertySlug, item.bookingId)}>Write review</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </GuestAccountContentCard>
  );
}

function ByYouCard({ item }: { item: GuestByYouItem }) {
  const pending = item.status !== 'published';
  return (
    <GuestAccountContentCard>
      <div className="flex items-start gap-3">
        <StayMeta
          propertyName={item.propertyName}
          checkInDate={item.checkInDate}
          checkOutDate={item.checkOutDate}
        />
        {pending ? (
          <span className="bg-muted text-muted-foreground ml-auto rounded-full px-2 py-0.5 text-xs font-medium">
            Pending
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm">
        {'★'.repeat(Math.max(0, Math.min(5, item.starRating)))}
        {item.reviewText ? ` · ${item.reviewText}` : ''}
      </p>
      <ReviewResponseBlock responseText={item.responseText} label="Host response" />
      {pending && item.propertySlug ? (
        <Button asChild variant="outline" className="mt-3 min-h-[44px]">
          <Link to={guestReviewPath(item.propertySlug, item.bookingId)}>Edit</Link>
        </Button>
      ) : null}
    </GuestAccountContentCard>
  );
}

function AboutYouCard({
  item,
  onRespond,
  onReport,
}: {
  item: GuestAboutYouItem;
  onRespond: () => void;
  onReport: () => void;
}) {
  if (item.hiddenUntilYouReview) {
    return (
      <GuestAccountContentCard>
        <StayMeta
          propertyName={item.propertyName}
          checkInDate={item.checkInDate}
          checkOutDate={item.checkOutDate}
        />
        <p className="mt-2 text-sm">Hidden until you review</p>
        {item.propertySlug ? (
          <Button asChild className="mt-3 min-h-[44px]">
            <Link to={guestReviewPath(item.propertySlug, item.bookingId)}>Write review</Link>
          </Button>
        ) : null}
      </GuestAccountContentCard>
    );
  }
  return (
    <GuestAccountContentCard>
      <div className="flex items-start gap-2">
        <StayMeta
          propertyName={item.propertyName}
          checkInDate={item.checkInDate}
          checkOutDate={item.checkOutDate}
        />
        <div className="ml-auto">
          <ResponsiveOverflowMenu
            label="Review actions"
            actionGroups={[[{ key: 'report', label: 'Report', onSelect: onReport }]]}
          />
        </div>
      </div>
      <p className="mt-2 text-sm">
        {item.overallRating != null ? `${'★'.repeat(item.overallRating)} ` : ''}
        {item.reviewText}
      </p>
      {item.privateNote ? (
        <p className="text-muted-foreground mt-2 text-sm">Private note: {item.privateNote}</p>
      ) : null}
      <ReviewResponseBlock responseText={item.responseText} />
      <Button type="button" variant="outline" className="mt-3 min-h-[44px]" onClick={onRespond}>
        {item.responseText ? 'Edit response' : 'Respond'}
      </Button>
    </GuestAccountContentCard>
  );
}
