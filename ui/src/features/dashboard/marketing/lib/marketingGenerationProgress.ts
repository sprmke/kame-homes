import type { MarketingGenerationJob } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';

import { sanitizeToastMessage } from '@/lib/feedback/toastMessages';

/**
 * No row movement for this long while still in flight → orphaned job, stop polling.
 * Images finish in 5-15s; video (Phase 2) runs 11s to 6min, so this is sized for the
 * slower of the two rather than the booking review's 60s.
 */
export const STUCK_PROCESSING_MS = 8 * 60_000;

const IN_FLIGHT: MarketingGenerationJob['jobStatus'][] = ['pending', 'processing', 'finalizing'];

export function isGenerationInFlight(job: MarketingGenerationJob | null | undefined): boolean {
  return !!job && IN_FLIGHT.includes(job.jobStatus);
}

export function isStuckMarketingGeneration(
  job: MarketingGenerationJob | null | undefined
): boolean {
  if (!isGenerationInFlight(job)) return false;
  // createdAt, not updatedAt: a video job's row is touched on every ~10s poll tick
  // (provider_poll_count bump) even when nothing has actually progressed, which would
  // keep resetting an updatedAt-based clock and make this never fire. Total time alive
  // is the signal that actually means "orphaned."
  const created = job?.createdAt ? Date.parse(job.createdAt) : NaN;
  if (Number.isNaN(created)) return false;
  return Date.now() - created > STUCK_PROCESSING_MS;
}

export function generationStatusLabel(job: MarketingGenerationJob): string {
  switch (job.jobStatus) {
    case 'pending':
      return job.mediaType === 'video' ? 'Queued' : 'Generating';
    case 'processing':
      return 'Rendering';
    case 'finalizing':
      return 'Saving';
    case 'completed':
      return 'Ready';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
  }
}

/** Host-readable reason for a failed job — never the raw provider dump. */
export function generationErrorMessage(job: MarketingGenerationJob): string {
  switch (job.errorCode) {
    case 'safety_blocked':
      return 'That prompt was blocked. Try rephrasing.';
    case 'timeout':
      return 'This took too long and was stopped. You were not charged.';
    case 'download_failed':
      return 'The result could not be saved. Try again.';
    default:
      return sanitizeToastMessage(job.errorMessage, 'Could not generate that. Try again.');
  }
}

/** Meta rejects some Reels uploads above this, while the bucket allows far more. */
export const META_REELS_SIZE_WARNING_BYTES = 8 * 1024 * 1024;

export function formatOutputSize(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}
