/**
 * Stage-deck navigator — the compact replacement for the full vertical progress
 * stepper at the top of the booking detail rail.
 *
 * Two facts share this header and must never be confused for each other:
 *
 * - **Where the booking is.** Carried by color: the live stage's dot uses that
 *   status's own tone (the same red / yellow / green language as `StatusBadge`
 *   everywhere else) and pulses. It does not move while the host browses.
 * - **What the host is looking at.** Carried by the ring around a dot and the
 *   stage name (with a check when the stage is behind the live one).
 *
 * Both markers land on the same dot in the resting case, so the pair only reads
 * as two things once the host actually navigates away — which is exactly when
 * the distinction matters.
 *
 * Track dots are buttons: any reached stage is one click away, so browsing does
 * not require walking the arrows. Arrows and dots only move the view. Forward is
 * capped at the booking's live stage. Real status transitions live in the footer
 * actions bar, which is styled and placed differently on purpose.
 */

import { useRef, useState } from 'react';

import { Check, ChevronLeft, ChevronRight, ListChecks } from 'lucide-react';

import { statusToneStyle } from '@/features/dashboard/bookings/components/StatusBadge';
import { statusLabel, type BookingStatus } from '@/features/dashboard/bookings/lib/bookingStatus';
import {
  stageDeckStepState,
  type StageDeckStepState,
} from '@/features/dashboard/bookings/lib/workflowStageDeck';

import { cn } from '@/lib/utils';

type Props = {
  stages: BookingStatus[];
  viewedIndex: number;
  currentIndex: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  disabled?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelectIndex: (index: number) => void;
  onOpenMap: () => void;
};

const arrowClass =
  'flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30 lg:size-9';

/** Reading of a stage relative to the booking — used on track-dot titles. */
const STATE_WORD: Record<StageDeckStepState, string> = {
  done: 'Completed',
  current: 'Current',
  upcoming: 'Not reached',
};

export function WorkflowStageDeckHeader({
  stages,
  viewedIndex,
  currentIndex,
  canGoPrev,
  canGoNext,
  disabled,
  onPrev,
  onNext,
  onSelectIndex,
  onOpenMap,
}: Props) {
  // The step name travels with the panel below it. Without this the label swaps
  // instantly while the body slides, and the two read as unrelated events.
  const [labelTrack, setLabelTrack] = useState({ index: viewedIndex, forward: true });
  const isFirstRender = useRef(true);
  if (labelTrack.index !== viewedIndex) {
    setLabelTrack({ index: viewedIndex, forward: viewedIndex >= labelTrack.index });
  }
  const animateLabel = !isFirstRender.current;
  isFirstRender.current = false;

  const viewedStage = stages[viewedIndex];
  if (!viewedStage) return null;

  const viewedState = stageDeckStepState(viewedIndex, currentIndex);
  const viewedTone = statusToneStyle(viewedStage);

  return (
    <section
      className="border-separator shrink-0 border-b px-3 py-3 sm:px-4"
      aria-label="Booking progress"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-overline">
          Step {viewedIndex + 1} of {stages.length}
        </p>
        <button
          type="button"
          onClick={onOpenMap}
          aria-label="View all steps"
          title="View all steps"
          className="text-muted-foreground hover:bg-muted hover:text-foreground focus-ring -mr-1.5 flex size-9 items-center justify-center rounded-lg transition-colors"
        >
          <ListChecks className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-0.5 flex items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          disabled={disabled || !canGoPrev}
          aria-label="Previous step"
          className={cn(arrowClass, 'focus-ring')}
        >
          <ChevronLeft className="size-4.5" aria-hidden />
        </button>

        <div
          key={viewedIndex}
          className={cn(
            'min-w-0 flex-1 overflow-hidden',
            animateLabel &&
              (labelTrack.forward
                ? 'motion-safe:animate-stage-label-in-forward'
                : 'motion-safe:animate-stage-label-in-back')
          )}
        >
          <h2 className="flex items-center justify-center gap-1.5">
            {viewedState === 'done' ? (
              <span
                aria-hidden
                className="gradient-primary text-primary-foreground flex size-4 shrink-0 items-center justify-center rounded-full"
              >
                <Check className="size-2.5" strokeWidth={3} />
              </span>
            ) : (
              <span
                aria-hidden
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  viewedTone.dot,
                  viewedTone.pulse && 'motion-safe:animate-pulse'
                )}
              />
            )}
            <span className="text-foreground truncate text-sm font-semibold leading-tight">
              {statusLabel(viewedStage)}
            </span>
          </h2>
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={disabled || !canGoNext}
          aria-label="Next step"
          title={!canGoNext && viewedIndex >= currentIndex ? 'Not reached yet' : undefined}
          className={cn(arrowClass, 'focus-ring')}
        >
          <ChevronRight className="size-4.5" aria-hidden />
        </button>
      </div>

      <ol className="mt-1.5 flex items-center" aria-label="All steps">
        {stages.map((stage, i) => {
          const state = stageDeckStepState(i, currentIndex);
          const tone = statusToneStyle(stage);
          const reachable = state !== 'upcoming';
          // The halo already says "the booking is here", so the browsing ring is
          // only drawn once the two markers have actually come apart.
          const ringViewed = i === viewedIndex && state !== 'current';
          const name = `${statusLabel(stage)}: ${STATE_WORD[state]}`;

          const dot =
            state === 'current' ? (
              // Size, not hue, separates the live stage — its tone can be the same
              // teal a completed dot already uses (Ready for Check-in).
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full border',
                  tone.badge
                )}
              >
                <span
                  className={cn(
                    'size-2 rounded-full',
                    tone.dot,
                    tone.pulse && 'motion-safe:animate-pulse'
                  )}
                />
              </span>
            ) : (
              <span
                className={cn(
                  'size-2 rounded-full transition-transform duration-200',
                  ringViewed && 'ring-foreground/30 ring-offset-card ring-2 ring-offset-2',
                  state === 'done'
                    ? 'gradient-primary group-hover:scale-125'
                    : 'border-border bg-card border'
                )}
              />
            );

          return (
            <li key={stage} className={cn('flex items-center', i > 0 && 'min-w-0 flex-1')}>
              {i > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    'h-0.5 min-w-[6px] flex-1 rounded-full',
                    state === 'upcoming' ? 'bg-muted' : 'bg-primary/40'
                  )}
                />
              ) : null}
              {reachable ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectIndex(i)}
                  aria-current={i === viewedIndex ? 'step' : undefined}
                  aria-label={name}
                  title={name}
                  className="focus-ring group flex h-8 shrink-0 items-center justify-center rounded-full px-1.5 disabled:pointer-events-none"
                >
                  {dot}
                </button>
              ) : (
                <span
                  role="img"
                  aria-label={name}
                  title={name}
                  className="flex h-8 shrink-0 items-center justify-center px-1.5"
                >
                  {dot}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
