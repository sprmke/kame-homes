/**
 * Org Reviews rollup: KPIs, per-property table, published received feed.
 * Unpublished counterpart content is never returned. Every query is limited to
 * the caller's visible properties (all org properties, or the org member's
 * assigned listings).
 */

import { createServiceClient } from './orgAuth.ts';
import {
  getHostReviewDueCounts,
  pageRange,
  sanitizeSearch,
  searchBookingIdsByGuestName,
  unwrapStay,
  type ReviewListParams,
  type PropertyReviewSummary,
  type ReceivedReviewItem,
  type ToWriteItem,
  type WrittenReviewItem,
} from './propertyReviewList.ts';

/** Matches the org property list cap used by other org rollups. */
const MAX_ORG_PROPERTIES = 200;

export type OrgReviewScope = {
  organizationId: string;
  /** null = every property in the org; otherwise the member's assigned property ids. */
  assignedPropertyIds: string[] | null;
};

type ScopedProperty = { id: string; slug: string; name: string };

/** Properties the caller may see, alphabetical. Assigned ids outside the org are dropped. */
export async function listOrgReviewScopeProperties(
  scope: OrgReviewScope
): Promise<ScopedProperty[]> {
  if (scope.assignedPropertyIds && scope.assignedPropertyIds.length === 0) return [];
  const supabase = createServiceClient();
  let query = supabase
    .from('properties')
    .select('id, slug, name')
    .eq('organization_id', scope.organizationId)
    .order('name')
    .limit(MAX_ORG_PROPERTIES);
  if (scope.assignedPropertyIds) query = query.in('id', scope.assignedPropertyIds);
  const { data, error } = await query;
  if (error) {
    console.warn('[orgReviewList] properties failed:', error.message);
    return [];
  }
  return (data ?? []) as ScopedProperty[];
}

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

export type OrgReceivedReviewItem = ReceivedReviewItem & {
  propertyId: string;
  propertySlug: string;
  propertyName: string;
  /** This caller may respond to and report reviews on that listing. */
  canRespond: boolean;
};

const EMPTY_SUMMARY: PropertyReviewSummary = {
  count: 0,
  avgOverall: null,
  distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
  categoryAvgs: {},
  categorySample: 0,
  responseRate: 0,
  dueCount: 0,
};

export async function getOrgReviewSummary(properties: ScopedProperty[]): Promise<OrgReviewSummary> {
  if (properties.length === 0) return { ...EMPTY_SUMMARY, properties: [] };
  const supabase = createServiceClient();
  const propertyIds = properties.map((property) => property.id);
  const [{ data: headlineRaw, error: headlineErr }, { data: statsRaw, error: statsErr }, due] =
    await Promise.all([
      supabase.rpc('review_summary_for_properties', { p_property_ids: propertyIds }),
      supabase.rpc('review_stats_by_property', { p_property_ids: propertyIds }),
      getHostReviewDueCounts(propertyIds),
    ]);
  if (headlineErr) console.warn('[orgReviewList] summary failed:', headlineErr.message);
  if (statsErr) console.warn('[orgReviewList] per-property stats failed:', statsErr.message);

  const headline = {
    ...EMPTY_SUMMARY,
    ...((headlineRaw as PropertyReviewSummary | null) ?? {}),
  };
  headline.dueCount = [...due.values()].reduce((sum, n) => sum + n, 0);

  const statsByProperty = new Map(
    (
      (statsRaw ?? []) as Array<{
        property_id: string;
        review_count: number;
        avg_overall: number | null;
        response_rate: number | null;
      }>
    ).map((row) => [row.property_id, row])
  );

  return {
    ...headline,
    properties: properties.map((property) => {
      const stats = statsByProperty.get(property.id);
      return {
        propertyId: property.id,
        propertySlug: property.slug,
        propertyName: property.name,
        count: Number(stats?.review_count ?? 0),
        avgOverall: stats?.avg_overall != null ? Number(stats.avg_overall) : null,
        responseRate: Number(stats?.response_rate ?? 0),
        dueCount: due.get(property.id) ?? 0,
      } satisfies OrgPropertyReviewRow;
    }),
  };
}

export type OrgToWriteItem = ToWriteItem & {
  propertyId: string;
  propertySlug: string;
  propertyName: string;
  /** This caller may write the guest review on that listing. */
  canWrite: boolean;
};

export type OrgWrittenReviewItem = WrittenReviewItem & {
  propertyId: string;
  propertySlug: string;
  propertyName: string;
};

/** Per-listing review permissions for the caller, used to show or hide row actions. */
export type OrgReviewActionScope = {
  /** `reviews.responses:edit` — respond to and report a guest review. */
  respond: Set<string>;
  /** `reviews.guests:edit` — write the review about a guest. */
  writeGuest: Set<string>;
};

type PropertyLabel = { slug: string; name: string };

function labelMap(properties: ScopedProperty[]): Map<string, PropertyLabel> {
  return new Map(properties.map((p) => [p.id, { slug: p.slug, name: p.name }]));
}

