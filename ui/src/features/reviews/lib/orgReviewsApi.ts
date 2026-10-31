import type {
  PropertyReviewSummary,
  ReceivedReviewItem,
  ReviewListTab,
  ToWriteItem,
  WrittenReviewItem,
} from '@/features/reviews/lib/propertyReviewsApi';

export type OrgPropertyReviewRow = {
  propertyId: string;
  propertySlug: string;
  propertyName: string;
  count: number;
  avgOverall: number | null;
  responseRate: number;
  dueCount: number;
};

export type OrgReviewSummary = PropertyReviewSummary & {
  properties: OrgPropertyReviewRow[];
};

type WithProperty = {
  propertyId: string;
  propertySlug: string;
  propertyName: string;
};

/** `canRespond` is this caller's `reviews.responses:edit` on that listing. */
export type OrgReceivedReviewItem = ReceivedReviewItem & WithProperty & { canRespond: boolean };

export type OrgWrittenReviewItem = WrittenReviewItem & WithProperty;

/** `canWrite` is this caller's `reviews.guests:edit` on that listing. */
export type OrgToWriteItem = ToWriteItem & WithProperty & { canWrite: boolean };

export type OrgReviewListItem = OrgReceivedReviewItem | OrgWrittenReviewItem | OrgToWriteItem;

export type OrgReviewsPage = {
  tab: ReviewListTab;
  summary: OrgReviewSummary;
  items: OrgReviewListItem[];
  total: number;
};

/** Per-listing rollup sorts, applied client-side over the summary rows. */
export type OrgPropertySort =
  'name:asc' | 'rating:desc' | 'rating:asc' | 'reviews:desc' | 'responded:asc' | 'due:desc';

export const ORG_PROPERTY_SORT_OPTIONS: { value: OrgPropertySort; label: string }[] = [
  { value: 'name:asc', label: 'Listing A–Z' },
  { value: 'rating:desc', label: 'Highest rated' },
  { value: 'rating:asc', label: 'Lowest rated' },
  { value: 'reviews:desc', label: 'Most reviews' },
  { value: 'responded:asc', label: 'Least responded' },
  { value: 'due:desc', label: 'Most to write' },
];

export function parseOrgPropertySort(raw: string | null): OrgPropertySort {
  const match = ORG_PROPERTY_SORT_OPTIONS.find((option) => option.value === raw);
  return match?.value ?? 'name:asc';
}

/** Listings with no reviews sort last on rating, not as a 0.0. */
export function sortOrgPropertyRows(
  rows: OrgPropertyReviewRow[],
  sort: OrgPropertySort,
  search: string
): OrgPropertyReviewRow[] {
  const term = search.trim().toLowerCase();
  const filtered = term
    ? rows.filter((row) => row.propertyName.toLowerCase().includes(term))
    : [...rows];

  const byName = (a: OrgPropertyReviewRow, b: OrgPropertyReviewRow) =>
    a.propertyName.localeCompare(b.propertyName);
  const rating = (row: OrgPropertyReviewRow) => (row.count === 0 ? null : row.avgOverall);

  return filtered.sort((a, b) => {
    switch (sort) {
      case 'rating:desc':
      case 'rating:asc': {
        const left = rating(a);
        const right = rating(b);
        if (left == null && right == null) return byName(a, b);
        if (left == null) return 1;
        if (right == null) return -1;
        if (left === right) return byName(a, b);
        return sort === 'rating:asc' ? left - right : right - left;
      }
      case 'reviews:desc':
        return b.count - a.count || byName(a, b);
      case 'responded:asc': {
        if (a.count === 0 && b.count === 0) return byName(a, b);
        if (a.count === 0) return 1;
        if (b.count === 0) return -1;
        return a.responseRate - b.responseRate || byName(a, b);
      }
      case 'due:desc':
        return b.dueCount - a.dueCount || byName(a, b);
      default:
        return byName(a, b);
    }
  });
}
