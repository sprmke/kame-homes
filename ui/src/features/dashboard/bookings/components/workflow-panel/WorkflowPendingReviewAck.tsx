/**
 * `PENDING_REVIEW` confirmation — stands in for the stage sub-form and the
 * transition actions bar until the host confirms they read the submission.
 *
 * Manual path: checkbox only. AI path: Run AI check first, then checkbox.
 * Recheck is optional — the checkbox stays available beside it.
 */

import { useEffect, useRef, useState } from 'react';

import { Loader2, RotateCcw, Sparkles } from 'lucide-react';

import { useBookingAiReview } from '@/features/dashboard/bookings/hooks/useBookingAiReview';
import {
  canRefreshBookingAiReview,
  hasBookingAiReviewRun,
  isBookingAiReviewRunning,
} from '@/features/dashboard/bookings/lib/bookingAiReviewProgress';
import { TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SegmentedControl } from '@/components/ui/sliding-tabs';
import { cn } from '@/lib/utils';

/** Long enough for the check to land, short enough to stay a single gesture. */
const CONFIRM_SETTLE_MS = 200;

const MANUAL_ACK_LABEL =
  'I manually reviewed and confirmed that all details, documents, and receipts are correct.';

const AI_ACK_LABEL = 'I reviewed the AI results and confirm this booking is ready to proceed.';

const REVIEW_METHOD_LABEL = 'How Would You Like to Review?';

type ReviewMethod = 'manual' | 'ai';

type Props = {
  bookingId: string;
  isModal: boolean;
  onConfirm: () => void;
  onOpenAiSummary?: () => void;
};

export function WorkflowPendingReviewAck({
  bookingId,
  isModal,
  onConfirm,
  onOpenAiSummary,
}: Props) {
  const showAiPath = Boolean(onOpenAiSummary);
  const { data: review } = useBookingAiReview(showAiPath ? bookingId : null);

  const [method, setMethod] = useState<ReviewMethod>('manual');
  const [checked, setChecked] = useState(false);

  const hasAiRun = hasBookingAiReviewRun(review);
  const isAiRunning = isBookingAiReviewRunning(review, false);
  const needsAiRefresh = canRefreshBookingAiReview(review);

  const checkboxId = `pending-review-ack-${bookingId}`;

  const onConfirmRef = useRef(onConfirm);
  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  useEffect(() => {
    if (!checked) return;
    const timer = window.setTimeout(() => onConfirmRef.current(), CONFIRM_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [checked]);

  useEffect(() => {
    setChecked(false);
  }, [method]);

  const ackLabel = method === 'ai' && showAiPath ? AI_ACK_LABEL : MANUAL_ACK_LABEL;
  const showRunAiButton =
    method === 'ai' && showAiPath && (!hasAiRun || needsAiRefresh || isAiRunning);
  const showAckCheckbox = method === 'manual' || !showAiPath || hasAiRun;

  return (
    <div
      className={cn(isModal ? 'min-h-0 flex-1 overflow-x-hidden px-4 py-4 sm:px-5' : 'px-4 py-4')}
    >
      <div className="border-border/80 bg-card overflow-hidden rounded-xl border shadow-sm">
        {showAiPath ? (
          <div className="border-border/60 border-b px-3 py-3">
            <p className="text-muted-foreground mb-2 text-sm font-medium">{REVIEW_METHOD_LABEL}</p>
            <SegmentedControl
              value={method}
              onChange={setMethod}
              size="dense"
              fullWidth
              aria-label={REVIEW_METHOD_LABEL}
              options={[
                { value: 'manual', label: 'Manual' },
                { value: 'ai', label: 'AI check', icon: Sparkles },
              ]}
            />
          </div>
        ) : null}

        <div className="space-y-3 px-4 py-4">
          {showRunAiButton ? (
            <TierBadgeAnchor feature="aiValidations" className="w-full">
              <Button
                type="button"
                variant={hasAiRun ? 'outline' : 'default'}
                className="min-h-[44px] w-full"
                onClick={onOpenAiSummary}
              >
                {isAiRunning ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    View check progress
                  </>
                ) : (
                  <>
                    {hasAiRun ? (
                      <RotateCcw className="size-4" aria-hidden />
                    ) : (
                      <Sparkles className="size-4" aria-hidden />
                    )}
                    {hasAiRun ? 'Recheck' : 'Run AI check'}
                  </>
                )}
              </Button>
            </TierBadgeAnchor>
          ) : null}

          {showAckCheckbox ? (
            <label
              htmlFor={checkboxId}
              className={cn(
                'flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors',
                'border-amber-500/25 bg-amber-500/[0.06] hover:bg-amber-500/[0.1]',
                'dark:border-amber-500/30 dark:bg-amber-500/[0.08] dark:hover:bg-amber-500/[0.12]'
              )}
            >
              <Checkbox
                id={checkboxId}
                checked={checked}
                onCheckedChange={(value) => {
                  if (value === true) setChecked(true);
                }}
                className="mt-0.5"
              />
              <span className="min-w-0 text-[13px] font-medium leading-snug text-amber-950 dark:text-amber-100">
                {ackLabel}
              </span>
            </label>
          ) : null}
        </div>
      </div>
    </div>
  );
}
