/**
 * Signed-in guest Reviews page: to-write, by-you, about-you.
 * Unpublished counterpart content is never returned (D2). Internal notes never leave
 * the authoring org (D5).
 */

import type { AuthenticatedUser } from './orgAuth.ts';
import { createServiceClient } from './orgAuth.ts';
import { mintGuestBookingAccessToken } from './guestBookingAccessToken.ts';
import { identityKeyForEmail } from './guestIdentityKey.ts';
import { linkGuestBookingsByEmail } from './guestProfileService.ts';
import { getGuestReputation, type GuestReputation } from './hostGuestReviewService.ts';
import { decodeReviewCursor, encodeReviewCursor, isAfterReviewCursor } from './reviewCursor.ts';

const PAGE_SIZE = 20;
/** Same cap as the owned-booking lookup below, so every open window is considered. */
const MAX_OWNED_BOOKINGS = 200;

export type GuestReviewListTab = 'to_write' | 'by_you' | 'about_you';

/**
 * Every item carries a booking access token for its review link. The caller is
 * the verified owner of the booking, and `/guest-review` needs the token once
 * `GUEST_BOOKING_ACCESS_ENFORCE` is on (the account session is not enough there).
 */
type WithAccessToken = { accessToken: string | null };

export type GuestToWriteItem = WithAccessToken & {
  bookingId: string;
  propertyName: string;
  propertySlug: string;
  propertyImageUrl: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  closesAt: string;
};

export type GuestByYouItem = WithAccessToken & {
  id: string;
  bookingId: string;
  propertyName: string;
  propertySlug: string;
  starRating: number;
  reviewText: string | null;
  status: string;
  responseText: string | null;
  submittedAt: string;
  publishedAt: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
};

export type GuestAboutYouItem = WithAccessToken & {
  id: string;
  bookingId: string;
  propertyName: string;
  propertySlug: string;
  hiddenUntilYouReview: boolean;
  overallRating: number | null;
  reviewText: string | null;
  privateNote: string | null;
  wouldHostAgain: boolean | null;
  responseText: string | null;
  publishedAt: string | null;
  closesAt: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
};

async function mintAccessTokens(bookingIds: string[]): Promise<Map<string, string>> {
  const tokens = new Map<string, string>();
  await Promise.all(
    [...new Set(bookingIds)].map(async (bookingId) => {
      try {
        tokens.set(bookingId, await mintGuestBookingAccessToken(bookingId));
      } catch (err) {
        console.warn('[guestMyReviews] access token mint failed:', err);
      }
    })
  );
  return tokens;
}

export type GuestMyReviewsPage = {
  tab: GuestReviewListTab;
  reputation: GuestReputation | null;
  items: GuestToWriteItem[] | GuestByYouItem[] | GuestAboutYouItem[];
  nextCursor: string | null;
};

type StayEmbed = {
  id?: string;
  property_id?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
};

type PropertyBits = { name: string; slug: string; imageUrl: string | null };

function unwrapStay(raw: unknown): StayEmbed | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return (raw[0] as StayEmbed | undefined) ?? null;
  return raw as StayEmbed;
}

function firstPropertyImage(settings: unknown): string | null {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;
  const media = (settings as Record<string, unknown>).media;
  if (!Array.isArray(media) || media.length === 0) return null;
  const first = media[0];
  if (first && typeof first === 'object' && typeof (first as { url?: unknown }).url === 'string') {
    return String((first as { url: string }).url);
  }
  return null;
}

async function loadPropertyBits(propertyIds: string[]): Promise<Map<string, PropertyBits>> {
  const map = new Map<string, PropertyBits>();
  const ids = [...new Set(propertyIds.filter(Boolean))];
  if (ids.length === 0) return map;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('properties')
    .select('id, name, slug, settings')
    .in('id', ids)
    .limit(ids.length);
  for (const row of data ?? []) {
    map.set(row.id as string, {
      name: (row.name as string | null)?.trim() || 'Stay',
      slug: (row.slug as string | null)?.trim() || '',
      imageUrl: firstPropertyImage(row.settings),
    });
  }
  return map;
}

