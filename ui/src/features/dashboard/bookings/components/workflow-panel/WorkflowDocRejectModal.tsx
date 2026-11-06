/**
 * Reject sheet for an approved GAF / pet PDF.
 *
 * Opened from the Pending Docs row **Reject document** action. Clears the file
 * and sets the nested step back to awaiting, with a reason stored on the
 * completion entry so the row can show what was rejected and why.
 */

import { useEffect, useId, useState } from 'react';

import { Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { useReviewBookingDocument } from '@/features/dashboard/bookings/hooks/useReviewBookingDocument';
import type { DocumentRequirement } from '@/features/dashboard/bookings/lib/documentRequirements';
import {
  DOC_REJECTION_REASON_LABELS,
  DOC_REJECTION_REASONS,
  type DocRejectionReason,
} from '@/features/dashboard/bookings/lib/documentReview';
import {
  approvedPdfUploadLabel,
  pendingDocStepApprovalAsset,
} from '@/features/dashboard/bookings/lib/pendingDocApproval';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import type { PendingDocNestedKey } from '@/features/dashboard/bookings/lib/workflow';
import type { EdgeCallError } from '@/features/dashboard/org/lib/edgeClient';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { Textarea } from '@/components/ui/textarea';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  booking: BookingRow;
  sub: PendingDocNestedKey;
  requirements: DocumentRequirement[];
  onClose: () => void;
};

export function WorkflowDocRejectModal({ open, booking, sub, requirements, onClose }: Props) {
  const fieldId = useId();
  const assetType = pendingDocStepApprovalAsset(sub, requirements);
  const documentLabel = assetType ? approvedPdfUploadLabel(assetType) : 'document';

  const [reason, setReason] = useState<DocRejectionReason | null>(null);
  const [note, setNote] = useState('');

  const rejectMut = useReviewBookingDocument();
  const busy = rejectMut.isPending;

  useEffect(() => {
    if (!open) return;
    setReason(null);
    setNote('');
  }, [open]);

  const { onOpenChange, requestClose, dialogProps } = useGuardedClose({
    open,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
    isDirty: Boolean(reason) || note.trim().length > 0,
    enabled: !busy,
  });

  if (!open || !assetType) return null;
  const rejectAssetType: 'approved_gaf' | 'approved_pet' = assetType;

  async function handleReject() {
    if (!reason || busy) return;
    try {
      await rejectMut.mutateAsync({
        bookingId: booking.id,
        requirementId: sub,
        assetType: rejectAssetType,
        reason,
        note,
      });
      toast.success(`${documentLabel} rejected`);
      onClose();
    } catch (err) {
      const retryAfterSec = (err as EdgeCallError).retryAfterSec;
      toast.error(
        retryAfterSec
          ? `Too many attempts. Try again in ${retryAfterSec}s.`
          : friendlyToastError(err, 'Could not reject document')
      );
    }
  }

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={onOpenChange}>
        <ResponsiveModalContent
          disableDrag={busy}
          overlayClassName="z-[150]"
          className="z-[150] w-[min(calc(100vw-1.5rem),28rem)] max-w-none sm:max-w-[min(90vw,28rem)]"
        >
          <ResponsiveModalHeader className="space-y-0 text-left">
            <div className="flex items-start gap-3">
              <div className="bg-destructive/10 text-destructive flex size-10 shrink-0 items-center justify-center rounded-xl">
                <XCircle className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 pt-0.5">
                <ResponsiveModalTitle className="text-base font-semibold leading-snug sm:text-lg">
                  Reject {documentLabel}
                </ResponsiveModalTitle>
                <ResponsiveModalDescription className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  Removes the file and sets this step back to awaiting.
                </ResponsiveModalDescription>
              </div>
            </div>
          </ResponsiveModalHeader>

          <div className="space-y-4">
            <fieldset className="min-w-0 space-y-2">
              <legend className="text-foreground text-xs font-semibold">Reason</legend>
              <RadioGroup
                value={reason ?? ''}
                onValueChange={(value) => setReason(value as DocRejectionReason)}
                disabled={busy}
                className="gap-1"
              >
                {DOC_REJECTION_REASONS.map((id) => (
                  <label
                    key={id}
                    htmlFor={`${fieldId}-${id}`}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors',
                      reason === id
                        ? 'border-primary/60 bg-primary/5 text-foreground'
                        : 'border-transparent text-foreground hover:bg-muted'
                    )}
                  >
                    <RadioGroupItem value={id} id={`${fieldId}-${id}`} />
                    <span className="min-w-0 flex-1 truncate">
                      {DOC_REJECTION_REASON_LABELS[id]}
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </fieldset>

            <div className="space-y-2">
              <label htmlFor={`${fieldId}-note`} className="text-foreground text-xs font-semibold">
                Note
              </label>
              <Textarea
                id={`${fieldId}-note`}
                value={note}
                onChange={(event) => setNote(event.target.value.slice(0, 300))}
                placeholder="Optional"
                rows={2}
                disabled={busy}
                className="min-h-16"
              />
            </div>
          </div>

          <ResponsiveModalFooter className="gap-2 pt-1">
            <button
              type="button"
              onClick={requestClose}
              disabled={busy}
              className="focus-ring border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleReject()}
              disabled={!reason || busy}
              aria-busy={busy || undefined}
              className="bg-destructive text-destructive-foreground focus-ring hover:bg-destructive/90 min-h-11 rounded-xl px-5 py-2 text-sm font-bold transition-colors disabled:opacity-50"
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Rejecting…
                </span>
              ) : (
                'Reject document'
              )}
            </button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
