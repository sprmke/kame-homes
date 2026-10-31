/**
 * Booking AI summary modal — idle / running / results.
 * No progress stepper: polling mid-run is unreliable, so the running state shows the
 * shape of the answer (the same rows, scanned by a moving beam) rather than claiming
 * per-section progress it cannot know.
 */

import { useEffect, useMemo } from 'react';

import { RotateCcw, Sparkles, X } from 'lucide-react';
import { createPortal } from 'react-dom';

import {
  AI_SUMMARY_SECTIONS,
  BookingAiSummaryResultsList,
  visibleAiSummarySections,
  type AiSummarySectionDef,
} from '@/features/dashboard/bookings/components/booking-detail/BookingAiSummaryResults';
import { useBookingAiReview } from '@/features/dashboard/bookings/hooks/useBookingAiReview';
import { useBookingAiReviewTrigger } from '@/features/dashboard/bookings/hooks/useBookingAiReviewTrigger';
import type { BookingAssetPreviewHandler } from '@/features/dashboard/bookings/hooks/useBookingAssetPreview';
import {
  canRefreshBookingAiReview,
  isBookingAiReviewRunning,
  isStuckProcessingReview,
} from '@/features/dashboard/bookings/lib/bookingAiReviewProgress';
import type {
  BookingAiReview,
  BookingAiReviewSectionStatus,
  BookingRow,
} from '@/features/dashboard/bookings/lib/types';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { cn } from '@/lib/utils';

function ScopeLine({ sections }: { sections: AiSummarySectionDef[] }) {
  return (
    <p className="text-muted-foreground mt-2 text-[13px] leading-relaxed">
      {sections.map((s) => s.label).join(' · ')}
    </p>
  );
}

function IdlePanel({ sections }: { sections: AiSummarySectionDef[] }) {
  return (
    <div className="flex flex-col items-center px-2 py-8 text-center sm:py-10">
      <div className="from-primary/15 to-primary/5 text-primary mb-4 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br">
        <Sparkles className="size-5" aria-hidden />
      </div>
      <p className="text-foreground text-sm font-semibold">Ready to review</p>
      <ScopeLine sections={sections} />
    </div>
  );
}

/** Varied line lengths per row so the wait doesn't read as a stack of identical bars. */
const PLACEHOLDER_WIDTHS = ['72%', '58%', '81%', '64%', '76%'];

/**
 * The wait is the shape of the answer: the same rows the results will occupy, with one
 * light sweeping down them. Mid-run polling is unreliable, so there is no progress to
 * report — only that work is moving.
 */
function RunningPanel({ sections }: { sections: AiSummarySectionDef[] }) {
  return (
    <div
      className="border-border relative overflow-hidden rounded-lg border"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">
        Checking {sections.map((s) => s.label).join(', ')}. Results appear when the run finishes.
      </span>

      <div className="divide-border divide-y">
        {sections.map((section, index) => {
          const SectionIcon = section.icon;
          return (
            <div key={section.id} className="flex">
              <div className="min-w-0 flex-1 px-3.5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <SectionIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    <h4 className="text-foreground truncate text-sm font-semibold tracking-tight">
                      {section.label}
                    </h4>
                  </div>
                  <span className="bg-muted h-5 w-24 shrink-0 rounded-full sm:hidden" aria-hidden />
                </div>
                <div className="mt-1.5 pl-6 pt-0.5">
                  <span
                    className="bg-muted block h-3.5 rounded-full"
                    style={{ width: PLACEHOLDER_WIDTHS[index % PLACEHOLDER_WIDTHS.length] }}
                    aria-hidden
                  />
                </div>
              </div>
              <div
                className={cn(
                  'border-border bg-muted/30 hidden w-[104px] shrink-0 flex-col items-center justify-center gap-1.5 border-l px-2 py-3.5 sm:flex'
                )}
              >
                <span className="bg-muted size-8 rounded-full" aria-hidden />
                <span className="bg-muted h-3 w-14 rounded-full" aria-hidden />
              </div>
            </div>
          );
        })}
      </div>

      <span
        className="animate-ai-scan pointer-events-none absolute inset-x-0 -top-1/4 h-1/4"
        aria-hidden
      >
        <span className="absolute inset-0 bg-[linear-gradient(180deg,transparent,hsl(var(--primary)/0.16))]" />
        <span className="bg-primary/45 absolute inset-x-0 bottom-0 h-px" />
      </span>
    </div>
  );
}

