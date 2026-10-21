/**
 * Host Reviews page listings (received / written / to write) + summary KPIs.
 */

import { createServiceClient } from './orgAuth.ts';
import { decodeReviewCursor, encodeReviewCursor } from './reviewCursor.ts';

const PAGE_SIZE = 20;

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

export async function listReceivedReviews(
  propertyId: string,
  cursor: string | null
): Promise<{ items: ReceivedReviewItem[]; nextCursor: string | null }> {
  const supabase = createServiceClient();
  let query = supabase
    .from('guest_reviews')
    .select(
      'id, booking_id, guest_display_name, star_rating, review_text, private_note, category_ratings, feedback_tags, media_urls, response_text, published_at, guest_submissions(primary_guest_name, guest_facebook_name, check_in_date, check_out_date)'
    )
    .eq('property_id', propertyId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (cursor) query = query.lt('published_at', cursor);

  const { data, error } = await query;
  if (error) {
    console.warn('[propertyReviewList] received failed:', error.message);
    return { items: [], nextCursor: null };
  }
  const rows = data ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  return {
    items: page.map((row) => {
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
    nextCursor: hasMore ? String(page[page.length - 1]?.published_at ?? '') || null : null,
  };
}

export async function listWrittenReviews(
  propertyId: string,
  cursor: string | null
): Promise<{ items: WrittenReviewItem[]; nextCursor: string | null }> {
  const supabase = createServiceClient();
  let query = supabase
    .from('host_guest_reviews')
    .select(
      'id, booking_id, overall_rating, review_text, status, would_host_again, response_text, submitted_at, guest_submissions(primary_guest_name, guest_facebook_name), booking_review_windows(closes_at)'
    )
    .eq('property_id', propertyId)
    .neq('status', 'removed')
    .order('submitted_at', { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (cursor) query = query.lt('submitted_at', cursor);

  const { data, error } = await query;
  if (error) {
    console.warn('[propertyReviewList] written failed:', error.message);
    return { items: [], nextCursor: null };
  }
  const rows = data ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  return {
    items: page.map((row) => {
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
    nextCursor: hasMore ? String(page[page.length - 1]?.submitted_at ?? '') || null : null,
  };
}

export async function listToWriteReviews(
  propertyId: string,
  cursor: string | null
): Promise<{ items: ToWriteItem[]; nextCursor: string | null }> {
  const supabase = createServiceClient();
  const after = decodeReviewCursor(cursor);
  const { data, error } = await supabase.rpc('host_reviews_to_write', {
    p_property_id: propertyId,
    p_after_closes_at: after?.at ?? null,
    p_after_booking_id: after?.id ?? null,
    p_limit: PAGE_SIZE + 1,
  });
  if (error) {
    console.warn('[propertyReviewList] to_write failed:', error.message);
    return { items: [], nextCursor: null };
  }
  const rows = (data ?? []) as Array<{ booking_id: string; closes_at: string }>;
  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  const stays = new Map<string, ReturnType<typeof unwrapStay>>();
  if (page.length > 0) {
    const { data: bookings } = await supabase
      .from('guest_submissions')
      .select('id, primary_guest_name, guest_facebook_name, check_in_date, check_out_date')
      .in(
        'id',
        page.map((row) => row.booking_id)
      )
      .limit(page.length);
    for (const booking of bookings ?? []) stays.set(booking.id as string, unwrapStay(booking));
  }

  const last = page[page.length - 1];
  return {
    items: page.map((row) => {
      const stay = stays.get(row.booking_id) ?? null;
      return {
        bookingId: row.booking_id,
        guestName: stay?.primary_guest_name || stay?.guest_facebook_name || null,
        closesAt: String(row.closes_at),
        checkInDate: stay?.check_in_date ?? null,
        checkOutDate: stay?.check_out_date ?? null,
      };
    }),
    nextCursor: hasMore && last ? encodeReviewCursor(last.closes_at, last.booking_id) : null,
  };
}

function unwrapStay(raw: unknown): {
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
