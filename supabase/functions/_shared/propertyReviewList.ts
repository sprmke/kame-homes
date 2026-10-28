/**
 * Host Reviews page listings (received / written / to write) + summary KPIs.
 */

import { createServiceClient } from './orgAuth.ts';

/** Open windows (not expired, not published) with no host review yet, per property. */
export async function getHostReviewDueCounts(propertyIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (propertyIds.length === 0) return counts;
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('host_review_due_counts', {
    p_property_ids: propertyIds,
  });
  if (error) {
    console.warn('[propertyReviewList] due counts failed:', error.message);
    return counts;
  }
  for (const row of (data ?? []) as Array<{ property_id: string; due_count: number }>) {
    counts.set(row.property_id, Number(row.due_count) || 0);
  }
  return counts;
}

export type ReviewListTab = 'received' | 'written' | 'to_write';

export type PropertyReviewSummary = {
  count: number;
  avgOverall: number | null;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
  categoryAvgs: Record<string, number | null>;
  categorySample: number;
  responseRate: number;
  dueCount: number;
};

export async function getPropertyReviewSummary(propertyId: string): Promise<PropertyReviewSummary> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('property_review_summary', {
    p_property_id: propertyId,
  });
  if (error) {
    console.warn('[propertyReviewList] summary failed:', error.message);
  }
  const summary = (data as PropertyReviewSummary | null) ?? {
    count: 0,
    avgOverall: null,
    distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    categoryAvgs: {},
    categorySample: 0,
    responseRate: 0,
    dueCount: 0,
  };

  const due = await getHostReviewDueCounts([propertyId]);
  summary.dueCount = due.get(propertyId) ?? 0;
  return summary;
}

