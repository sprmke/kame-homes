import { useMemo, useState } from 'react';

import { Link, useParams, useSearchParams } from 'react-router-dom';

import { ChevronDown } from 'lucide-react';

import { useOrganizations } from '@/features/dashboard/org/hooks/useOrganizations';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';

import { RatingStars } from '@/features/reviews/components/RatingStars';
import { RatingSummary } from '@/features/reviews/components/RatingSummary';
import { ReviewResponseBlock } from '@/features/reviews/components/ReviewResponseBlock';
import { ReviewsLoadError } from '@/features/reviews/components/ReviewsLoadError';
import { useOrgReviews } from '@/features/reviews/hooks/useOrgReviews';
import type {
  OrgPropertyReviewRow,
  OrgReceivedReviewItem,
} from '@/features/reviews/lib/orgReviewsApi';

import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { MobileChoiceItem, MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import { ListRowsSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { orgPageTitle, usePageTitle } from '@/lib/pageTitle';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatAvg(value: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return '–';
  return Number(value).toFixed(1);
}

export function OrgReviewsPage() {
  const { orgSlug = '' } = useParams<{ orgSlug: string }>();
  const { data: orgsData } = useOrganizations();
  const org = orgsData?.organizations.find((entry) => entry.slug === orgSlug);
  const [searchParams, setSearchParams] = useSearchParams();
  const propertyFilter = UUID_RE.test(searchParams.get('property') ?? '')
    ? (searchParams.get('property') as string)
    : null;
  const [filterOpen, setFilterOpen] = useState(false);
  const query = useOrgReviews(propertyFilter);

  usePageTitle(org?.name ? orgPageTitle(org.name, 'Reviews') : undefined);

  const summary = query.data?.pages[0]?.summary;
  const properties = summary?.properties ?? [];
  const items = useMemo(
    () => (query.data?.pages ?? []).flatMap((page) => page.items),
    [query.data?.pages]
  );
  const selectedProperty = properties.find((row) => row.propertyId === propertyFilter);
  const filterLabel = selectedProperty?.propertyName ?? 'All properties';

  const setPropertyFilter = (next: string | null) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next) params.set('property', next);
        else params.delete('property');
        return params;
      },
      { replace: true }
    );
    setFilterOpen(false);
  };

  return (
    <AdminMobilePage title="Reviews">
      <div className="space-y-4">
        <RatingSummary summary={summary} loading={query.isLoading} />

        {properties.length > 0 ? <PropertyReviewTable orgSlug={orgSlug} rows={properties} /> : null}

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Received</h2>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] max-w-[60%] shrink-0"
            onClick={() => setFilterOpen(true)}
          >
            <span className="truncate">{filterLabel}</span>
            <ChevronDown className="ml-1 size-4 shrink-0" aria-hidden />
          </Button>
        </div>

        {query.isLoading ? (
          <ListRowsSkeleton rows={5} label="Loading reviews" />
        ) : query.isError ? (
          <ReviewsLoadError onRetry={() => void query.refetch()} />
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No published guest reviews yet.</p>
        ) : (
          <div className="space-y-3">
            {items.map((review) => (
              <OrgReceivedCard key={review.id} review={review} orgSlug={orgSlug} />
            ))}
          </div>
        )}

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

      <MobileChoiceSheet open={filterOpen} onOpenChange={setFilterOpen} title="Property">
        <MobileChoiceItem
          label="All properties"
          selected={!propertyFilter}
          onSelect={() => setPropertyFilter(null)}
        />
        {properties.map((row) => (
          <MobileChoiceItem
            key={row.propertyId}
            label={row.propertyName}
            selected={propertyFilter === row.propertyId}
            onSelect={() => setPropertyFilter(row.propertyId)}
          />
        ))}
      </MobileChoiceSheet>
    </AdminMobilePage>
  );
}

function PropertyReviewTable({ orgSlug, rows }: { orgSlug: string; rows: OrgPropertyReviewRow[] }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium">Properties</h2>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="py-2 pr-3 font-medium">Property</th>
              <th className="py-2 pr-3 font-medium">Avg</th>
              <th className="py-2 pr-3 font-medium">Reviews</th>
              <th className="py-2 pr-3 font-medium">Response</th>
              <th className="py-2 font-medium">To write</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.propertyId} className="border-border border-b">
                <td className="py-2.5 pr-3">
                  <Link
                    className="text-foreground font-medium underline-offset-2 hover:underline"
                    to={propertySectionPath(orgSlug, row.propertySlug, 'reviews')}
                  >
                    {row.propertyName}
                  </Link>
                </td>
                <td className="py-2.5 pr-3">{formatAvg(row.avgOverall)}</td>
                <td className="py-2.5 pr-3">{row.count}</td>
                <td className="py-2.5 pr-3">{formatPct(row.responseRate)}</td>
                <td className="py-2.5">{row.dueCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 lg:hidden">
        {rows.map((row) => (
          <li key={row.propertyId}>
            <Link
              to={propertySectionPath(orgSlug, row.propertySlug, 'reviews')}
              className="border-border bg-card flex min-h-[44px] items-center justify-between gap-3 rounded-xl border px-4 py-3"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{row.propertyName}</span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  {formatAvg(row.avgOverall)} · {row.count} · {row.dueCount} to write
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OrgReceivedCard({ review, orgSlug }: { review: OrgReceivedReviewItem; orgSlug: string }) {
  const guestName = review.guestName || 'Guest';
  return (
    <article className="border-border bg-card rounded-xl border p-4">
      <p className="font-medium">{guestName}</p>
      <p className="text-muted-foreground mt-0.5 text-xs">{review.propertyName}</p>
      <div className="mt-1 flex items-center gap-2">
        <RatingStars value={review.starRating} />
        <span className="text-muted-foreground text-xs">{review.starRating}/5</span>
      </div>
      {review.reviewText ? <p className="mt-2 text-sm">{review.reviewText}</p> : null}
      {review.responseText ? (
        <div className="mt-2">
          <ReviewResponseBlock responseText={review.responseText} label="Response" />
        </div>
      ) : null}
      {review.propertySlug ? (
        <Button type="button" variant="outline" className="mt-3 min-h-[44px]" asChild>
          <Link to={propertySectionPath(orgSlug, review.propertySlug, 'reviews')}>
            Open property
          </Link>
        </Button>
      ) : null}
    </article>
  );
}
