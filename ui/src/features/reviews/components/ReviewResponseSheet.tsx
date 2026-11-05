import { useEffect, useMemo, useState } from 'react';

import { toast } from 'sonner';

import { handleAiMutationError } from '@/features/dashboard/org/lib/aiQuotaToast';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { useRespondToGuestReview } from '@/features/reviews/hooks/usePropertyReviews';
import { useDraftReviewWithAi } from '@/features/reviews/hooks/useReviewAutomation';
import { REVIEW_RESPONSE_MAX_LEN } from '@/features/reviews/lib/reviewCatalog';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useGuardedClose } from '@/hooks/useGuardedClose';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  guestName: string;
  existingText: string | null;
};

export function ReviewResponseSheet({
  open,
  onOpenChange,
  bookingId,
  guestName,
  existingText,
}: Props) {
  const [text, setText] = useState(existingText ?? '');
  const submit = useRespondToGuestReview();
  const draftAi = useDraftReviewWithAi(bookingId);
  const { canUse: canAutomate } = useFeatureGate('reviewAutomation');
  const { open: openUpgradeModal } = useUpgradeModal();
  const baseline = useMemo(() => existingText ?? '', [existingText]);
  const isDirty = open && text !== baseline;

  useEffect(() => {
    if (open) setText(existingText ?? '');
  }, [open, existingText]);

  const handleSave = async (): Promise<boolean> => {
    const trimmed = text.trim();
    if (trimmed.length > REVIEW_RESPONSE_MAX_LEN) {
      toast.error(`Response must be ${REVIEW_RESPONSE_MAX_LEN} characters or fewer`);
      return false;
    }
    try {
      await submit.mutateAsync({ bookingId, responseText: trimmed || null });
      toast.success(trimmed ? 'Response saved' : 'Response removed');
      onOpenChange(false);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save response');
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
    onDiscard: () => setText(baseline),
  });

  return (
    <>
      <AdminDialogShell
        open={open}
        onOpenChange={guardedOpenChange}
        title={`Respond to ${guestName}`}
        footer={
          <>
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={requestClose}>
              Cancel
            </Button>
            {existingText ? (
              <Button
                type="button"
                variant="ghost"
                className="min-h-[44px]"
                disabled={submit.isPending}
                onClick={() => {
                  setText('');
                  void submit
                    .mutateAsync({ bookingId, responseText: null })
                    .then(() => {
                      toast.success('Response removed');
                      onOpenChange(false);
                    })
                    .catch((err) => {
                      toast.error(err instanceof Error ? err.message : 'Could not remove response');
                    });
                }}
              >
                Remove
              </Button>
            ) : null}
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
                  .mutateAsync('guest_response')
                  .then((draftText) => {
                    setText(draftText);
                    toast.success('Draft added');
                  })
                  .catch((err) => {
                    if (err instanceof Error) handleAiMutationError(err);
                    else toast.error('Could not draft response');
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
              {submit.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="review-response-text">Public response</Label>
          <Textarea
            id="review-response-text"
            value={text}
            maxLength={REVIEW_RESPONSE_MAX_LEN}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
      </AdminDialogShell>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
