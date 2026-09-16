import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { PlanTierCard } from '@/features/dashboard/plans/components/PlanTierCard';
import type { OrgBundlePlanDto } from '@/features/dashboard/plans/lib/orgPlanApi';
import {
  planTabSectionTitleClass,
  planTierFeatureAreaMinHeight,
  type PlanTier,
} from '@/features/dashboard/plans/lib/planPresentation';

import { cn } from '@/lib/utils';

type PlanTierRailProps = {
  tiers: PlanTier[];
  hasCurrentPlan: boolean;
  canSelect: boolean;
  onSelectPlan: (plan: OrgBundlePlanDto) => void;
};

type CarouselLayout = {
  visibleCount: number;
  gapPx: number;
};

function resolveCarouselLayout(): CarouselLayout {
  // Desktop lg+: 3 · tablet md+: 2 · mobile: 1 — avoids clipping a partial fourth card.
  if (window.matchMedia('(min-width: 1024px)').matches) {
    return { visibleCount: 3, gapPx: 20 };
  }
  if (window.matchMedia('(min-width: 768px)').matches) {
    return { visibleCount: 2, gapPx: 16 };
  }
  return { visibleCount: 1, gapPx: 16 };
}

function useCarouselLayout(): CarouselLayout {
  const [layout, setLayout] = useState<CarouselLayout>(() =>
    typeof window !== 'undefined' ? resolveCarouselLayout() : { visibleCount: 1, gapPx: 16 }
  );

  useEffect(() => {
    const mqMd = window.matchMedia('(min-width: 768px)');
    const mqLg = window.matchMedia('(min-width: 1024px)');

    const sync = () => setLayout(resolveCarouselLayout());

    sync();
    mqMd.addEventListener('change', sync);
    mqLg.addEventListener('change', sync);
    return () => {
      mqMd.removeEventListener('change', sync);
      mqLg.removeEventListener('change', sync);
    };
  }, []);

  return layout;
}

