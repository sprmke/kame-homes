import { useEffect, useState } from 'react';

import { toast } from 'sonner';

import { GuestDialogShell } from '@/features/guest/marketing/shared/components/GuestDialogShell';

import { useReportReview } from '@/features/reviews/hooks/usePropertyReviews';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { cn } from '@/lib/utils';

const REASONS = [
  { id: 'not_a_real_stay', label: 'Not a real stay' },
  { id: 'incentive_or_extortion', label: 'Incentive or extortion' },
  { id: 'retaliation', label: 'Retaliation' },
  { id: 'discriminatory', label: 'Discriminatory' },
  { id: 'harassment_or_threat', label: 'Harassment or threat' },
  { id: 'private_information', label: 'Private information' },
  { id: 'irrelevant', label: 'Irrelevant' },
  { id: 'other', label: 'Other' },
] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewKind: 'guest_review' | 'host_guest_review';
  reviewId: string;
  /** Guest-side submit (`/account/reviews`). Defaults to the host report mutation. */
  onSubmit?: (input: {
    reviewKind: 'guest_review' | 'host_guest_review';
    reviewId: string;
    reason: string;
    details: string;
  }) => Promise<unknown>;
  shell?: 'admin' | 'guest';
};

export function ReportReviewSheet({
  open,
  onOpenChange,
  reviewKind,
  reviewId,
  onSubmit,
  shell = 'admin',
}: Props) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const hostSubmit = useReportReview();
  const isDirty = open && (reason !== '' || details !== '');
  const Shell = shell === 'guest' ? GuestDialogShell : AdminDialogShell;

  useEffect(() => {
    if (open) {
      setReason('');
      setDetails('');
    }
  }, [open]);

  const handleSave = async (): Promise<boolean> => {
    if (!reason) {
      toast.error('Pick a reason');
      return false;
    }
    if (details.trim().length < 30) {
      toast.error('Add at least 30 characters of detail');
      return false;
    }
    if (submitting) return false;
    setSubmitting(true);
    try {
      const payload = {
        reviewKind,
        reviewId,
        reason,
        details: details.trim(),
      };
      if (onSubmit) await onSubmit(payload);
      else await hostSubmit.mutateAsync(payload);
      toast.success('Report submitted');
      onOpenChange(false);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit report');
      return false;
    } finally {
      setSubmitting(false);
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
    onDiscard: () => {
      setReason('');
      setDetails('');
    },
  });

  return (
    <>
      <Shell
        open={open}
        onOpenChange={guardedOpenChange}
        title="Report review"
        footer={
          <>
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={requestClose}>
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-[44px]"
              disabled={submitting}
              onClick={() => void handleSave()}
            >
              {submitting ? 'Sending…' : 'Submit report'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Reason">
              {REASONS.map((option) => {
                const selected = reason === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setReason(option.id)}
                    className={cn(
                      'min-h-[44px] rounded-lg border px-3 text-left text-sm font-medium',
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
          <div className="space-y-2">
            <Label htmlFor="review-report-details">Details</Label>
            <Textarea
              id="review-report-details"
              value={details}
              maxLength={2000}
              onChange={(event) => setDetails(event.target.value)}
            />
          </div>
        </div>
      </Shell>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
