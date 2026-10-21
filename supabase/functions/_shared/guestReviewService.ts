/**
 * Guest in-app reviews — one row per booking. Editable while `status = 'submitted'`
 * (double-blind, see booking_review_windows); immutable once `status = 'published'`.
 */

import { createServiceClient } from './orgAuth.ts';
import { formatMaxBytesError, UPLOAD_MAX_BYTES } from './uploadLimits.ts';
import { UploadService } from './uploadService.ts';
import type { CategoryRatings } from './reviewCategories.ts';
import { normalizeReviewText } from './reviewContentPolicy.ts';

export type GuestReviewMediaItem = {
  url: string;
  type: 'image' | 'video';
};

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export function validateGuestReviewMedia(files: File[]): string | null {
  if (files.length === 0) return null;
  if (files.length > 3) return 'Upload up to 3 images';

  for (const file of files) {
    if (!IMAGE_MIME.has(file.type)) return 'Only images are supported';
    if (file.size > UPLOAD_MAX_BYTES.image) {
      return formatMaxBytesError(UPLOAD_MAX_BYTES.image);
    }
  }

  return null;
}

export async function guestReviewExistsForBooking(bookingId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('guest_reviews')
    .select('id')
    .eq('booking_id', bookingId)
    .maybeSingle();
  if (error) {
    console.warn('[guestReviewService] lookup failed:', error.message);
    return false;
  }
  return Boolean(data?.id);
}