async function loadGuestBookingIds(
  user: AuthenticatedUser
): Promise<{ bookingIds: string[]; identityKey: string | null }> {
  const supabase = createServiceClient();
  await linkGuestBookingsByEmail(supabase, user);
  const email = user.email.trim().toLowerCase();
  const [{ data: byUser }, { data: byEmail }, identityKey] = await Promise.all([
    supabase
      .from('guest_submissions')
      .select('id')
      .eq('guest_user_id', user.id)
      .not('property_id', 'is', null)
      .is('parking_id', null)
      .limit(MAX_OWNED_BOOKINGS),
    email
      ? supabase
          .from('guest_submissions')
          .select('id')
          .is('guest_user_id', null)
          .eq('guest_email', email)
          .not('property_id', 'is', null)
          .is('parking_id', null)
          .limit(MAX_OWNED_BOOKINGS)
      : Promise.resolve({ data: [] as { id: string }[] }),
    identityKeyForEmail(user.email),
  ]);
  const bookingIds = [
    ...new Set(
      [...(byUser ?? []), ...(byEmail ?? [])]
        .map((row) => row.id as string)
        .filter((id) => typeof id === 'string' && id.length > 0)
    ),
  ];
  return { bookingIds, identityKey };
}

export async function listMyReviews(
  user: AuthenticatedUser,
  tab: GuestReviewListTab,
  cursor: string | null
): Promise<GuestMyReviewsPage> {
  const { bookingIds, identityKey } = await loadGuestBookingIds(user);
  if (tab === 'to_write') {
    const page = await listToWrite(bookingIds, cursor);
    return { tab, reputation: null, ...page };
  }
  if (tab === 'by_you') {
    const page = await listByYou(user.id, bookingIds, cursor);
    return { tab, reputation: null, ...page };
  }
  const [page, reputation] = await Promise.all([
    listAboutYou(user.id, identityKey, bookingIds, cursor),
    getGuestReputation(user.id, identityKey),
  ]);
  return { tab, reputation, ...page };
}

async function listToWrite(
  bookingIds: string[],
  cursor: string | null
): Promise<{ items: GuestToWriteItem[]; nextCursor: string | null }> {
  if (bookingIds.length === 0) return { items: [], nextCursor: null };
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();
  const { data: written } = await supabase
    .from('guest_reviews')
    .select('booking_id')
    .in('booking_id', bookingIds)
    .limit(bookingIds.length);
  const writtenIds = new Set((written ?? []).map((row) => row.booking_id as string));

  // Owned bookings are capped at MAX_OWNED_BOOKINGS, so load every open window for
  // them, drop the written ones, then page in memory. Paging in SQL before the
  // written filter returned short or empty pages while more stays were waiting.
  const { data, error } = await supabase
    .from('booking_review_windows')
    .select(
      'booking_id, closes_at, guest_submissions(id, property_id, check_in_date, check_out_date)'
    )
    .in('booking_id', bookingIds)
    .is('published_at', null)
    .gt('closes_at', nowIso)
    .order('closes_at', { ascending: true })
    .order('booking_id', { ascending: true })
    .limit(MAX_OWNED_BOOKINGS);
  if (error) {
    console.warn('[guestMyReviews] to_write failed:', error.message);
    return { items: [], nextCursor: null };
  }

  const after = decodeReviewCursor(cursor);
  const eligible = (data ?? []).filter(
    (row) =>
      !writtenIds.has(row.booking_id as string) &&
      isAfterReviewCursor({ at: row.closes_at as string, id: row.booking_id as string }, after)
  );
  const hasMore = eligible.length > PAGE_SIZE;
  const page = hasMore ? eligible.slice(0, PAGE_SIZE) : eligible;
  const [propertyMap, tokens] = await Promise.all([
    loadPropertyBits(page.map((row) => unwrapStay(row.guest_submissions)?.property_id ?? '')),
    mintAccessTokens(page.map((row) => row.booking_id as string)),
  ]);
  const last = page[page.length - 1];
  return {
    items: page.map((row) => {
      const stay = unwrapStay(row.guest_submissions);
      const property = propertyMap.get(stay?.property_id ?? '') ?? {
        name: 'Stay',
        slug: '',
        imageUrl: null,
      };
      return {
        bookingId: row.booking_id as string,
        propertyName: property.name,
        propertySlug: property.slug,
        propertyImageUrl: property.imageUrl,
        checkInDate: stay?.check_in_date ?? null,
        checkOutDate: stay?.check_out_date ?? null,
        closesAt: row.closes_at as string,
        accessToken: tokens.get(row.booking_id as string) ?? null,
      };
    }),
    nextCursor:
      hasMore && last
        ? encodeReviewCursor(last.closes_at as string, last.booking_id as string)
        : null,
  };
}

