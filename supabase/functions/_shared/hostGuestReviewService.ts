/**
 * Host -> guest reviews (host_guest_reviews). Mirrors guestReviewService.ts's
 * editable-until-published lifecycle.
 */

import { guestIdentityKey } from './guestIdentityKey.ts';
import { createServiceClient } from './orgAuth.ts';
import { normalizeReviewText } from './reviewContentPolicy.ts';

export type HostGuestReviewRow = {
  id: string;
  booking_id: string;
  property_id: string;
  organization_id: string;
  guest_user_id: string | null;
  guest_identity_key: string;
  overall_rating: number;
  cleanliness_rating: number;
  communication_rating: number;
  house_rules_rating: number;
  would_host_again: boolean;
  strength_tags: string[];
  issue_tags: string[];
  review_text: string | null;
  private_note: string | null;
  internal_note: string | null;
  author_user_id: string | null;
  status: 'submitted' | 'published' | 'removed';
  submitted_at: string;
  edited_at: string | null;
  published_at: string | null;
  response_text: string | null;
  response_at: string | null;
  removed_at: string | null;
  removed_reason: string | null;
};

export async function getHostGuestReviewRow(bookingId: string): Promise<HostGuestReviewRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('host_guest_reviews')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();
  if (error) {
    console.warn('[hostGuestReviewService] getHostGuestReviewRow failed:', error.message);
    return null;
  }
  return (data as HostGuestReviewRow) ?? null;
}

export type UpsertHostGuestReviewInput = {
  bookingId: string;
  propertyId: string;
  organizationId: string;
  guestUserId: string | null;
  guestIdentityKey: string;
  overallRating: number;
  cleanlinessRating: number;
  communicationRating: number;
  houseRulesRating: number;
  wouldHostAgain: boolean;
  strengthTags: string[];
  issueTags: string[];
  reviewText: string | null;
  privateNote: string | null;
  internalNote: string | null;
  authorUserId: string | null;
};

export type UpsertHostGuestReviewResult =
  { ok: true; id: string; wasEdit: boolean } | { ok: false; error: 'already_published' };

export async function upsertHostGuestReview(
  input: UpsertHostGuestReviewInput,
  attempt = 0
): Promise<UpsertHostGuestReviewResult> {
  const supabase = createServiceClient();
  const existing = await getHostGuestReviewRow(input.bookingId);

  // Published and removed rows are final. The edit below is also conditional on
  // `status = 'submitted'` so it cannot undo a publish that lands mid-request.
  if (existing && existing.status !== 'submitted') {
    return { ok: false, error: 'already_published' };
  }

  const nowIso = new Date().toISOString();
  const payload = {
    property_id: input.propertyId,
    organization_id: input.organizationId,
    guest_user_id: input.guestUserId,
    guest_identity_key: input.guestIdentityKey,
    overall_rating: input.overallRating,
    cleanliness_rating: input.cleanlinessRating,
    communication_rating: input.communicationRating,
    house_rules_rating: input.houseRulesRating,
    would_host_again: input.wouldHostAgain,
    strength_tags: input.strengthTags,
    issue_tags: input.issueTags,
    review_text: input.reviewText,
    private_note: input.privateNote,
    internal_note: input.internalNote,
    author_user_id: input.authorUserId,
    status: 'submitted' as const,
  };

  if (existing) {
    const { data: updated, error } = await supabase
      .from('host_guest_reviews')
      .update({ ...payload, edited_at: nowIso })
      .eq('id', existing.id)
      .eq('status', 'submitted')
      .select('id')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) return { ok: false, error: 'already_published' };
    return { ok: true, id: existing.id, wasEdit: true };
  }

  const { data, error } = await supabase
    .from('host_guest_reviews')
    .insert({ ...payload, booking_id: input.bookingId, submitted_at: nowIso })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505' && attempt === 0) {
      return upsertHostGuestReview(input, attempt + 1);
    }
    throw new Error(error.message);
  }
  return { ok: true, id: data.id as string, wasEdit: false };
}

export type RespondToHostReviewResult = { ok: true } | { ok: false; error: string };

/** Guest's single response to a published host review of them. */
export async function respondToHostReview(
  bookingId: string,
  responseText: string | null
): Promise<RespondToHostReviewResult> {
  const supabase = createServiceClient();
  const review = await getHostGuestReviewRow(bookingId);
  if (!review) return { ok: false, error: 'not_found' };
  if (review.status !== 'published') return { ok: false, error: 'not_published' };

  const normalized = normalizeReviewText(responseText);
  const { data: updated, error } = await supabase
    .from('host_guest_reviews')
    .update({
      response_text: normalized,
      response_at: normalized ? new Date().toISOString() : null,
    })
    .eq('id', review.id)
    .eq('status', 'published')
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: false, error: 'not_published' };
  return { ok: true };
}

