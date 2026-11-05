import { useEffect, useMemo, useRef, useState } from 'react';

import { toast } from 'sonner';

import { GuestReviewStarRating } from '@/features/guest/sd-form/components/GuestReviewStarRating';

import { handleAiMutationError } from '@/features/dashboard/org/lib/aiQuotaToast';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { HostCategoryRatingList } from '@/features/reviews/components/HostCategoryRatingList';
import { TagPicker } from '@/features/reviews/components/TagPicker';
import { useSubmitHostGuestReview } from '@/features/reviews/hooks/useGuestReputation';
import { useDraftReviewWithAi } from '@/features/reviews/hooks/useReviewAutomation';
import type { HostGuestReviewDraft } from '@/features/reviews/lib/reviewApi';
import {
  HOST_REVIEW_ISSUE_TAG_IDS,
  HOST_REVIEW_ISSUE_TAG_LABELS,
  HOST_REVIEW_STRENGTH_TAG_IDS,
  HOST_REVIEW_STRENGTH_TAG_LABELS,
  HOST_REVIEW_TEXT_MIN_WHEN_LOW,
  REVIEW_PRIVATE_NOTE_MAX_LEN,
  REVIEW_TEXT_MAX_LEN,
  hostReviewTextRequired,
  isHostCategoryRatingsComplete,
  type HostCategoryRatings,
} from '@/features/reviews/lib/reviewCatalog';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { cn } from '@/lib/utils';

type FormState = {
  overallRating: number;
  categories: HostCategoryRatings;
  wouldHostAgain: boolean | null;
  tags: string[];
  reviewText: string;
  privateNote: string;
  internalNote: string;
};