async function listByYou(
  guestUserId: string,
  bookingIds: string[],
  cursor: string | null
): Promise<{ items: GuestByYouItem[]; nextCursor: string | null }> {
  const supabase = createServiceClient();
  let query = supabase
    .from('guest_reviews')
    .select(
      'id, booking_id, star_rating, review_text, status, response_text, submitted_at, published_at, guest_submissions(property_id, check_in_date, check_out_date)'
    )
    .neq('status', 'removed')
    .order('submitted_at', { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (bookingIds.length > 0) {
    query = query.or(`guest_user_id.eq.${guestUserId},booking_id.in.(${bookingIds.join(',')})`);
  } else {
    query = query.eq('guest_user_id', guestUserId);
  }
  if (cursor) query = query.lt('submitted_at', cursor);

  const { data, error } = await query;
  if (error) {
    console.warn('[guestMyReviews] by_you failed:', error.message);
    return { items: [], nextCursor: null };
  }
  const rows = data ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const [propertyMap, tokens] = await Promise.all([
    loadPropertyBits(page.map((row) => unwrapStay(row.guest_submissions)?.property_id ?? '')),
    mintAccessTokens(
      page.filter((row) => row.status !== 'published').map((row) => row.booking_id as string)
    ),
  ]);
  return {
    items: page.map((row) => {
      const stay = unwrapStay(row.guest_submissions);
      const property = propertyMap.get(stay?.property_id ?? '') ?? {
        name: 'Stay',
        slug: '',
        imageUrl: null,
      };
      return {
        id: row.id as string,
        bookingId: row.booking_id as string,
        accessToken: tokens.get(row.booking_id as string) ?? null,
        propertyName: property.name,
        propertySlug: property.slug,
        starRating: Number(row.star_rating) || 0,
        reviewText: (row.review_text as string | null) ?? null,
        status: String(row.status),
        responseText:
          String(row.status) === 'published'
            ? ((row.response_text as string | null) ?? null)
            : null,
        submittedAt: String(row.submitted_at),
        publishedAt: (row.published_at as string | null) ?? null,
        checkInDate: stay?.check_in_date ?? null,
        checkOutDate: stay?.check_out_date ?? null,
      };
    }),
    nextCursor: hasMore
      ? ((page[page.length - 1]?.submitted_at as string | undefined) ?? null)
      : null,
  };
}

async function listAboutYou(
  guestUserId: string,
  identityKey: string | null,
  bookingIds: string[],
  cursor: string | null
): Promise<{ items: GuestAboutYouItem[]; nextCursor: string | null }> {
  const supabase = createServiceClient();
  const orFilter = [
    `guest_user_id.eq.${guestUserId}`,
    identityKey ? `guest_identity_key.eq."${identityKey}"` : null,
  ]
    .filter(Boolean)
    .join(',');

  let query = supabase
    .from('host_guest_reviews')
    .select(
      'id, booking_id, overall_rating, review_text, private_note, would_host_again, response_text, status, published_at, submitted_at, guest_submissions(property_id, check_in_date, check_out_date)'
    )
    .or(orFilter)
    .neq('status', 'removed')
    .order('submitted_at', { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (cursor) query = query.lt('submitted_at', cursor);

  const { data, error } = await query;
  if (error) {
    console.warn('[guestMyReviews] about_you failed:', error.message);
    return { items: [], nextCursor: null };
  }

  const { data: guestRows } = bookingIds.length
    ? await supabase
        .from('guest_reviews')
        .select('booking_id')
        .in('booking_id', bookingIds)
        .limit(bookingIds.length)
    : { data: [] as { booking_id: string }[] };
  const guestWrote = new Set((guestRows ?? []).map((row) => row.booking_id as string));
  const aboutBookingIds = (data ?? []).map((row) => row.booking_id as string);
  const [{ data: windows }, propertyMap] = await Promise.all([
    aboutBookingIds.length
      ? supabase
          .from('booking_review_windows')
          .select('booking_id, closes_at')
          .in('booking_id', aboutBookingIds)
          .limit(aboutBookingIds.length)
      : Promise.resolve({ data: [] as { booking_id: string; closes_at: string }[] }),
    loadPropertyBits(
      (data ?? []).map((row) => unwrapStay(row.guest_submissions)?.property_id ?? '')
    ),
  ]);
  const closesAtByBooking = new Map(
    (windows ?? []).map((row) => [row.booking_id as string, row.closes_at as string])
  );

  // Page over the raw rows (PAGE_SIZE + 1 fetched) so a filtered-out row never
  // hides the next page.
  const rows = data ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const tokens = await mintAccessTokens(pageRows.map((row) => row.booking_id as string));

  const mapped: GuestAboutYouItem[] = [];
  for (const row of pageRows) {
    const stay = unwrapStay(row.guest_submissions);
    const property = propertyMap.get(stay?.property_id ?? '') ?? {
      name: 'Stay',
      slug: '',
      imageUrl: null,
    };
    const published = row.status === 'published';
    const guestHasReview = guestWrote.has(row.booking_id as string);
    if (!published && guestHasReview) continue;
    const hiddenUntilYouReview = !published && !guestHasReview;
    mapped.push({
      id: row.id as string,
      bookingId: row.booking_id as string,
      propertyName: property.name,
      propertySlug: property.slug,
      hiddenUntilYouReview,
      overallRating: hiddenUntilYouReview ? null : Number(row.overall_rating) || null,
      reviewText: hiddenUntilYouReview ? null : ((row.review_text as string | null) ?? null),
      privateNote: hiddenUntilYouReview ? null : ((row.private_note as string | null) ?? null),
      wouldHostAgain: hiddenUntilYouReview ? null : Boolean(row.would_host_again),
      responseText: hiddenUntilYouReview ? null : ((row.response_text as string | null) ?? null),
      publishedAt: (row.published_at as string | null) ?? null,
      closesAt: closesAtByBooking.get(row.booking_id as string) ?? null,
      checkInDate: stay?.check_in_date ?? null,
      checkOutDate: stay?.check_out_date ?? null,
      accessToken: tokens.get(row.booking_id as string) ?? null,
    });
  }

  const lastSubmitted = hasMore
    ? (pageRows[pageRows.length - 1]?.submitted_at as string | undefined)
    : undefined;
  return { items: mapped, nextCursor: lastSubmitted ?? null };
}

export async function guestOwnsHostReview(
  user: AuthenticatedUser,
  reviewId: string
): Promise<
  | {
      ok: true;
      organizationId: string;
      propertyId: string;
      bookingId: string;
    }
  | { ok: false }
> {
  const supabase = createServiceClient();
  const identityKey = await identityKeyForEmail(user.email);
  const { data } = await supabase
    .from('host_guest_reviews')
    .select(
      'id, organization_id, property_id, booking_id, guest_user_id, guest_identity_key, status'
    )
    .eq('id', reviewId)
    .maybeSingle();
  if (!data) return { ok: false };
  const owns =
    data.guest_user_id === user.id ||
    (identityKey != null && data.guest_identity_key === identityKey);
  if (!owns) return { ok: false };
  return {
    ok: true,
    organizationId: data.organization_id as string,
    propertyId: data.property_id as string,
    bookingId: data.booking_id as string,
  };
}
