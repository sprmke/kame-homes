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
import { submitGuestReview } from '@/features/guest/sd-form/lib/api';
import { filterGuestReviewTagsForRating } from '@/features/guest/sd-form/lib/guestReviewFeedbackTags';

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
}

export function SdFormReviewSection({
  bookingId,
  awaitingBalanceSettlement,
  onReviewSubmitted,
}: SdFormReviewSectionProps) {
  const [starRating, setStarRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [feedbackTagIds, setFeedbackTagIds] = useState<string[]>([]);
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
        await submitGuestReview(
          {
            bookingId,
            starRating,
            reviewText,
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

  // Review draft is not persisted; Discard-only prompt (no save from here).
  useUnsavedChangesGuard({
    isDirty:
      !submitted &&
      (starRating > 0 ||
        reviewText.trim() !== '' ||
        feedbackTagIds.length > 0 ||
        mediaItems.length > 0),
  });

  return (
    <section aria-labelledby="sd-review-heading" className="space-y-6">
      <h2 id="sd-review-heading" className="sr-only">
        Leave a review
      </h2>

      <GuestReviewStarRating
        value={starRating}
        onChange={setStarRating}
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
          maxLength={2000}
          className="min-h-[120px] resize-y"
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

      <Button
        type="button"
        className="shadow-primary/15 min-h-[48px] w-full shadow-md"
        disabled={starRating < 1 || submitMut.isPending}
        onClick={() => submitMut.mutate()}
      >
        {submitMut.isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            Submitting…
          </>
        ) : awaitingBalanceSettlement ? (
          'Submit review'
        ) : (
          'Submit review & continue'
        )}
      </Button>

      {antiSpam.render}
    </section>
  );
}
