import { useCallback, useMemo, useState } from 'react';

import { useParams, useSearchParams } from 'react-router-dom';

import { Building2, PencilLine, Quote, Sparkles, UserCheck } from 'lucide-react';

import { AdminListPagination } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOrganizations } from '@/features/dashboard/org/hooks/useOrganizations';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import { hasPropertyPermission } from '@/features/dashboard/team/lib/propertyPermissions';

import { HostGuestReviewSheet } from '@/features/reviews/components/HostGuestReviewSheet';
import {
  OrgPropertyReviewsCardGrid,
  OrgPropertyReviewsTable,
} from '@/features/reviews/components/OrgPropertyReviewsTable';
import { ReportReviewSheet } from '@/features/reviews/components/ReportReviewSheet';
import { ReviewAutomationSheet } from '@/features/reviews/components/ReviewAutomationSheet';
import {
  ReceivedReviewDetailSheet,
  WrittenReviewDetailSheet,
} from '@/features/reviews/components/ReviewDetailSheet';
import { ReviewResponseSheet } from '@/features/reviews/components/ReviewResponseSheet';
import {
  ReceivedReviewsCardGrid,
  ToWriteReviewsCardGrid,
  WrittenReviewsCardGrid,
} from '@/features/reviews/components/ReviewsCardGrid';
import { ReviewsEmptyState } from '@/features/reviews/components/ReviewsEmptyState';
import { ReviewsLoadError } from '@/features/reviews/components/ReviewsLoadError';
import { ReviewsRatingSheet } from '@/features/reviews/components/ReviewsRatingSheet';
import {
  ReviewsSummaryCards,
  ReviewsSummaryCardsSkeleton,
} from '@/features/reviews/components/ReviewsSummaryCards';
import {
  ReceivedReviewsTable,
  ToWriteReviewsTable,
  WrittenReviewsTable,
} from '@/features/reviews/components/ReviewsTable';
import { ReviewsToolbar } from '@/features/reviews/components/ReviewsToolbar';
import { useGuestReputation } from '@/features/reviews/hooks/useGuestReputation';
import { useOrgReviews } from '@/features/reviews/hooks/useOrgReviews';
import { usePropertyReviews } from '@/features/reviews/hooks/usePropertyReviews';
import {
  parseOrgPropertySort,
  sortOrgPropertyRows,
  type OrgPropertyReviewRow,
  type OrgPropertySort,
  type OrgReceivedReviewItem,
  type OrgToWriteItem,
} from '@/features/reviews/lib/orgReviewsApi';
import {
  activeReviewsFilterCount,
  defaultReviewsQuery,
  parseReviewsQueryFromParams,
  parseReviewsPageTab,
  reviewsApiTab,
  writeReviewsQueryToParams,
  type ReceivedReviewItem,
  type ReviewsPageTab,
  type ReviewsQuery,
  type ToWriteItem,
  type WrittenReviewItem,
} from '@/features/reviews/lib/propertyReviewsApi';
import { ReviewPropertyScopeProvider } from '@/features/reviews/lib/reviewPropertyScope';
import { REVIEW_WINDOW_DAYS } from '@/features/reviews/lib/reviewWindow';

import { FloatingToolbar } from '@/components/mobile/FloatingPanel';
import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { MobileHeroActionButton } from '@/components/mobile/MobileHeroActionButton';
import {
  FinanceStaysCardGridSkeleton,
  FinanceStaysTableSkeleton,
} from '@/components/skeletons/AdminSkeletons';
import { SlidingTabs, SlidingTabsList, SlidingTabsTrigger } from '@/components/ui/sliding-tabs';
import { useAdminMobileCardViewGuard } from '@/hooks/useAdminMobileCardViewGuard';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { orgPageTitle, usePageTitle } from '@/lib/pageTitle';
import { buildPageItems } from '@/lib/table/pagination';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

export type ReviewsListScope = 'property' | 'org';

