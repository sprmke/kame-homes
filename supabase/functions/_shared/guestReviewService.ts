/**
 * Guest in-app reviews — one immutable row per booking.
 */

import { createServiceClient } from './orgAuth.ts';
import { formatMaxBytesError, UPLOAD_MAX_BYTES } from './uploadLimits.ts';
import { UploadService } from './uploadService.ts';

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

export async function insertGuestReview(input: {
  propertyId: string;
  bookingId: string;
  starRating: number;
  reviewText: string | null;
  feedbackTags: string[];
  mediaUrls: GuestReviewMediaItem[];
  guestDisplayName: string | null;
}): Promise<{ id: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('guest_reviews')
    .insert({
      property_id: input.propertyId,
      booking_id: input.bookingId,
      star_rating: input.starRating,
      review_text: input.reviewText,
      feedback_tags: input.feedbackTags,
      media_urls: input.mediaUrls,
      guest_display_name: input.guestDisplayName,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Review already submitted for this booking');
    }
    throw new Error(error.message);
  }
  return { id: data.id as string };
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
};

export async function listPublicGuestReviews(
  propertyId: string,
  limit = 20
): Promise<PublicGuestReviewDto[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('guest_reviews')
    .select(
      'id, star_rating, review_text, feedback_tags, media_urls, guest_display_name, created_at, guest_submissions(check_in_date, check_out_date)'
    )
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
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
    };
  });
}

export function averageGuestReviewRating(reviews: PublicGuestReviewDto[]): number | null {
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
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