export type GuestReputation = {
  reviewCount: number;
  avgOverall: number | null;
  categoryAvgs: {
    cleanliness: number | null;
    communication: number | null;
    houseRules: number | null;
  };
  wouldHostAgainRate: number | null;
  topStrengthTags: string[];
  topIssueTags: string[];
  lastStayAt: string | null;
};

export async function getGuestReputation(
  guestUserId: string | null,
  identityKey: string | null
): Promise<GuestReputation> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('guest_reputation', {
    p_guest_user_id: guestUserId,
    p_identity_key: identityKey,
  });
  if (error) {
    console.warn('[hostGuestReviewService] getGuestReputation failed:', error.message);
    return {
      reviewCount: 0,
      avgOverall: null,
      categoryAvgs: { cleanliness: null, communication: null, houseRules: null },
      wouldHostAgainRate: null,
      topStrengthTags: [],
      topIssueTags: [],
      lastStayAt: null,
    };
  }
  return data as GuestReputation;
}

/** Up to `limit` recent published reviews of this guest, generalized for screening hosts (D5). */
export async function listRecentPublishedHostReviewsForGuest(
  guestUserId: string | null,
  identityKey: string | null,
  excludeBookingId: string,
  limit = 5
): Promise<
  { reviewText: string | null; overallRating: number; areaLabel: string; createdAt: string }[]
> {
  if (!guestUserId && !identityKey) return [];
  const supabase = createServiceClient();
  const orFilter = [
    guestUserId ? `guest_user_id.eq.${guestUserId}` : null,
    // Quoted: `booking:<id>` placeholder keys contain a PostgREST-reserved ':'.
    identityKey ? `guest_identity_key.eq."${identityKey}"` : null,
  ]
    .filter(Boolean)
    .join(',');
  if (!orFilter) return [];

  const { data, error } = await supabase
    .from('host_guest_reviews')
    .select('review_text, overall_rating, submitted_at, properties(city, residence_name)')
    .or(orFilter)
    .eq('status', 'published')
    .neq('booking_id', excludeBookingId)
    .order('submitted_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn(
      '[hostGuestReviewService] listRecentPublishedHostReviewsForGuest failed:',
      error.message
    );
    return [];
  }

  return (data ?? []).map((row) => {
    const propertyRaw = row.properties as
      | { city?: string | null; residence_name?: string | null }
      | { city?: string | null; residence_name?: string | null }[]
      | null;
    const property = Array.isArray(propertyRaw) ? propertyRaw[0] : propertyRaw;
    // D5: generalize the authoring property to its area, never the exact listing.
    const areaLabel =
      property?.city?.trim() || property?.residence_name?.trim() || 'another property';
    return {
      reviewText: (row.review_text as string | null) ?? null,
      overallRating: Number(row.overall_rating) || 0,
      areaLabel,
      createdAt: String(row.submitted_at),
    };
  });
}

export async function linkReviewGuestUserIds(userId: string, bookingIds: string[]): Promise<void> {
  if (bookingIds.length === 0) return;
  const supabase = createServiceClient();
  const { error: guestErr } = await supabase
    .from('guest_reviews')
    .update({ guest_user_id: userId })
    .in('booking_id', bookingIds)
    .is('guest_user_id', null);
  if (guestErr) {
    console.warn('[hostGuestReviewService] link guest_reviews failed:', guestErr.message);
  }
  const { error: hostErr } = await supabase
    .from('host_guest_reviews')
    .update({ guest_user_id: userId })
    .in('booking_id', bookingIds)
    .is('guest_user_id', null);
  if (hostErr) {
    console.warn('[hostGuestReviewService] link host_guest_reviews failed:', hostErr.message);
  }
}

export async function syncReviewIdentityKey(
  bookingId: string,
  email: string | null | undefined
): Promise<void> {
  const key = await guestIdentityKey(email, bookingId);
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('host_guest_reviews')
    .update({ guest_identity_key: key })
    .eq('booking_id', bookingId)
    .neq('status', 'removed');
  if (error) {
    console.warn('[hostGuestReviewService] syncReviewIdentityKey failed:', error.message);
  }
}
