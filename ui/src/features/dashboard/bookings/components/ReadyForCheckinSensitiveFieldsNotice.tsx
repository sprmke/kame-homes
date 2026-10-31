import { AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';

type Props = {
  /**
   * True when the booking is in a revert-eligible pipeline stage and the edit
   * draft differs from the server on at least one workflow-sensitive field.
   */
  visible: boolean;
  className?: string;
};

/**
 * Inline warning on **Edit Booking**: saving will set status to Pending Review
 * when `visible` is true. No copy when the draft matches the server.
 */
export function ReadyForCheckinSensitiveFieldsNotice({ visible, className }: Props) {
  if (!visible) return null;

  return (
    <div
      role="alert"
      className={cn(
        'flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 dark:border-amber-500/30 dark:bg-amber-500/10',
        className
      )}
    >
      <AlertTriangle
        className="mt-0.5 size-4 shrink-0 text-amber-600 sm:size-[18px] dark:text-amber-400"
        aria-hidden
      />
      <p className="min-w-0 text-[13px] leading-snug text-amber-950 sm:text-sm dark:text-amber-100">
        You changed fields that need re-approval. Saving returns this booking to{' '}
        <span className="font-semibold">Pending Review</span> status.
      </p>
    </div>
  );
}
