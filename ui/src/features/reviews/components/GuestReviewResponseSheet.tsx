import { useEffect, useMemo, useState } from 'react';

import { toast } from 'sonner';

import { GuestDialogShell } from '@/features/guest/marketing/shared/components/GuestDialogShell';

import { useRespondToHostReview } from '@/features/reviews/hooks/useGuestMyReviews';
import { REVIEW_RESPONSE_MAX_LEN } from '@/features/reviews/lib/reviewCatalog';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useGuardedClose } from '@/hooks/useGuardedClose';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  existingText: string | null;
};

export function GuestReviewResponseSheet({ open, onOpenChange, bookingId, existingText }: Props) {
  const [text, setText] = useState(existingText ?? '');
  const submit = useRespondToHostReview();
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
      <GuestDialogShell
        open={open}
        onOpenChange={guardedOpenChange}
        title="Respond"
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
                      toast.error(err instanceof Error ? err.message : 'Could not save response');
                    });
                }}
              >
                Remove
              </Button>
            ) : null}
            <Button
              type="button"
              className="min-h-[44px]"
              disabled={submit.isPending}
              onClick={() => void handleSave()}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="guest-host-review-response">Public response</Label>
          <Textarea
            id="guest-host-review-response"
            value={text}
            maxLength={REVIEW_RESPONSE_MAX_LEN}
            onChange={(event) => setText(event.target.value)}
          />
          <p className="text-muted-foreground text-xs tabular-nums">
            {text.trim().length}/{REVIEW_RESPONSE_MAX_LEN}
          </p>
        </div>
      </GuestDialogShell>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
