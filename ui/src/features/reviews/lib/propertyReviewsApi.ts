import type { CategoryRatings } from '@/features/reviews/lib/reviewCatalog';

import { ADMIN_DEFAULT_PAGE_SIZE, normalizeAdminPageLimit } from '@/lib/table/pagination';

export type ReviewListTab = 'received' | 'written' | 'to_write';

/** Table or card only — reviews have no calendar view. */
export type ReviewsView = 'table' | 'card';

export type ReviewsSort =
  'date:desc' | 'date:asc' | 'rating:desc' | 'rating:asc' | 'closes:asc' | 'closes:desc';

export type ReviewsTriState = 'all' | 'yes' | 'no';

export type ReviewsQuery = {
  q: string;
  page: number;
  limit: number;
  view: ReviewsView;
  sort: ReviewsSort;
  /** Empty = every star rating. */
  ratings: number[];
  responded: ReviewsTriState;
  hostAgain: ReviewsTriState;
  /** Org rollup only — property ids to narrow the feed to. Empty = every listing. */
  properties: string[];
};

/** Each tab sorts on a different column, so the default follows the tab. */
export const REVIEWS_SORTS_BY_TAB: Record<ReviewListTab, ReviewsSort[]> = {
  received: ['date:desc', 'date:asc', 'rating:desc', 'rating:asc'],
  written: ['date:desc', 'date:asc', 'rating:desc', 'rating:asc'],
  to_write: ['closes:asc', 'closes:desc'],
};

export const REVIEWS_SORT_LABELS: Record<ReviewListTab, Record<string, string>> = {
  received: {
    'date:desc': 'Newest first',
    'date:asc': 'Oldest first',
    'rating:desc': 'Highest rated',
    'rating:asc': 'Lowest rated',
  },
  written: {
    'date:desc': 'Newest first',
    'date:asc': 'Oldest first',
    'rating:desc': 'Highest rated',
    'rating:asc': 'Lowest rated',
  },
  to_write: {
    'closes:asc': 'Closing soonest',
    'closes:desc': 'Closing last',
  },
};

export function defaultReviewsSort(tab: ReviewListTab): ReviewsSort {
  return REVIEWS_SORTS_BY_TAB[tab][0];
}

export function defaultReviewsQuery(tab: ReviewListTab): ReviewsQuery {
  return {
    q: '',
    page: 1,
    limit: ADMIN_DEFAULT_PAGE_SIZE,
    view: 'table',
    sort: defaultReviewsSort(tab),
    ratings: [],
    responded: 'all',
    hostAgain: 'all',
    properties: [],
  };
}

/** The org rollup adds a listings tab that has no review feed of its own. */
export type ReviewsPageTab = ReviewListTab | 'properties';

export function parseReviewsTab(value: string | null): ReviewListTab {
  if (value === 'written' || value === 'to_write' || value === 'received') return value;
  return 'received';
}

export function parseReviewsPageTab(
  value: string | null,
  allowProperties: boolean
): ReviewsPageTab {
  if (allowProperties && value === 'properties') return 'properties';
  return parseReviewsTab(value);
}

/** `properties` carries no review feed, so its API calls ride on the default tab. */
export function reviewsApiTab(tab: ReviewsPageTab): ReviewListTab {
  return tab === 'properties' ? 'received' : tab;
}

function parseTriState(raw: string | null): ReviewsTriState {
  return raw === 'yes' || raw === 'no' ? raw : 'all';
}

function parseRatings(raw: string | null): number[] {
  if (!raw) return [];
  const seen = new Set<number>();
  for (const part of raw.split(',')) {
    const value = Number.parseInt(part.trim(), 10);
    if (value >= 1 && value <= 5) seen.add(value);
  }
  return [...seen].sort((a, b) => a - b);
}