export async function uploadGuestReviewMedia(
  bookingId: string,
  propertyId: string | null,
  files: File[]
): Promise<GuestReviewMediaItem[]> {
  const items: GuestReviewMediaItem[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${bookingId}/review-${i + 1}.${ext}`;
    const { url } = await UploadService.uploadFile(
      file,
      fileName,
      'guest-review-media',
      propertyId
    );
    items.push({
      url,
      type: 'image',
    });
  }
  return items;
}

export type GuestReviewRow = {
  id: string;
  property_id: string;
  organization_id: string;
  booking_id: string;
  guest_user_id: string | null;
  star_rating: number;
  review_text: string | null;
  category_ratings: CategoryRatings;
  private_note: string | null;
  feedback_tags: string[];
  media_urls: GuestReviewMediaItem[];
  guest_display_name: string | null;
  source: string;
  status: 'submitted' | 'published' | 'removed';
  submitted_at: string | null;
  edited_at: string | null;
  published_at: string | null;
  response_text: string | null;
  response_at: string | null;
  response_by: string | null;
  created_at: string;
};

export type GuestReviewDraftDto = {
  status: 'submitted' | 'published' | 'removed';
  starRating: number;
  categoryRatings: CategoryRatings;
  reviewText: string | null;
  privateNote: string | null;
  feedbackTags: string[];
  mediaUrls: GuestReviewMediaItem[];
};

/** Bootstrap payload for `get-sd-form` / `get-guest-review` — lets the form pre-fill an edit. */
export async function getGuestReviewDraft(bookingId: string): Promise<GuestReviewDraftDto | null> {
  const row = await getGuestReviewRow(bookingId);
  if (!row) return null;
  return {
    status: row.status,
    starRating: row.star_rating,
    categoryRatings: row.category_ratings ?? {},
    reviewText: row.review_text,
    privateNote: row.private_note,
    feedbackTags: row.feedback_tags ?? [],
    mediaUrls: row.media_urls ?? [],
  };
}

export async function getGuestReviewRow(bookingId: string): Promise<GuestReviewRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('guest_reviews')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();
  if (error) {
    console.warn('[guestReviewService] getGuestReviewRow failed:', error.message);
    return null;
  }
  return (data as GuestReviewRow) ?? null;
}

export type UpsertGuestReviewInput = {
  propertyId: string;
  organizationId: string;
  bookingId: string;
  guestUserId: string | null;
  starRating: number;
  reviewText: string | null;
  categoryRatings: CategoryRatings;
  privateNote: string | null;
  feedbackTags: string[];
  mediaUrls: GuestReviewMediaItem[];
  guestDisplayName: string | null;
  source: 'sd_form' | 'guest_review' | 'trip' | 'account' | 'email_link';
};

export type UpsertGuestReviewResult =
  { ok: true; id: string; wasEdit: boolean } | { ok: false; error: 'already_published' };

/**
 * Insert (first submit) or update (edit while unpublished). Never touches a
 * published or removed row: the edit is conditional on `status = 'submitted'`,
 * so an edit racing the double-blind publish cannot flip a published review
 * back to submitted.
 */
export async function upsertGuestReview(
  input: UpsertGuestReviewInput,
  attempt = 0
): Promise<UpsertGuestReviewResult> {
  const supabase = createServiceClient();
  const existing = await getGuestReviewRow(input.bookingId);

  if (existing && existing.status !== 'submitted') {
    return { ok: false, error: 'already_published' };
  }

  const nowIso = new Date().toISOString();
  const payload = {
    property_id: input.propertyId,
    organization_id: input.organizationId,
    booking_id: input.bookingId,
    guest_user_id: input.guestUserId,
    star_rating: input.starRating,
    review_text: input.reviewText,
    category_ratings: input.categoryRatings,
    private_note: input.privateNote,
    feedback_tags: input.feedbackTags,
    media_urls: input.mediaUrls,
    guest_display_name: input.guestDisplayName,
    source: input.source,
    status: 'submitted' as const,
  };

  if (existing) {
    const { data: updated, error } = await supabase
      .from('guest_reviews')
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
    .from('guest_reviews')
    .insert({ ...payload, submitted_at: nowIso })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505' && attempt === 0) {
      // Race: another request inserted first — retry once as an update.
      return upsertGuestReview(input, attempt + 1);
    }
    throw new Error(error.message);
  }
  return { ok: true, id: data.id as string, wasEdit: false };
}

export type RespondToGuestReviewResult =
  { ok: true; firstResponse: boolean } | { ok: false; error: string };

/**
 * Host's single public response to a published guest review (create/edit/delete).
 * `firstResponse` is true only when there was no response before, so callers
 * notify the guest once rather than on every edit.
 */
export async function respondToGuestReview(
  bookingId: string,
  responseText: string | null,
  respondedBy: string
): Promise<RespondToGuestReviewResult> {
  const supabase = createServiceClient();
  const review = await getGuestReviewRow(bookingId);
  if (!review) return { ok: false, error: 'not_found' };
  if (review.status !== 'published') return { ok: false, error: 'not_published' };

  const normalized = normalizeReviewText(responseText);
  const { data: updated, error } = await supabase
    .from('guest_reviews')
    .update({
      response_text: normalized,
      response_at: normalized ? new Date().toISOString() : null,
      response_by: normalized ? respondedBy : null,
    })
    .eq('id', review.id)
    .eq('status', 'published')
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: false, error: 'not_published' };
  return { ok: true, firstResponse: Boolean(normalized) && !review.response_text };
}

export type PublicGuestReviewDto = {
  id: string;
  author: string;
  date: string;
  rating: number;
  comment: string;
  feedbackTags: string[];
  media: GuestReviewMediaItem[];
  source?: 'kame' | 'facebook' | 'airbnb';
  /** ISO timestamp for newest-first merge sort. */
  createdAt: string | null;
  /** Booking stay boundaries (`guest_submissions` MM-DD-YYYY). Kame reviews only. */
  checkInDate?: string | null;
  checkOutDate?: string | null;
  /** Host public response. Unpublished responses are never stored. */
  responseText?: string | null;
};

export async function listPublicGuestReviews(
  propertyId: string,
  limit = 20
): Promise<PublicGuestReviewDto[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('guest_reviews')
    .select(
      'id, star_rating, review_text, feedback_tags, media_urls, guest_display_name, created_at, response_text, guest_submissions(check_in_date, check_out_date)'
    )
    .eq('property_id', propertyId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[guestReviewService] list failed:', error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const created = typeof row.created_at === 'string' ? row.created_at : '';
    const date = created
      ? new Date(created).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : '';
    const bookingRaw = row.guest_submissions as
      | { check_in_date?: string | null; check_out_date?: string | null }
      | { check_in_date?: string | null; check_out_date?: string | null }[]
      | null;
    const booking = Array.isArray(bookingRaw) ? bookingRaw[0] : bookingRaw;
    const checkInDate = typeof booking?.check_in_date === 'string' ? booking.check_in_date : null;
    const checkOutDate =
      typeof booking?.check_out_date === 'string' ? booking.check_out_date : null;
    const mediaRaw = row.media_urls;
    const media: GuestReviewMediaItem[] = Array.isArray(mediaRaw)
      ? mediaRaw
          .filter((item) => item && typeof item === 'object')
          .map((item) => {
            const m = item as Record<string, unknown>;
            const url = typeof m.url === 'string' ? m.url : '';
            const type = m.type === 'video' ? 'video' : 'image';
            return { url, type } as GuestReviewMediaItem;
          })
          .filter((m) => m.url)
      : [];

    const feedbackTagsRaw = row.feedback_tags;
    const feedbackTags = Array.isArray(feedbackTagsRaw)
      ? feedbackTagsRaw.filter((entry: unknown): entry is string => typeof entry === 'string')
      : [];

    return {
      id: row.id as string,
      author: (row.guest_display_name as string | null)?.trim() || 'Guest',
      date,
      rating: Number(row.star_rating) || 5,
      comment: (row.review_text as string | null)?.trim() || '',
      feedbackTags,
      media,
      source: 'kame',
      createdAt: created || null,
      checkInDate,
      checkOutDate,
      responseText: (row.response_text as string | null)?.trim() || null,
    };
  });
}

/** Newest-first merge of Kame + approved external reviews. */
export function sortPublicGuestReviewsNewestFirst(
  reviews: PublicGuestReviewDto[]
): PublicGuestReviewDto[] {
  return [...reviews].sort((a, b) => {
    const aMs = a.createdAt ? Date.parse(a.createdAt) : Number.NaN;
    const bMs = b.createdAt ? Date.parse(b.createdAt) : Number.NaN;
    const aOk = Number.isFinite(aMs);
    const bOk = Number.isFinite(bMs);
    if (aOk && bOk) return bMs - aMs;
    if (aOk) return -1;
    if (bOk) return 1;
    return 0;
  });
}