export type ReceivedReviewItem = {
  id: string;
  bookingId: string;
  guestName: string | null;
  starRating: number;
  reviewText: string | null;
  privateNote: string | null;
  categoryRatings: Record<string, number>;
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

export type ReviewListSort =
  'date:desc' | 'date:asc' | 'rating:desc' | 'rating:asc' | 'closes:asc' | 'closes:desc';

export type ReviewTriState = 'all' | 'yes' | 'no';

/** Search / filter / sort / page state for one Reviews tab. */
export type ReviewListParams = {
  q: string;
  page: number;
  limit: number;
  sort: ReviewListSort;
  /** Empty = every star rating. */
  ratings: number[];
  responded: ReviewTriState;
  hostAgain: ReviewTriState;
};

export const DEFAULT_REVIEW_LIST_PARAMS: ReviewListParams = {
  q: '',
  page: 1,
  limit: 31,
  sort: 'date:desc',
  ratings: [],
  responded: 'all',
  hostAgain: 'all',
};

/** `,` `(` `)` terminate a PostgREST `or()` clause, so they never reach one. */
export function sanitizeSearch(raw: string): string {
  return raw.replace(/[,()]/g, ' ').trim().slice(0, 80);
}

/** Guest names live on the stay, not the review, so name search prefilters bookings. */
const NAME_MATCH_CAP = 500;

export async function searchBookingIdsByGuestName(
  propertyIds: string[],
  term: string
): Promise<string[]> {
  if (propertyIds.length === 0) return [];
  const supabase = createServiceClient();
  const pattern = `%${term}%`;
  const { data, error } = await supabase
    .from('guest_submissions')
    .select('id')
    .in('property_id', propertyIds)
    .or(`primary_guest_name.ilike.${pattern},guest_facebook_name.ilike.${pattern}`)
    .limit(NAME_MATCH_CAP);
  if (error) {
    console.warn('[propertyReviewList] name search failed:', error.message);
    return [];
  }
  return (data ?? []).map((row) => row.id as string);
}

export function pageRange(params: ReviewListParams): { from: number; to: number } {
  const from = Math.max(0, (params.page - 1) * params.limit);
  return { from, to: from + params.limit - 1 };
}

export async function listReceivedReviews(
  propertyId: string,
  params: ReviewListParams
): Promise<{ items: ReceivedReviewItem[]; total: number }> {
  const supabase = createServiceClient();
  const term = sanitizeSearch(params.q);
  const nameBookingIds = term ? await searchBookingIdsByGuestName([propertyId], term) : [];

  let query = supabase
    .from('guest_reviews')
    .select(
      'id, booking_id, guest_display_name, star_rating, review_text, private_note, category_ratings, feedback_tags, media_urls, response_text, published_at, guest_submissions(primary_guest_name, guest_facebook_name, check_in_date, check_out_date)',
      { count: 'exact' }
    )
    .eq('property_id', propertyId)
    .eq('status', 'published');

  if (params.ratings.length > 0) query = query.in('star_rating', params.ratings);
  if (params.responded === 'yes') query = query.not('response_text', 'is', null);
  else if (params.responded === 'no') query = query.is('response_text', null);
  if (term) {
    const clauses = [`review_text.ilike.%${term}%`, `guest_display_name.ilike.%${term}%`];
    if (nameBookingIds.length > 0) clauses.push(`booking_id.in.(${nameBookingIds.join(',')})`);
    query = query.or(clauses.join(','));
  }

  const ordered =
    params.sort === 'rating:asc' || params.sort === 'rating:desc'
      ? query
          .order('star_rating', { ascending: params.sort === 'rating:asc' })
          .order('published_at', { ascending: false })
      : query.order('published_at', { ascending: params.sort === 'date:asc' });

  const { from, to } = pageRange(params);
  const { data, error, count } = await ordered.range(from, to);
  if (error) {
    console.warn('[propertyReviewList] received failed:', error.message);
    return { items: [], total: 0 };
  }

  return {
    items: (data ?? []).map((row) => {
      const stay = unwrapStay(row.guest_submissions);
      return {
        id: row.id as string,
        bookingId: row.booking_id as string,
        guestName:
          (row.guest_display_name as string | null) ||
          stay?.primary_guest_name ||
          stay?.guest_facebook_name ||
          null,
        starRating: Number(row.star_rating) || 0,
        reviewText: (row.review_text as string | null) ?? null,
        privateNote: (row.private_note as string | null) ?? null,
        categoryRatings: (row.category_ratings as Record<string, number>) ?? {},
        feedbackTags: Array.isArray(row.feedback_tags) ? (row.feedback_tags as string[]) : [],
        mediaUrls: row.media_urls,
        responseText: (row.response_text as string | null) ?? null,
        publishedAt: (row.published_at as string | null) ?? null,
        checkInDate: stay?.check_in_date ?? null,
        checkOutDate: stay?.check_out_date ?? null,
      };
    }),
    total: count ?? 0,
  };
}

export async function listWrittenReviews(
  propertyId: string,
  params: ReviewListParams
): Promise<{ items: WrittenReviewItem[]; total: number }> {
  const supabase = createServiceClient();
  const term = sanitizeSearch(params.q);
  const nameBookingIds = term ? await searchBookingIdsByGuestName([propertyId], term) : [];

  let query = supabase
    .from('host_guest_reviews')
    .select(
      'id, booking_id, overall_rating, review_text, status, would_host_again, response_text, submitted_at, guest_submissions(primary_guest_name, guest_facebook_name), booking_review_windows(closes_at)',
      { count: 'exact' }
    )
    .eq('property_id', propertyId)
    .neq('status', 'removed');

  if (params.ratings.length > 0) query = query.in('overall_rating', params.ratings);
  if (params.hostAgain !== 'all') query = query.eq('would_host_again', params.hostAgain === 'yes');
  if (term) {
    const clauses = [`review_text.ilike.%${term}%`];
    if (nameBookingIds.length > 0) clauses.push(`booking_id.in.(${nameBookingIds.join(',')})`);
    query = query.or(clauses.join(','));
  }

  const ordered =
    params.sort === 'rating:asc' || params.sort === 'rating:desc'
      ? query
          .order('overall_rating', { ascending: params.sort === 'rating:asc' })
          .order('submitted_at', { ascending: false })
      : query.order('submitted_at', { ascending: params.sort === 'date:asc' });

  const { from, to } = pageRange(params);
  const { data, error, count } = await ordered.range(from, to);
  if (error) {
    console.warn('[propertyReviewList] written failed:', error.message);
    return { items: [], total: 0 };
  }

  return {
    items: (data ?? []).map((row) => {
      const stay = unwrapStay(row.guest_submissions);
      const windowRaw = row.booking_review_windows as
        { closes_at?: string | null } | { closes_at?: string | null }[] | null;
      const window = Array.isArray(windowRaw) ? windowRaw[0] : windowRaw;
      return {
        id: row.id as string,
        bookingId: row.booking_id as string,
        guestName: stay?.primary_guest_name || stay?.guest_facebook_name || null,
        overallRating: Number(row.overall_rating) || 0,
        reviewText: (row.review_text as string | null) ?? null,
        status: String(row.status),
        wouldHostAgain: Boolean(row.would_host_again),
        responseText: (row.response_text as string | null) ?? null,
        closesAt: window?.closes_at ?? null,
        submittedAt: String(row.submitted_at),
      };
    }),
    total: count ?? 0,
  };
}

/**
 * Open windows are bounded by the 14-day review window, so the whole set is
 * scanned once (RPC has no filter/sort args) and then searched, sorted and paged
 * in memory. `TO_WRITE_SCAN_CAP` is the ceiling on that scan.
 */
const TO_WRITE_SCAN_CAP = 200;
const STAY_LOOKUP_CHUNK = 50;

export async function listToWriteReviews(
  propertyId: string,
  params: ReviewListParams
): Promise<{ items: ToWriteItem[]; total: number }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('host_reviews_to_write', {
    p_property_id: propertyId,
    p_after_closes_at: null,
    p_after_booking_id: null,
    p_limit: TO_WRITE_SCAN_CAP,
  });
  if (error) {
    console.warn('[propertyReviewList] to_write failed:', error.message);
    return { items: [], total: 0 };
  }
  const rows = (data ?? []) as Array<{ booking_id: string; closes_at: string }>;
  if (rows.length === 0) return { items: [], total: 0 };

  const stays = new Map<string, ReturnType<typeof unwrapStay>>();
  for (let i = 0; i < rows.length; i += STAY_LOOKUP_CHUNK) {
    const ids = rows.slice(i, i + STAY_LOOKUP_CHUNK).map((row) => row.booking_id);
    const { data: bookings } = await supabase
      .from('guest_submissions')
      .select('id, primary_guest_name, guest_facebook_name, check_in_date, check_out_date')
      .in('id', ids)
      .limit(ids.length);
    for (const booking of bookings ?? []) stays.set(booking.id as string, unwrapStay(booking));
  }

  let items: ToWriteItem[] = rows.map((row) => {
    const stay = stays.get(row.booking_id) ?? null;
    return {
      bookingId: row.booking_id,
      guestName: stay?.primary_guest_name || stay?.guest_facebook_name || null,
      closesAt: String(row.closes_at),
      checkInDate: stay?.check_in_date ?? null,
      checkOutDate: stay?.check_out_date ?? null,
    };
  });

  const term = sanitizeSearch(params.q).toLowerCase();
  if (term) {
    items = items.filter((item) => (item.guestName ?? '').toLowerCase().includes(term));
  }

  items.sort((a, b) => {
    const diff = Date.parse(a.closesAt) - Date.parse(b.closesAt);
    const ordered = params.sort === 'closes:desc' ? -diff : diff;
    return ordered !== 0 ? ordered : a.bookingId.localeCompare(b.bookingId);
  });

  const { from, to } = pageRange(params);
  return { items: items.slice(from, to + 1), total: items.length };
}

export function unwrapStay(raw: unknown): {
  primary_guest_name?: string | null;
  guest_facebook_name?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
} | null {
  if (!raw) return null;
  return (Array.isArray(raw) ? raw[0] : raw) as {
    primary_guest_name?: string | null;
    guest_facebook_name?: string | null;
    check_in_date?: string | null;
    check_out_date?: string | null;
  };
}