/**
 * Labels name the subject, not the voice: "Written" vs "To write" read as the
 * same thing at a glance. Query values stay `received | written | to_write`.
 */
const REVIEW_TABS: Array<{ value: ReviewsPageTab; label: string; icon: LucideIcon }> = [
  { value: 'received', label: 'From guests', icon: Quote },
  { value: 'to_write', label: 'To write', icon: PencilLine },
  { value: 'written', label: 'About guests', icon: UserCheck },
];

const PROPERTIES_TAB = { value: 'properties' as const, label: 'By property', icon: Building2 };

type Props = { scope: ReviewsListScope };

/**
 * Reviews list for one property and for the whole org. Same shell both ways:
 * KPI cards → tabs → toolbar → table or cards → pagination. The org scope adds a
 * Listing column, a listing filter, and a By-property tab; its row actions come
 * from per-listing permissions the endpoint resolves, not from one page flag.
 */
export function ReviewsListPage({ scope }: Props) {
  const isOrg = scope === 'org';
  const orgContext = useOptionalOrgContext();
  const { orgSlug: orgSlugParam = '' } = useParams<{ orgSlug: string }>();
  const orgSlug = orgContext?.org.slug ?? orgSlugParam;
  const propertySlug = orgContext?.propertySlug ?? '';
  const { data: orgsData } = useOrganizations();
  const org = orgsData?.organizations.find((entry) => entry.slug === orgSlug);

  const [searchParams, setSearchParams] = useSearchParams();
  const isMobileLayout = useIsBelowLg();
  const tab = parseReviewsPageTab(searchParams.get('tab'), isOrg);
  const apiTab = reviewsApiTab(tab);
  const query = useMemo(
    () => parseReviewsQueryFromParams(searchParams, apiTab),
    [searchParams, apiTab]
  );
  const propertySort = parseOrgPropertySort(searchParams.get('listingSort'));

  const { data: access } = usePropertyPermissions();
  const propertyCanRespond = hasPropertyPermission(access?.permissions, 'reviews.responses:edit');
  const propertyCanWriteGuest = hasPropertyPermission(access?.permissions, 'reviews.guests:edit');

  const [automationOpen, setAutomationOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [detailReceived, setDetailReceived] = useState<ReceivedReviewItem | null>(null);
  const [detailWritten, setDetailWritten] = useState<WrittenReviewItem | null>(null);
  const [respondReview, setRespondReview] = useState<ReceivedReviewItem | null>(null);
  const [reportReview, setReportReview] = useState<ReceivedReviewItem | null>(null);
  const [writeBooking, setWriteBooking] = useState<ToWriteItem | null>(null);

  usePageTitle(
    isOrg
      ? org?.name
        ? orgPageTitle(org.name, 'Reviews')
        : undefined
      : orgContext?.property?.name
        ? `${orgContext.property.name} - Reviews`
        : undefined
  );

  const writeParams = useCallback(
    (nextTab: ReviewsPageTab, nextQuery: ReviewsQuery, nextSort: OrgPropertySort) => {
      const params = writeReviewsQueryToParams(reviewsApiTab(nextTab), nextQuery);
      if (nextTab === 'properties') params.set('tab', 'properties');
      if (nextSort !== 'name:asc') params.set('listingSort', nextSort);
      return params;
    },
    []
  );

  const setQuery = useCallback(
    (next: ReviewsQuery) => {
      setSearchParams(writeParams(tab, next, propertySort), { replace: true });
    },
    [setSearchParams, tab, propertySort, writeParams]
  );

  /** Filters and sort are tab-specific; view, page size and listing scope are not. */
  const setTab = useCallback(
    (next: ReviewsPageTab, overrides?: Partial<ReviewsQuery>) => {
      setSearchParams(
        writeParams(
          next,
          {
            ...defaultReviewsQuery(reviewsApiTab(next)),
            view: query.view,
            limit: query.limit,
            properties: query.properties,
            ...overrides,
          },
          propertySort
        ),
        { replace: true }
      );
    },
    [setSearchParams, query.view, query.limit, query.properties, propertySort, writeParams]
  );

  const setPropertySort = (next: OrgPropertySort) => {
    setSearchParams(writeParams(tab, query, next), { replace: true });
  };

  useAdminMobileCardViewGuard(isMobileLayout, query, setQuery);

  const propertyReviews = usePropertyReviews(apiTab, query, { enabled: !isOrg });
  const orgReviews = useOrgReviews(apiTab, query, {
    enabled: isOrg,
    listingsOnly: tab === 'properties',
  });
  const reviews = isOrg ? orgReviews : propertyReviews;

  const summary = reviews.data?.summary;
  const dueCount = summary?.dueCount ?? 0;
  const items = reviews.data?.items ?? [];
  const total = reviews.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / query.limit));
  const orgListings = orgReviews.data?.summary.properties;
  const listingRows = useMemo(() => (isOrg ? (orgListings ?? []) : []), [isOrg, orgListings]);
  const listingOptions = useMemo(
    () => listingRows.map((row) => ({ value: row.propertyId, label: row.propertyName })),
    [listingRows]
  );
  const visibleListings = useMemo(
    () => sortOrgPropertyRows(listingRows, propertySort, tab === 'properties' ? query.q : ''),
    [listingRows, propertySort, tab, query.q]
  );

  const hasActiveQuery =
    query.q.trim().length > 0 ||
    activeReviewsFilterCount(apiTab, query) > 0 ||
    query.properties.length > 0;
  const showTable = query.view === 'table' && !isMobileLayout;
  const tabs = isOrg ? [...REVIEW_TABS, PROPERTIES_TAB] : REVIEW_TABS;

  /** Org rows carry their own listing; property rows inherit the route's. */
  const resolvePropertySlug = (item: object): string =>
    isOrg ? ((item as { propertySlug?: string }).propertySlug ?? '') : propertySlug;
  const resolvePropertyName = (item: object): string =>
    (item as { propertyName?: string }).propertyName ?? '';
  const canRespondTo = (review: ReceivedReviewItem) =>
    isOrg ? Boolean((review as OrgReceivedReviewItem).canRespond) : propertyCanRespond;
  const canWriteFor = (row: ToWriteItem) =>
    isOrg ? Boolean((row as OrgToWriteItem).canWrite) : propertyCanWriteGuest;
  /** The listing an open sheet acts on — the row's own on the org rollup. */
  const sheetPropertyId = (item: object | null): string | null =>
    isOrg ? ((item as { propertyId?: string } | null)?.propertyId ?? null) : null;

  const showListingInFeed = isOrg && listingRows.length > 1 && query.properties.length !== 1;

  const showListingReviews = (row: OrgPropertyReviewRow) =>
    setTab('received', { properties: [row.propertyId] });
  const showListingToWrite = (row: OrgPropertyReviewRow) =>
    setTab('to_write', { properties: [row.propertyId] });

  const emptyState = () => {
    if (hasActiveQuery) {
      return (
        <ReviewsEmptyState
          icon={Quote}
          title="No reviews match your filters"
          description="Clear the search or filters to see every review."
        />
      );
    }
    if (apiTab === 'to_write') {
      return (
        <ReviewsEmptyState
          icon={PencilLine}
          title="No guests waiting for a review"
          description={`Stays appear here for ${REVIEW_WINDOW_DAYS} days after checkout.`}
        />
      );
    }
    if (apiTab === 'written') {
      return <ReviewsEmptyState icon={UserCheck} title="No guest reviews written yet" />;
    }
    return (
      <ReviewsEmptyState
        icon={Quote}
        title="No published guest reviews yet"
        description="A review publishes once both sides review or the window closes."
      />
    );
  };

  const scopeProps = {
    orgSlug,
    resolvePropertySlug,
    resolvePropertyName,
    showProperty: showListingInFeed,
  };

  const list = () => {
    if (apiTab === 'received') {
      const rows = items as ReceivedReviewItem[];
      const props = {
        ...scopeProps,
        rows,
        canRespond: canRespondTo,
        onOpen: setDetailReceived,
        onRespond: setRespondReview,
        onReport: setReportReview,
      };
      return showTable ? (
        <ReceivedReviewsTable {...props} />
      ) : (
        <ReceivedReviewsCardGrid {...props} />
      );
    }

    if (apiTab === 'written') {
      const rows = items as WrittenReviewItem[];
      const props = {
        rows,
        resolvePropertyName,
        showProperty: showListingInFeed,
        onOpen: setDetailWritten,
      };
      return showTable ? <WrittenReviewsTable {...props} /> : <WrittenReviewsCardGrid {...props} />;
    }

    const rows = items as ToWriteItem[];
    const props = {
      ...scopeProps,
      rows,
      canWrite: canWriteFor,
      onWrite: setWriteBooking,
    };
    return showTable ? <ToWriteReviewsTable {...props} /> : <ToWriteReviewsCardGrid {...props} />;
  };

  const body = () => {
    if (reviews.isLoading) {
      return showTable ? <FinanceStaysTableSkeleton /> : <FinanceStaysCardGridSkeleton />;
    }
    if (reviews.isError) {
      return <ReviewsLoadError onRetry={() => void reviews.refetch()} />;
    }
    if (tab === 'properties') {
      return showTable ? (
        <OrgPropertyReviewsTable
          rows={visibleListings}
          orgSlug={orgSlug}
          onShowReviews={showListingReviews}
          onShowToWrite={showListingToWrite}
        />
      ) : (
        <OrgPropertyReviewsCardGrid
          rows={visibleListings}
          orgSlug={orgSlug}
          onShowReviews={showListingReviews}
          onShowToWrite={showListingToWrite}
        />
      );
    }
    return items.length === 0 ? emptyState() : list();
  };

  return (
    <AdminMobilePage
      title="Reviews"
      subtitle={
        isOrg
          ? 'Read and answer guest reviews across every listing.'
          : 'Read guest reviews, respond, and review guests after checkout.'
      }
      titleId="reviews-heading"
      heroTrailing={
        isOrg ? undefined : (
          <MobileHeroActionButton aria-label="Auto-review" onClick={() => setAutomationOpen(true)}>
            <Sparkles className="size-5" aria-hidden />
          </MobileHeroActionButton>
        )
      }
      desktopActions={
        isOrg ? undefined : (
          <button
            type="button"
            className="native-cta sm:w-auto sm:px-3.5"
            onClick={() => setAutomationOpen(true)}
          >
            <Sparkles className="size-4" aria-hidden />
            Auto-review
          </button>
        )
      }
      desktopActionsClassName="w-full sm:w-auto"
    >
      {reviews.isLoading && !summary ? (
        <ReviewsSummaryCardsSkeleton />
      ) : (
        <ReviewsSummaryCards
          summary={summary}
          onOpenBreakdown={() => setRatingOpen(true)}
          onShowToWrite={() => setTab('to_write')}
          toWriteActive={tab === 'to_write'}
        />
      )}

      <SlidingTabs value={tab} onValueChange={(value) => setTab(parseReviewsPageTab(value, isOrg))}>
        <SlidingTabsList size="primary" remeasureDeps={[dueCount > 0, isOrg]}>
          {tabs.map(({ value, label, icon: Icon }) => (
            <SlidingTabsTrigger key={value} value={value}>
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
              {value === 'to_write' && dueCount > 0 ? (
                <span
                  aria-label={`${dueCount} waiting`}
                  className={cn(
                    'ml-0.5 inline-flex min-w-[1.125rem] shrink-0 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums',
                    tab === 'to_write'
                      ? 'bg-primary-strong text-primary-foreground'
                      : 'bg-background text-foreground'
                  )}
                >
                  {dueCount}
                </span>
              ) : null}
            </SlidingTabsTrigger>
          ))}
        </SlidingTabsList>
      </SlidingTabs>

      <FloatingToolbar>
        <ReviewsToolbar
          tab={tab}
          query={query}
          onChange={setQuery}
          hideTableView={isMobileLayout}
          listingOptions={isOrg ? listingOptions : undefined}
          propertySort={propertySort}
          onPropertySortChange={setPropertySort}
        />
      </FloatingToolbar>

      <div role="region" aria-label={tabs.find((entry) => entry.value === tab)?.label}>
        {body()}
      </div>

      {tab !== 'properties' && pageCount > 1 ? (
        <AdminListPagination
          ariaLabel="Reviews pagination"
          page={query.page}
          pageCount={pageCount}
          pageItems={buildPageItems(query.page, pageCount)}
          isLoading={reviews.isLoading}
          onPageChange={(page) => setQuery({ ...query, page })}
        />
      ) : null}

      <ReviewsRatingSheet open={ratingOpen} onOpenChange={setRatingOpen} summary={summary} />

      {!isOrg ? (
        <ReviewAutomationSheet
          open={automationOpen}
          onOpenChange={setAutomationOpen}
          canEdit={propertyCanWriteGuest}
        />
      ) : null}

      {detailReceived ? (
        <ReviewPropertyScopeProvider propertyId={sheetPropertyId(detailReceived)}>
          <ReceivedReviewDetailSheet
            open
            onOpenChange={(open) => {
              if (!open) setDetailReceived(null);
            }}
            review={detailReceived}
            orgSlug={orgSlug}
            propertySlug={resolvePropertySlug(detailReceived)}
            propertyName={isOrg ? resolvePropertyName(detailReceived) : undefined}
            canRespond={canRespondTo(detailReceived)}
            onRespond={() => {
              setRespondReview(detailReceived);
              setDetailReceived(null);
            }}
            onReport={() => {
              setReportReview(detailReceived);
              setDetailReceived(null);
            }}
          />
        </ReviewPropertyScopeProvider>
      ) : null}

      {detailWritten ? (
        <ReviewPropertyScopeProvider propertyId={sheetPropertyId(detailWritten)}>
          <WrittenReviewDetailSheet
            open
            onOpenChange={(open) => {
              if (!open) setDetailWritten(null);
            }}
            review={detailWritten}
            orgSlug={orgSlug}
            propertySlug={resolvePropertySlug(detailWritten)}
            propertyName={isOrg ? resolvePropertyName(detailWritten) : undefined}
          />
        </ReviewPropertyScopeProvider>
      ) : null}

      {respondReview ? (
        <ReviewPropertyScopeProvider propertyId={sheetPropertyId(respondReview)}>
          <ReviewResponseSheet
            open
            onOpenChange={(open) => {
              if (!open) setRespondReview(null);
            }}
            bookingId={respondReview.bookingId}
            guestName={respondReview.guestName || 'Guest'}
            existingText={respondReview.responseText}
          />
        </ReviewPropertyScopeProvider>
      ) : null}

      {reportReview ? (
        <ReviewPropertyScopeProvider propertyId={sheetPropertyId(reportReview)}>
          <ReportReviewSheet
            open
            onOpenChange={(open) => {
              if (!open) setReportReview(null);
            }}
            reviewKind="guest_review"
            reviewId={reportReview.id}
          />
        </ReviewPropertyScopeProvider>
      ) : null}

      {writeBooking ? (
        <ReviewPropertyScopeProvider propertyId={sheetPropertyId(writeBooking)}>
          <WriteGuestReviewSheet
            bookingId={writeBooking.bookingId}
            guestName={writeBooking.guestName || 'Guest'}
            onClose={() => setWriteBooking(null)}
          />
        </ReviewPropertyScopeProvider>
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