export function parseReviewsQueryFromParams(
  params: URLSearchParams,
  tab: ReviewListTab
): ReviewsQuery {
  const sortRaw = params.get('sort') as ReviewsSort | null;
  const pageRaw = Number.parseInt(params.get('page') ?? '1', 10);

  return {
    q: params.get('q') ?? '',
    page: Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1,
    limit: normalizeAdminPageLimit(
      Number.parseInt(params.get('limit') ?? String(ADMIN_DEFAULT_PAGE_SIZE), 10)
    ),
    view: params.get('view') === 'card' ? 'card' : 'table',
    sort:
      sortRaw && REVIEWS_SORTS_BY_TAB[tab].includes(sortRaw) ? sortRaw : defaultReviewsSort(tab),
    ratings: tab === 'to_write' ? [] : parseRatings(params.get('ratings')),
    responded: tab === 'received' ? parseTriState(params.get('responded')) : 'all',
    hostAgain: tab === 'written' ? parseTriState(params.get('hostAgain')) : 'all',
    properties: (params.get('properties') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

/** Writes tab + list state back to the URL; defaults stay out of the query string. */
export function writeReviewsQueryToParams(
  tab: ReviewListTab,
  query: ReviewsQuery
): URLSearchParams {
  const params = new URLSearchParams();
  if (tab !== 'received') params.set('tab', tab);
  if (query.q.trim()) params.set('q', query.q.trim());
  if (query.page > 1) params.set('page', String(query.page));
  if (query.limit !== ADMIN_DEFAULT_PAGE_SIZE) params.set('limit', String(query.limit));
  if (query.view !== 'table') params.set('view', query.view);
  if (query.sort !== defaultReviewsSort(tab)) params.set('sort', query.sort);
  if (query.ratings.length > 0) params.set('ratings', query.ratings.join(','));
  if (query.responded !== 'all') params.set('responded', query.responded);
  if (query.hostAgain !== 'all') params.set('hostAgain', query.hostAgain);
  if (query.properties.length > 0) params.set('properties', query.properties.join(','));
  return params;
}

export function reviewsQueryToApiParams(tab: ReviewListTab, query: ReviewsQuery): URLSearchParams {
  const params = new URLSearchParams({
    tab,
    page: String(query.page),
    limit: String(query.limit),
    sort: query.sort,
  });
  if (query.q.trim()) params.set('q', query.q.trim());
  if (query.ratings.length > 0) params.set('ratings', query.ratings.join(','));
  if (query.responded !== 'all') params.set('responded', query.responded);
  if (query.hostAgain !== 'all') params.set('hostAgain', query.hostAgain);
  if (query.properties.length > 0) params.set('properties', query.properties.join(','));
  return params;
}

/** Count of narrowing controls in play — drives the Filters badge. */
export function activeReviewsFilterCount(tab: ReviewListTab, query: ReviewsQuery): number {
  let count = query.ratings.length;
  if (tab === 'received' && query.responded !== 'all') count += 1;
  if (tab === 'written' && query.hostAgain !== 'all') count += 1;
  return count;
}

/** Average with no reviews behind it is a dash, not 0.0. */
export function formatReviewAverage(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '–';
  return Number(value).toFixed(1);
}

export type PropertyReviewSummary = {
  count: number;
  avgOverall: number | null;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
  categoryAvgs: Record<string, number | null>;
  categorySample: number;
  responseRate: number;
  dueCount: number;
};

export type ReceivedReviewItem = {
  id: string;
  bookingId: string;
  guestName: string | null;
  starRating: number;
  reviewText: string | null;
  privateNote: string | null;
  categoryRatings: CategoryRatings;
  feedbackTags: string[];
  mediaUrls: unknown;
  responseText: string | null;
  publishedAt: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
};

export type WrittenReviewItem = {
  id: string;
  bookingId: string;
  guestName: string | null;
  overallRating: number;
  reviewText: string | null;
  status: string;
  wouldHostAgain: boolean;
  responseText: string | null;
  closesAt: string | null;
  submittedAt: string;
};

export type ToWriteItem = {
  bookingId: string;
  guestName: string | null;
  closesAt: string;
  checkInDate: string | null;
  checkOutDate: string | null;
};

export type ReviewListItem = ReceivedReviewItem | WrittenReviewItem | ToWriteItem;

export type PropertyReviewsPage = {
  tab: ReviewListTab;
  summary: PropertyReviewSummary;
  items: ReviewListItem[];
  total: number;
};