function useSlideStep(trackRef: React.RefObject<HTMLDivElement | null>, enabled: boolean): number {
  const [step, setStep] = useState(0);

  useLayoutEffect(() => {
    if (!enabled) {
      setStep(0);
      return;
    }

    const track = trackRef.current;
    if (!track) return;

    const measure = () => {
      const first = track.children[0] as HTMLElement | undefined;
      const second = track.children[1] as HTMLElement | undefined;
      if (first && second) setStep(second.offsetLeft - first.offsetLeft);
      else if (first) setStep(first.offsetWidth);
      else setStep(0);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [enabled, trackRef]);

  return step;
}

/** Last start index that still fills the viewport (no trailing empty slot). */
function maxFilledStart(tierCount: number, visibleCount: number): number {
  return Math.max(0, tierCount - visibleCount);
}

/** Advance by almost a full page so the last view stays filled (desktop 3→step 2). */
function pageStep(visibleCount: number): number {
  return Math.max(1, visibleCount - 1);
}

/** Keep `focusIndex` in view without leaving an empty trailing slot. */
function clampStartIndex(focusIndex: number, visibleCount: number, tierCount: number): number {
  const maxStart = maxFilledStart(tierCount, visibleCount);
  if (tierCount <= visibleCount) return 0;
  return Math.min(Math.max(0, focusIndex - visibleCount + 1), maxStart);
}

type CarouselArrowProps = {
  direction: 'previous' | 'next';
  disabled: boolean;
  onClick: () => void;
};

function PlanCarouselArrow({ direction, disabled, onClick }: CarouselArrowProps) {
  const label = direction === 'previous' ? 'Previous plans' : 'Next plans';
  const Icon = direction === 'previous' ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      data-carousel-control
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={cn(
        'border-border/80 bg-card text-foreground',
        'flex size-9 shrink-0 items-center justify-center rounded-full border shadow-sm',
        'transition-[background-color,box-shadow,transform] duration-200',
        'hover:bg-muted/50 hover:shadow-md active:scale-95',
        'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-30'
      )}
    >
      <Icon className="size-4" strokeWidth={2} aria-hidden />
    </button>
  );
}

/**
 * Plan tier rail — 1 / 2 / 3 visible cards by breakpoint; arrows advance by pageStep
 * (desktop: 2) so the last view stays filled — no empty trailing slot.
 */
export function PlanTierRail({
  tiers,
  hasCurrentPlan,
  canSelect,
  onSelectPlan,
}: PlanTierRailProps) {
  const { visibleCount, gapPx } = useCarouselLayout();
  const maxStartIndex = maxFilledStart(tiers.length, visibleCount);
  const step = pageStep(visibleCount);
  const trackRef = useRef<HTMLDivElement>(null);

  const focusIndex = Math.max(
    0,
    tiers.findIndex((tier) => tier.isCurrent || tier.isNextStep)
  );
  const initialStartIndex = clampStartIndex(focusIndex, visibleCount, tiers.length);

  const [startIndex, setStartIndex] = useState(initialStartIndex);
  const [isSliding, setIsSliding] = useState(false);

  const showPager = tiers.length > visibleCount;
  const slideStep = useSlideStep(trackRef, showPager);
  const featureAreaMinHeight = planTierFeatureAreaMinHeight(tiers);

  useEffect(() => {
    setStartIndex(clampStartIndex(focusIndex, visibleCount, tiers.length));
  }, [focusIndex, visibleCount, tiers.length]);

  const goToStart = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(0, next), maxStartIndex);
      if (clamped === startIndex) return;
      setIsSliding(true);
      setStartIndex(clamped);
    },
    [maxStartIndex, startIndex]
  );

  useEffect(() => {
    if (!isSliding) return;
    const timer = window.setTimeout(() => setIsSliding(false), 320);
    return () => window.clearTimeout(timer);
  }, [isSliding, startIndex]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (maxStartIndex <= 0) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') goToStart(startIndex - step);
    else goToStart(startIndex + step);
  };

  if (tiers.length === 0) return null;

  const visibleEnd = Math.min(startIndex + visibleCount, tiers.length);
  const positionLabel = `Plans ${startIndex + 1}–${visibleEnd} of ${tiers.length}`;
  const slideBasis = `calc((100% - ${(visibleCount - 1) * gapPx}px) / ${visibleCount})`;
  const translateX = slideStep > 0 ? -startIndex * slideStep : 0;

  return (
    <div className="min-w-0">
      <div className="mb-3 flex min-h-9 items-center justify-between gap-3 sm:mb-4">
        <h2 id="choose-plan-heading" className={cn(planTabSectionTitleClass, 'min-w-0')}>
          Choose your plan
        </h2>
        {showPager ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <PlanCarouselArrow
              direction="previous"
              disabled={startIndex === 0}
              onClick={() => goToStart(startIndex - step)}
            />
            <PlanCarouselArrow
              direction="next"
              disabled={startIndex >= maxStartIndex}
              onClick={() => goToStart(startIndex + step)}
            />
          </div>
        ) : null}
      </div>

      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Subscription plans"
        tabIndex={showPager ? 0 : undefined}
        onKeyDown={onKeyDown}
        className={cn(
          'w-full min-w-0 overflow-hidden',
          showPager &&
            'focus-visible:ring-ring rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
        )}
      >
        <div
          ref={trackRef}
          className={cn(
            'flex touch-pan-y items-stretch',
            'transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
            isSliding && 'will-change-transform'
          )}
          style={{ gap: gapPx, transform: `translate3d(${translateX}px, 0, 0)` }}
        >
          {tiers.map((tier) => (
            <div
              key={tier.plan.id}
              className="flex min-h-0 shrink-0 flex-col self-stretch"
              style={{ flexBasis: slideBasis }}
            >
              <PlanTierCard
                tier={tier}
                hasCurrentPlan={hasCurrentPlan}
                canSelect={canSelect}
                onSelect={() => onSelectPlan(tier.plan)}
                featureAreaMinHeight={featureAreaMinHeight}
              />
            </div>
          ))}
        </div>
      </div>

      {showPager ? (
        <p className="sr-only" aria-live="polite">
          {positionLabel}
        </p>
      ) : null}
    </div>
  );
}
