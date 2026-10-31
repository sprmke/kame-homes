import { useEffect, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { GuestReviewFeedbackPills } from '@/features/guest/sd-form/components/GuestReviewFeedbackPills';
import {
  GuestReviewMediaUpload,
  guestReviewMediaFiles,
  type GuestReviewMediaItem,
} from '@/features/guest/sd-form/components/GuestReviewMediaUpload';
import { GuestReviewStarRating } from '@/features/guest/sd-form/components/GuestReviewStarRating';
import { submitGuestReview, type GuestReviewDraft } from '@/features/guest/sd-form/lib/api';
import { filterGuestReviewTagsForRating } from '@/features/guest/sd-form/lib/guestReviewFeedbackTags';

import { CategoryRatingList } from '@/features/reviews/components/CategoryRatingList';
import {
  isGuestCategoryRatingsComplete,
  REVIEW_PRIVATE_NOTE_MAX_LEN,
  REVIEW_TEXT_MAX_LEN,
  type CategoryRatings,
} from '@/features/reviews/lib/reviewCatalog';

import { useAntiSpamSubmit } from '@/components/security/useAntiSpamSubmit';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

export interface SdFormReviewSectionProps {
  bookingId: string;
  awaitingBalanceSettlement: boolean;
  onReviewSubmitted: () => void;
  /** Pre-fills the form when the guest already has a submitted (unpublished) draft. */
  reviewDraft?: GuestReviewDraft | null;
  /** False once the review has published and double-blind closed it to edits. */
  canEdit?: boolean;
  /** D3/D4: review is optional — lets the guest move on without writing one. */
  onSkip?: () => void;
}

export function SdFormReviewSection({
  bookingId,
  awaitingBalanceSettlement,
  onReviewSubmitted,
  reviewDraft,
  canEdit = true,
  onSkip,
}: SdFormReviewSectionProps) {
  const [starRating, setStarRating] = useState(reviewDraft?.starRating ?? 0);
  const [categoryRatings, setCategoryRatings] = useState<CategoryRatings>(
    reviewDraft?.categoryRatings ?? {}
  );
  const [reviewText, setReviewText] = useState(reviewDraft?.reviewText ?? '');
  const [privateNote, setPrivateNote] = useState(reviewDraft?.privateNote ?? '');
  const [feedbackTagIds, setFeedbackTagIds] = useState<string[]>(reviewDraft?.feedbackTags ?? []);
  const [mediaItems, setMediaItems] = useState<GuestReviewMediaItem[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const antiSpam = useAntiSpamSubmit({ action: 'submit-guest-review' });

  useEffect(() => {
    setFeedbackTagIds((prev) => filterGuestReviewTagsForRating(starRating, prev));
  }, [starRating]);

  const submitMut = useMutation({
    mutationFn: async () => {
      const fields = await antiSpam.collect();
      try {
        return await submitGuestReview(
          {
            bookingId,
            starRating,
            categoryRatings,
            reviewText,
            privateNote,
            feedbackTags: feedbackTagIds,
            media: guestReviewMediaFiles(mediaItems),
          },
          fields
        );
      } finally {
        antiSpam.reset();
      }
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success('Thanks for your review');
      onReviewSubmitted();
    },
    onError: (err: Error) => {
      toast.error(friendlyToastError(err, 'Could not submit review'));
    },
  });

  const isDirty =
    !submitted &&
    canEdit &&
    (starRating !== (reviewDraft?.starRating ?? 0) ||
      JSON.stringify(categoryRatings) !== JSON.stringify(reviewDraft?.categoryRatings ?? {}) ||
      reviewText.trim() !== (reviewDraft?.reviewText ?? '') ||
      privateNote.trim() !== (reviewDraft?.privateNote ?? '') ||
      JSON.stringify([...feedbackTagIds].sort()) !==
        JSON.stringify([...(reviewDraft?.feedbackTags ?? [])].sort()) ||
      mediaItems.length > 0);

  // Review draft is not persisted client-side; Discard-only prompt (no save from here).
  useUnsavedChangesGuard({ isDirty });

  const canSubmit =
    starRating >= 1 && isGuestCategoryRatingsComplete(categoryRatings) && !submitMut.isPending;

  if (!canEdit) {
    const published = reviewDraft?.status === 'published';
    return (
      <section aria-labelledby="sd-review-heading" className="space-y-4">
        <h2 id="sd-review-heading" className="sr-only">
          Your review
        </h2>
        <div className="border-border/60 bg-muted/20 rounded-xl border px-4 py-5 text-center">
          <p className="text-foreground text-sm font-semibold">
            {published ? 'Review published' : 'Review window closed'}
          </p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {published
              ? 'Your review is live and can no longer be edited.'
              : 'This stay is no longer open for a review.'}
          </p>
        </div>
        {onSkip ? (
          <Button type="button" className="min-h-[48px] w-full" onClick={onSkip}>
            Continue
          </Button>
        ) : null}
      </section>
    );
  }

  return (
    <section aria-labelledby="sd-review-heading" className="space-y-6">
      <h2 id="sd-review-heading" className="sr-only">
        Leave a review
      </h2>

      <GuestReviewStarRating
        value={starRating}
        onChange={setStarRating}
        disabled={submitMut.isPending}
        ariaLabel="Overall rating"
      />

      <CategoryRatingList
        value={categoryRatings}
        onChange={setCategoryRatings}
        disabled={submitMut.isPending}
      />

      <GuestReviewFeedbackPills
        starRating={starRating}
        selectedTagIds={feedbackTagIds}
        onChange={setFeedbackTagIds}
        disabled={submitMut.isPending}
      />

      <div className="space-y-2">
        <Label htmlFor="sd-review-text" className="text-sm font-medium">
          Feedback
        </Label>
        <Textarea
          id="sd-review-text"
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          rows={4}
          maxLength={REVIEW_TEXT_MAX_LEN}
          className="min-h-[120px] resize-y"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sd-review-private-note" className="text-sm font-medium">
          Private note to host
        </Label>
        <Textarea
          id="sd-review-private-note"
          value={privateNote}
          onChange={(e) => setPrivateNote(e.target.value)}
          rows={3}
          maxLength={REVIEW_PRIVATE_NOTE_MAX_LEN}
          className="min-h-[90px] resize-y"
          placeholder="Only your host sees this"
        />
      </div>

      <div className="space-y-3">
        <Label id="sd-review-media-label" className="text-sm font-medium">
          Photos
        </Label>
        <GuestReviewMediaUpload
          items={mediaItems}
          onChange={setMediaItems}
          disabled={submitMut.isPending}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button
          type="button"
          className="shadow-primary/15 min-h-[48px] w-full shadow-md sm:min-h-[44px]"
          disabled={!canSubmit}
          onClick={() => submitMut.mutate()}
        >
          {submitMut.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Submitting…
            </>
          ) : reviewDraft ? (
            'Save review'
          ) : awaitingBalanceSettlement ? (
            'Submit review'
          ) : (
            'Submit review & continue'
          )}
        </Button>
        {onSkip ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-[48px] w-full"
            disabled={submitMut.isPending || Boolean(reviewDraft && isDirty)}
            onClick={onSkip}
          >
            {/* A saved draft stays as submitted; Continue moves on without re-saving it. */}
            {reviewDraft ? 'Continue' : 'Not now'}
          </Button>
        ) : null}
      </div>

      {antiSpam.render}
    </section>
  );
}