export async function listOrgReceivedReviews(
  organizationId: string,
  properties: ScopedProperty[],
  params: ReviewListParams,
  actions: OrgReviewActionScope
): Promise<{ items: OrgReceivedReviewItem[]; total: number }> {
  const visibleIds = properties.map((property) => property.id);
  if (visibleIds.length === 0) return { items: [], total: 0 };
  const supabase = createServiceClient();
  const labels = labelMap(properties);
  const term = sanitizeSearch(params.q);
  const nameBookingIds = term ? await searchBookingIdsByGuestName(visibleIds, term) : [];

  let query = supabase
    .from('guest_reviews')
    .select(
      'id, booking_id, property_id, guest_display_name, star_rating, review_text, private_note, category_ratings, feedback_tags, media_urls, response_text, published_at, guest_submissions(primary_guest_name, guest_facebook_name, check_in_date, check_out_date), properties(slug, name)',
      { count: 'exact' }
    )
    .eq('organization_id', organizationId)
    .in('property_id', visibleIds)
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
    console.warn('[orgReviewList] received failed:', error.message);
    return { items: [], total: 0 };
  }

  return {
    items: (data ?? []).map((row) => {
      const stay = unwrapStay(row.guest_submissions);
      const propertyId = row.property_id as string;
      const label = labels.get(propertyId) ?? unwrapProperty(row.properties);
      return {
        id: row.id as string,
        bookingId: row.booking_id as string,
        propertyId,
        propertySlug: label?.slug ?? '',
        propertyName: label?.name ?? 'Property',
        canRespond: actions.respond.has(propertyId),
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

export async function listOrgWrittenReviews(
  properties: ScopedProperty[],
  params: ReviewListParams
): Promise<{ items: OrgWrittenReviewItem[]; total: number }> {
  const visibleIds = properties.map((property) => property.id);
  if (visibleIds.length === 0) return { items: [], total: 0 };
  const supabase = createServiceClient();
  const labels = labelMap(properties);
  const term = sanitizeSearch(params.q);
  const nameBookingIds = term ? await searchBookingIdsByGuestName(visibleIds, term) : [];

  let query = supabase
    .from('host_guest_reviews')
    .select(
      'id, booking_id, property_id, overall_rating, review_text, status, would_host_again, response_text, submitted_at, guest_submissions(primary_guest_name, guest_facebook_name), booking_review_windows(closes_at)',
      { count: 'exact' }
    )
    .in('property_id', visibleIds)
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
    console.warn('[orgReviewList] written failed:', error.message);
    return { items: [], total: 0 };
  }

  return {
    items: (data ?? []).map((row) => {
      const stay = unwrapStay(row.guest_submissions);
      const propertyId = row.property_id as string;
      const label = labels.get(propertyId);
      const windowRaw = row.booking_review_windows as
        { closes_at?: string | null } | { closes_at?: string | null }[] | null;
      const window = Array.isArray(windowRaw) ? windowRaw[0] : windowRaw;
      return {
        id: row.id as string,
        bookingId: row.booking_id as string,
        propertyId,
        propertySlug: label?.slug ?? '',
        propertyName: label?.name ?? 'Property',
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
 * Open windows across every visible listing. Same shape as the per-property
 * tab: the RPC has no filter or sort arguments, so the scan is capped and the
 * search, sort and page are applied here.
 */
const TO_WRITE_SCAN_CAP = 500;
const STAY_LOOKUP_CHUNK = 50;

export async function listOrgToWriteReviews(
  properties: ScopedProperty[],
  params: ReviewListParams,
  actions: OrgReviewActionScope
): Promise<{ items: OrgToWriteItem[]; total: number }> {
  const visibleIds = properties.map((property) => property.id);
  if (visibleIds.length === 0) return { items: [], total: 0 };
  const supabase = createServiceClient();
  const labels = labelMap(properties);

  const { data, error } = await supabase.rpc('host_reviews_to_write_for_properties', {
    p_property_ids: visibleIds,
    p_limit: TO_WRITE_SCAN_CAP,
  });
  if (error) {
    console.warn('[orgReviewList] to_write failed:', error.message);
    return { items: [], total: 0 };
  }
  const rows = (data ?? []) as Array<{
    booking_id: string;
    property_id: string;
    closes_at: string;
  }>;
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

  let items: OrgToWriteItem[] = rows.map((row) => {
    const stay = stays.get(row.booking_id) ?? null;
    const label = labels.get(row.property_id);
    return {
      bookingId: row.booking_id,
      propertyId: row.property_id,
      propertySlug: label?.slug ?? '',
      propertyName: label?.name ?? 'Property',
      canWrite: actions.writeGuest.has(row.property_id),
      guestName: stay?.primary_guest_name || stay?.guest_facebook_name || null,
      closesAt: String(row.closes_at),
      checkInDate: stay?.check_in_date ?? null,
      checkOutDate: stay?.check_out_date ?? null,
    };
  });

  const term = sanitizeSearch(params.q).toLowerCase();
  if (term) {
    items = items.filter(
      (item) =>
        (item.guestName ?? '').toLowerCase().includes(term) ||
        item.propertyName.toLowerCase().includes(term)
    );
  }

  items.sort((a, b) => {
    const diff = Date.parse(a.closesAt) - Date.parse(b.closesAt);
    const ordered = params.sort === 'closes:desc' ? -diff : diff;
    return ordered !== 0 ? ordered : a.bookingId.localeCompare(b.bookingId);
  });

  const { from, to } = pageRange(params);
  return { items: items.slice(from, to + 1), total: items.length };
}

function unwrapProperty(raw: unknown): { slug?: string; name?: string } | null {
  if (!raw) return null;
  return (Array.isArray(raw) ? raw[0] : raw) as { slug?: string; name?: string };
}
