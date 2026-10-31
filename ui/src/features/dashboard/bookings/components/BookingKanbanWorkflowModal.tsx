import { useEffect, useId, useState } from 'react';

import { X } from 'lucide-react';

import { BookingDetailAssetPreviewModal } from '@/features/dashboard/bookings/components/booking-detail/BookingDetailAssetPreviewModal';
import { WorkflowPanel } from '@/features/dashboard/bookings/components/workflow-panel/WorkflowPanel';
import { useBooking } from '@/features/dashboard/bookings/hooks/useBooking';
import { useBookingAssetPreview } from '@/features/dashboard/bookings/hooks/useBookingAssetPreview';
import { statusLabel, type BookingStatus } from '@/features/dashboard/bookings/lib/bookingStatus';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { WorkflowSheetSkeleton } from '@/components/skeletons/AdminSkeletons';
import { cn } from '@/lib/utils';

type Props = {
  bookingId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Kanban column drop target — skips the workflow shell and opens confirm or required form. */
  targetStatus?: BookingStatus | null;
  /** Optional list row for instant header while detail loads. */
  previewRow?: BookingRow | null;
  /** When false, Progress actions are read-only (`bookings.detail.workflow:edit`). */
  canMutate?: boolean;
};

function modalGuestName(row: BookingRow | null): string {
  if (!row) return 'Booking';
  return row.primary_guest_name || row.guest_facebook_name || row.guest_email || 'Guest';
}

/**
 * Single custom shell for click + drop (no nested Radix dialog chrome).
 * Drop confirm-only hides the shell via CSS so `WorkflowPanel` never remounts
 * (pricing / balance drafts stay intact) while `WorkflowConfirmModal` portals cleanly.
 */
export function BookingKanbanWorkflowModal({
  bookingId,
  open,
  onOpenChange,
  targetStatus = null,
  previewRow,
  canMutate = true,
}: Props) {
  const titleId = useId();
  const [dropShellHidden, setDropShellHidden] = useState(false);
  const {
    data: booking,
    isLoading,
    error,
  } = useBooking(open ? (bookingId ?? undefined) : undefined);
  const { previewAsset, previewLoading, handlePreview, closePreview } = useBookingAssetPreview();
  const displayRow = booking ?? previewRow ?? null;
  const isDropTransition = !!targetStatus;
  const shellVisible = open && !(isDropTransition && dropShellHidden);

  useEffect(() => {
    if (!open) setDropShellHidden(false);
  }, [open]);

  useEffect(() => {
    if (!shellVisible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shellVisible, onOpenChange]);

  const handleClose = () => onOpenChange(false);

  if (!open) return null;

  const title = modalGuestName(displayRow);
  const subtitle = targetStatus
    ? statusLabel(targetStatus)
    : displayRow?.status
      ? statusLabel(displayRow.status as BookingStatus)
      : null;

  const workflowPanel =
    booking && displayRow ? (
      <WorkflowPanel
        booking={booking}
        variant="modal"
        kanbanTargetStatus={targetStatus}
        onKanbanFlowClose={handleClose}
        onKanbanShellHidden={isDropTransition ? setDropShellHidden : undefined}
        onPreview={handlePreview}
        canMutate={canMutate}
      />
    ) : null;

  return (
    <>
      {shellVisible ? (
        <button
          type="button"
          aria-label="Close"
          className="modal-scrim fixed inset-0 z-[100]"
          onClick={handleClose}
        />
      ) : null}

      <div
        className={cn(
          'fixed z-[101] flex justify-center',
          shellVisible
            ? 'inset-0 items-end p-0 sm:items-center sm:p-4'
            : 'pointer-events-none left-0 top-0 size-0 overflow-hidden opacity-0'
        )}
        aria-hidden={!shellVisible}
      >
        <div
          role="dialog"
          aria-modal={shellVisible || undefined}
          aria-labelledby={titleId}
          className={cn(
            'bg-card flex w-full flex-col overflow-hidden border',
            shellVisible
              ? 'shadow-elevated-lg max-h-[min(92dvh,40rem)] max-w-[min(calc(100vw-1.5rem),32rem)] rounded-t-2xl sm:max-w-lg sm:rounded-xl'
              : 'max-h-0 max-w-0 border-0 shadow-none'
          )}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {shellVisible ? (
            <header className="border-separator flex shrink-0 items-start gap-3 border-b px-4 py-3.5 sm:px-5">
              <div className="min-w-0 flex-1 pt-0.5">
                <h2
                  id={titleId}
                  className="text-foreground truncate text-base font-bold tracking-tight sm:text-lg"
                >
                  {title}
                </h2>
                {subtitle ? (
                  <p className="text-muted-foreground mt-0.5 truncate text-sm">{subtitle}</p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={handleClose}
                className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring inline-flex size-11 shrink-0 items-center justify-center rounded-xl outline-none focus-visible:ring-2"
              >
                <X className="size-5" aria-hidden />
              </button>
            </header>
          ) : null}

          <div
            className={cn(
              'flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden',
              !shellVisible && 'sr-only'
            )}
          >
            {isLoading && !displayRow ? (
              <div className="flex-1 p-4 sm:p-5">
                <WorkflowSheetSkeleton />
              </div>
            ) : null}

            {error && !booking ? (
              <div className="text-destructive flex flex-1 items-center justify-center px-4 py-8 text-center text-sm sm:px-5">
                Could not load booking.
              </div>
            ) : null}

            {workflowPanel}
          </div>
        </div>
      </div>

      <BookingDetailAssetPreviewModal
        asset={previewAsset}
        booking={booking ?? null}
        isReceiptAiBackfilling={false}
        loading={previewLoading}
        onClose={closePreview}
      />
    </>
  );
}
