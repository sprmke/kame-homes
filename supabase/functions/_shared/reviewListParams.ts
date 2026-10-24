/**
 * Query parsing for both Reviews list endpoints (property + org rollup), so the
 * two pages accept exactly the same search / filter / sort / page vocabulary.
 */

import {
  DEFAULT_REVIEW_LIST_PARAMS,
  type ReviewListParams,
  type ReviewListSort,
  type ReviewListTab,
  type ReviewTriState,
} from './propertyReviewList.ts';

const TABS = new Set<ReviewListTab>(['received', 'written', 'to_write']);
const PAGE_SIZES = new Set([31, 50, 100]);
const MAX_LIMIT = 100;

/** Dated tabs sort on their own timestamp; To write sorts on window close. */
export const REVIEW_SORTS_BY_TAB: Record<ReviewListTab, ReviewListSort[]> = {
  received: ['date:desc', 'date:asc', 'rating:desc', 'rating:asc'],
  written: ['date:desc', 'date:asc', 'rating:desc', 'rating:asc'],
  to_write: ['closes:asc', 'closes:desc'],
};

/** null = the caller sent an unknown tab. */
export function parseReviewListTab(raw: string | null): ReviewListTab | null {
  const value = (raw ?? 'received').trim() as ReviewListTab;
  return TABS.has(value) ? value : null;
}

function parseTriState(raw: string | null): ReviewTriState {
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

export function parseReviewListParams(url: URL, tab: ReviewListTab): ReviewListParams {
  const allowedSorts = REVIEW_SORTS_BY_TAB[tab];
  const sortRaw = url.searchParams.get('sort') as ReviewListSort | null;
  const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
  const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '', 10);

  return {
    q: url.searchParams.get('q') ?? '',
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
    limit: PAGE_SIZES.has(limitRaw)
      ? limitRaw
      : Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, MAX_LIMIT)
        : DEFAULT_REVIEW_LIST_PARAMS.limit,
    sort: sortRaw && allowedSorts.includes(sortRaw) ? sortRaw : allowedSorts[0],
    // Filters that have no column on a tab are ignored rather than rejected, so a
    // stale link from another tab still loads.
    ratings: tab === 'to_write' ? [] : parseRatings(url.searchParams.get('ratings')),
    responded: tab === 'received' ? parseTriState(url.searchParams.get('responded')) : 'all',
    hostAgain: tab === 'written' ? parseTriState(url.searchParams.get('hostAgain')) : 'all',
  };
}