function hasAnySectionResult(
  review: BookingAiReview | null | undefined,
  sections: AiSummarySectionDef[]
): boolean {
  if (!review) return false;
  return sections.some((s) => {
    const status =
      (review[`${s.id}_status` as keyof BookingAiReview] as BookingAiReviewSectionStatus) ??
      'pending';
    return status === 'completed' || status === 'failed' || status === 'skipped';
  });
}

type Props = {
  booking: BookingRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Enables in-sentence document links — omit and findings stay plain text. */
  onPreview?: BookingAssetPreviewHandler;
};

export function BookingAiSummaryPanel({ booking, open, onOpenChange, onPreview }: Props) {
  const { data: review } = useBookingAiReview(booking.id);
  const trigger = useBookingAiReviewTrigger(booking.id, () => undefined);
  const { canUse: canRunAiValidation, isLoading: entitlementsLoading } =
    useFeatureGate('aiValidations');
  const { open: openUpgradeModal } = useUpgradeModal();

  const runAiReview = () => {
    if (!canRunAiValidation) {
      if (!entitlementsLoading) openUpgradeModal('aiValidations');
      return;
    }
    trigger.mutate();
  };

  const isStuck = isStuckProcessingReview(review);
  const isRunning = isBookingAiReviewRunning(review, trigger.isPending);

  const visibleSections = useMemo(() => visibleAiSummarySections(booking), [booking]);

  const showResults = hasAnySectionResult(review, visibleSections) && !isRunning;
  const canRefresh = canRefreshBookingAiReview(review, trigger.isPending);
  // First run, or an opt-in refresh after inputs drifted / the first attempt failed.
  const canTriggerRun = !isRunning && (!showResults || canRefresh);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      /* Same band as Dialog / WorkflowConfirmModal (z-100). Upgrade modal is z-110+ so it stacks on top. */
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-3 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-ai-summary-title"
        className="border-border bg-card flex max-h-[min(92dvh,calc(100dvh-1.5rem))] w-full max-w-[min(calc(100vw-1.5rem),32rem)] flex-col overflow-hidden rounded-xl border shadow-2xl sm:max-w-[min(calc(100vw-2rem),44rem)]"
      >
        <header className="border-border flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 id="booking-ai-summary-title" className="text-foreground text-base font-semibold">
                AI Summary
              </h3>
              <TierBadge feature="aiValidations" />
            </div>
            <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
              AI will review the booking details, documents, and receipts, and highlights anything
              that needs attention.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:bg-muted hover:text-foreground focus-ring -mr-1 flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5">
          {isStuck && !isRunning ? (
            <div className="border-destructive/25 bg-destructive/10 text-destructive mb-3 rounded-lg border px-3 py-2.5 text-sm">
              Checks did not finish. Try again.
            </div>
          ) : null}

          {isRunning ? (
            <RunningPanel sections={visibleSections} />
          ) : showResults ? (
            <BookingAiSummaryResultsList
              booking={booking}
              review={review}
              onPreview={onPreview}
              animateEntrance
            />
          ) : (
            <IdlePanel sections={visibleSections} />
          )}
        </div>

        <div className="border-border shrink-0 border-t px-4 py-3 sm:px-5">
          {showResults && !canRefresh ? (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="border-border text-foreground hover:bg-muted focus-ring inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border bg-transparent text-sm font-semibold transition-colors motion-safe:active:scale-[0.98]"
            >
              Got it
            </button>
          ) : (
            <button
              type="button"
              onClick={runAiReview}
              disabled={!canTriggerRun}
              aria-busy={isRunning || undefined}
              className={cn(
                'inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all duration-200 motion-safe:active:scale-[0.98]',
                isRunning
                  ? 'border-border bg-muted/50 text-muted-foreground cursor-default border font-semibold'
                  : 'disabled:opacity-50',
                !isRunning &&
                  (isStuck
                    ? 'border-border text-foreground hover:bg-muted border bg-transparent font-medium'
                    : 'gradient-primary text-primary-foreground shadow-soft hover:shadow-primary-glow hover:brightness-[1.03]')
              )}
            >
              {isRunning ? (
                'Checking booking details…'
              ) : isStuck ? (
                'Try again'
              ) : canRefresh ? (
                <>
                  <RotateCcw className="size-4" aria-hidden />
                  Recheck
                </>
              ) : (
                <>
                  <Sparkles className="size-4" aria-hidden />
                  Run checks
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Exported for tests / idle scope copy — same section set as the results list. */
export { AI_SUMMARY_SECTIONS };
