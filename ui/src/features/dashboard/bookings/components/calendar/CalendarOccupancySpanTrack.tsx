import type { ReactNode } from 'react';

import type { OccupancySegment } from '@/features/dashboard/bookings/components/calendar/calendarDateUtils';

import { cn } from '@/lib/utils';

const DEFAULT_LANE_HEIGHT_PX = 22;
/** Vertical gap between stacked stay lanes (readable but still dense). */
const LANE_GAP_PX = 5;

type Props<T> = {
  segments: OccupancySegment<T>[];
  getSegmentKey: (segment: OccupancySegment<T>) => string;
  renderSegment: (segment: OccupancySegment<T>) => ReactNode;
  maxLanes?: number;
  /** Override bar row height (mini/dense calendars use shorter lanes). */
  laneHeightPx?: number;
  className?: string;
  hiddenClassName?: string;
  /**
   * `overlay` — absolute inside the week (pills sit in the day cells).
   * `stack` — legacy flow layout below the date row (compact embeds).
   */
  variant?: 'overlay' | 'stack';
  /** Must match the week day-grid gap so multi-day bars align to columns. */
  gapClassName?: string;
  /**
   * Per-column count of stays that did not fit in visible lanes.
   * Used by the month grid to render day-cell `+N` chips.
   */
  onOverflowByCol?: (overflowByCol: number[]) => void;
};

/** Count hidden segments covering each weekday column (lane ≥ maxLanes). */
export function occupancyOverflowByCol<T>(
  segments: OccupancySegment<T>[],
  maxLanes: number
): number[] {
  const counts = Array.from({ length: 7 }, () => 0);
  for (const segment of segments) {
    if (segment.lane < maxLanes) continue;
    for (let col = segment.startCol; col <= segment.endCol; col++) {
      counts[col] += 1;
    }
  }
  return counts;
}

/** Spanning occupancy bars aligned to a 7-column week grid. */
export function CalendarOccupancySpanTrack<T>({
  segments,
  getSegmentKey,
  renderSegment,
  maxLanes = 2,
  laneHeightPx = DEFAULT_LANE_HEIGHT_PX,
  className,
  hiddenClassName,
  variant = 'overlay',
  gapClassName = 'gap-px',
}: Props<T>) {
  if (segments.length === 0) return null;

  const laneCount = Math.max(...segments.map((segment) => segment.lane)) + 1;
  const visibleLanes = Math.min(laneCount, maxLanes);

  const laneOrder = Array.from({ length: visibleLanes }, (_, index) => visibleLanes - 1 - index);
  const lanes = laneOrder.map((lane) =>
    segments.filter((segment) => segment.lane === lane && segment.lane < maxLanes)
  );

  const laneRows = (
    <div className="flex w-full flex-col" style={{ gap: LANE_GAP_PX }}>
      {lanes.map((laneSegments, laneIndex) => (
        <div
          key={laneIndex}
          className={cn('relative grid grid-cols-7', gapClassName)}
          style={{ height: laneHeightPx }}
        >
          {laneSegments.map((segment) => (
            <div
              key={getSegmentKey(segment)}
              className="pointer-events-none flex min-w-0 items-end px-1 sm:px-1.5"
              style={{
                gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}`,
              }}
            >
              <div className="pointer-events-auto min-w-0 flex-1 self-end">
                {renderSegment(segment)}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  if (variant === 'stack') {
    return (
      <div
        className={cn('relative', hiddenClassName, className)}
        role="list"
        aria-label="Stay spans for this week"
      >
        {laneRows}
      </div>
    );
  }

  return (
    <div
      className={cn(
        /* pb-* keeps pills off the cell bottom; top-* clears the date row */
        'pointer-events-none absolute inset-x-0 bottom-0 top-6 z-10 flex flex-col justify-end pb-4 sm:top-7 sm:pb-[1.125rem]',
        hiddenClassName,
        className
      )}
      role="list"
      aria-label="Stay spans for this week"
    >
      {laneRows}
    </div>
  );
}