function draftToForm(draft: HostGuestReviewDraft | null): FormState {
  return {
    overallRating: draft?.overallRating ?? 0,
    categories: {
      cleanliness: draft?.cleanlinessRating,
      communication: draft?.communicationRating,
      house_rules: draft?.houseRulesRating,
    },
    wouldHostAgain: draft?.wouldHostAgain ?? null,
    tags: draft ? (draft.overallRating >= 4 ? draft.strengthTags : draft.issueTags) : [],
    reviewText: draft?.reviewText ?? '',
    privateNote: draft?.privateNote ?? '',
    internalNote: draft?.internalNote ?? '',
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  guestName: string;
  draft: HostGuestReviewDraft | null;
};

export function HostGuestReviewSheet({ open, onOpenChange, bookingId, guestName, draft }: Props) {
  const [form, setForm] = useState<FormState>(() => draftToForm(draft));
  const submit = useSubmitHostGuestReview(bookingId);
  const draftAi = useDraftReviewWithAi(bookingId);
  const { canUse: canAutomate } = useFeatureGate('reviewAutomation');
  const { open: openUpgradeModal } = useUpgradeModal();
  const baseline = useMemo(() => JSON.stringify(draftToForm(draft)), [draft]);
  const isDirty = open && JSON.stringify(form) !== baseline;

  // Load the draft on open, and again when it changes, but only while the form is
  // untouched. The draft query refetches in the background; a refetch must never
  // wipe what the host is typing.
  const appliedBaselineRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      appliedBaselineRef.current = null;
      return;
    }
    const previous = appliedBaselineRef.current;
    appliedBaselineRef.current = baseline;
    setForm((prev) =>
      previous === null || JSON.stringify(prev) === previous ? draftToForm(draft) : prev
    );
  }, [open, baseline, draft]);

  const handleSave = async (): Promise<boolean> => {
    if (form.overallRating < 1 || form.overallRating > 5) {
      toast.error('Overall rating is required');
      return false;
    }
    if (!isHostCategoryRatingsComplete(form.categories)) {
      toast.error('All category ratings are required');
      return false;
    }
    if (typeof form.wouldHostAgain !== 'boolean') {
      toast.error('Would host again is required');
      return false;
    }
    if (hostReviewTextRequired(form.overallRating, form.reviewText)) {
      toast.error(
        `Add at least ${HOST_REVIEW_TEXT_MIN_WHEN_LOW} characters when the overall is 3 or below`
      );
      return false;
    }
    try {
      await submit.mutateAsync({
        overallRating: form.overallRating,
        cleanlinessRating: form.categories.cleanliness as number,
        communicationRating: form.categories.communication as number,
        houseRulesRating: form.categories.house_rules as number,
        wouldHostAgain: form.wouldHostAgain,
        strengthTags: form.overallRating >= 4 ? form.tags : [],
        issueTags: form.overallRating >= 4 ? [] : form.tags,
        reviewText: form.reviewText.trim(),
        privateNote: form.privateNote.trim(),
        internalNote: form.internalNote.trim(),
      });
      toast.success(draft ? 'Review updated' : 'Review saved');
      onOpenChange(false);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save review');
      return false;
    }
  };

  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({
    open,
    onOpenChange,
    isDirty,
    onSave: handleSave,
    onDiscard: () => setForm(draftToForm(draft)),
  });

  const tagOptions =
    form.overallRating >= 4
      ? HOST_REVIEW_STRENGTH_TAG_IDS.map((id) => ({
          id,
          label: HOST_REVIEW_STRENGTH_TAG_LABELS[id],
        }))
      : HOST_REVIEW_ISSUE_TAG_IDS.map((id) => ({
          id,
          label: HOST_REVIEW_ISSUE_TAG_LABELS[id],
        }));

  return (
    <>
      <AdminDialogShell
        open={open}
        onOpenChange={guardedOpenChange}
        title={`Review ${guestName}`}
        footer={
          <>
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={requestClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              disabled={draftAi.isPending}
              onClick={() => {
                if (!canAutomate) {
                  openUpgradeModal('reviewAutomation');
                  return;
                }
                void draftAi
                  .mutateAsync('host_review')
                  .then((text) => {
                    setForm((prev) => ({ ...prev, reviewText: text }));
                    toast.success('Draft added');
                  })
                  .catch((err) => {
                    if (err instanceof Error) handleAiMutationError(err);
                    else toast.error('Could not draft review');
                  });
              }}
            >
              {draftAi.isPending ? 'Drafting…' : 'Draft with AI'}
            </Button>
            <Button
              type="button"
              className="min-h-[44px]"
              disabled={submit.isPending}
              onClick={() => void handleSave()}
            >
              {submit.isPending ? 'Saving…' : 'Save review'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-2">
            <GuestReviewStarRating
              value={form.overallRating}
              onChange={(overallRating) =>
                setForm((prev) => ({
                  ...prev,
                  overallRating,
                  tags: overallRating >= 4 === prev.overallRating >= 4 ? prev.tags : [],
                }))
              }
              ariaLabel="Overall rating"
            />
          </div>

          <HostCategoryRatingList
            value={form.categories}
            onChange={(categories) => setForm((prev) => ({ ...prev, categories }))}
          />

          <div className="space-y-2">
            <Label>Would host again</Label>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Would host again">
              {[
                { value: true, label: 'Yes' },
                { value: false, label: 'No' },
              ].map((option) => {
                const selected = form.wouldHostAgain === option.value;
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setForm((prev) => ({ ...prev, wouldHostAgain: option.value }))}
                    className={cn(
                      'min-h-[44px] rounded-lg border text-sm font-medium',
                      selected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-foreground'
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {form.overallRating > 0 ? (
            <TagPicker
              label={form.overallRating >= 4 ? 'Strengths' : 'Issues'}
              options={tagOptions}
              value={form.tags}
              onChange={(tags) => setForm((prev) => ({ ...prev, tags }))}
            />
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="host-review-text">
              {form.overallRating > 0 && form.overallRating <= 3
                ? 'Public review'
                : 'Public review (optional)'}
            </Label>
            <Textarea
              id="host-review-text"
              value={form.reviewText}
              maxLength={REVIEW_TEXT_MAX_LEN}
              onChange={(event) => setForm((prev) => ({ ...prev, reviewText: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="host-review-private">Private note to guest (optional)</Label>
            <Textarea
              id="host-review-private"
              value={form.privateNote}
              maxLength={REVIEW_PRIVATE_NOTE_MAX_LEN}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, privateNote: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="host-review-internal">Team note (optional)</Label>
            <Textarea
              id="host-review-internal"
              value={form.internalNote}
              maxLength={REVIEW_PRIVATE_NOTE_MAX_LEN}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, internalNote: event.target.value }))
              }
            />
          </div>
        </div>
      </AdminDialogShell>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
