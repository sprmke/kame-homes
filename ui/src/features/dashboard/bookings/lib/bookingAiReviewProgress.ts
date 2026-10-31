import type {
  BookingAiReview,
  BookingAiReviewSectionId,
} from '@/features/dashboard/bookings/lib/types';

/** No section movement for this long while still `processing` → orphaned job. */
const STUCK_PROCESSING_MS = 60_000;

/** Optimistic row shown the moment a run starts — enables polling before POST returns. */
export function buildOptimisticProcessingReview(bookingId: string): BookingAiReview {
  return {
    booking_id: bookingId,
    job_status: 'processing',
    stay_details_status: 'pending',
    guests_status: 'pending',
    parking_status: 'pending',
    pets_status: 'pending',
    pricing_status: 'pending',
    stay_details_result: null,
    guests_result: null,
    parking_result: null,
    pets_result: null,
    pricing_result: null,
    flag_count: 0,
    has_blocking_flag: false,
    stale_sections: [],
  };
}

export function isStuckProcessingReview(review: BookingAiReview | null | undefined): boolean {
  if (!review || review.job_status !== 'processing') return false;
  const statuses = [
    review.stay_details_status,
    review.guests_status,
    review.parking_status,
    review.pets_status,
    review.pricing_status,
  ];
  if (statuses.some((status) => status !== 'pending')) return false;
  const updated = review.updated_at ? Date.parse(review.updated_at) : NaN;
  if (!Number.isFinite(updated)) return false;
  return Date.now() - updated >= STUCK_PROCESSING_MS;
}

export function isBookingAiReviewRunning(
  review: BookingAiReview | null | undefined,
  mutationPending = false
): boolean {
  if (isStuckProcessingReview(review)) return false;
  return mutationPending || review?.job_status === 'processing';
}

export function hasPriorAiReviewResults(review: BookingAiReview | null | undefined): boolean {
  if (!review) return false;
  return Boolean(
    review.stay_details_result ||
    review.guests_result ||
    review.parking_result ||
    review.pets_result ||
    review.pricing_result
  );
}

/** True once an admin has finished an AI Summary job — including while a refresh is in flight. */
export function hasBookingAiReviewRun(review: BookingAiReview | null | undefined): boolean {
  if (!review) return false;
  if (review.job_status === 'completed' || review.job_status === 'failed') return true;
  return hasPriorAiReviewResults(review);
}

export function isBookingAiReviewStale(review: BookingAiReview | null | undefined): boolean {
  return (review?.stale_sections?.length ?? 0) > 0;
}

export function isBookingAiReviewSectionStale(
  review: BookingAiReview | null | undefined,
  id: BookingAiReviewSectionId
): boolean {
  return review?.stale_sections?.includes(id) ?? false;
}

/** Refresh is allowed when inputs drifted, or the first attempt failed / got stuck. */
export function canRefreshBookingAiReview(
  review: BookingAiReview | null | undefined,
  mutationPending = false
): boolean {
  if (isBookingAiReviewRunning(review, mutationPending)) return false;
  if (!hasBookingAiReviewRun(review)) return false;
  return isBookingAiReviewStale(review) || review?.job_status === 'failed';
}
