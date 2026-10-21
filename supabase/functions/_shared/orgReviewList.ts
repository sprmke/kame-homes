/**
 * Org Reviews rollup: KPIs, per-property table, published received feed.
 * Unpublished counterpart content is never returned. Every query is limited to
 * the caller's visible properties (all org properties, or the org member's
 * assigned listings).
 */

import { createServiceClient } from './orgAuth.ts';
import {
  getHostReviewDueCounts,
  type PropertyReviewSummary,
  type ReceivedReviewItem,
} from './propertyReviewList.ts';

const PAGE_SIZE = 20;
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

export async function listOrgReceivedReviews(
  organizationId: string,
  visiblePropertyIds: string[],
  cursor: string | null
): Promise<{ items: OrgReceivedReviewItem[]; nextCursor: string | null }> {
  if (visiblePropertyIds.length === 0) return { items: [], nextCursor: null };
  const supabase = createServiceClient();
  let query = supabase
    .from('guest_reviews')
    .select(
      'id, booking_id, property_id, guest_display_name, star_rating, review_text, private_note, category_ratings, feedback_tags, media_urls, response_text, published_at, guest_submissions(primary_guest_name, guest_facebook_name, check_in_date, check_out_date), properties(slug, name)'
    )
    .eq('organization_id', organizationId)
    .in('property_id', visiblePropertyIds)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (cursor) query = query.lt('published_at', cursor);

  const { data, error } = await query;
  if (error) {
    console.warn('[orgReviewList] received failed:', error.message);
    return { items: [], nextCursor: null };
  }
  const rows = data ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  return {
    items: page.map((row) => {
      const stay = unwrapStay(row.guest_submissions);
      const property = unwrapProperty(row.properties);
      return {
        id: row.id as string,
        bookingId: row.booking_id as string,
        propertyId: row.property_id as string,
        propertySlug: property?.slug ?? '',
        propertyName: property?.name ?? 'Property',
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

function unwrapProperty(raw: unknown): { slug?: string; name?: string } | null {
  if (!raw) return null;
  return (Array.isArray(raw) ? raw[0] : raw) as { slug?: string; name?: string };
}
