import type { ReactNode } from 'react';

import type { OccupancySegment } from '@/features/dashboard/bookings/components/calendar/calendarDateUtils';

import { cn } from '@/lib/utils';

const LANE_GAP_PX = 3;

type Props<T> = {
  segments: OccupancySegment<T>[];
  getSegmentKey: (segment: OccupancySegment<T>) => string;
  renderSegment: (segment: OccupancySegment<T>) => ReactNode;
  maxLanes?: number;
  gapClassName?: string;
};

/** Spanning booking pills anchored to the cell bottom (same band as nightly price chips). */
export function PricingCalendarSpanOverlay<T>({
  segments,
  getSegmentKey,
  renderSegment,
  maxLanes = 3,
  gapClassName = 'gap-1.5 sm:gap-2',
}: Props<T>) {
  if (segments.length === 0) return null;

  const laneCount = Math.max(...segments.map((segment) => segment.lane)) + 1;
  const visibleLanes = Math.min(laneCount, maxLanes);

  const laneOrder = Array.from({ length: visibleLanes }, (_, index) => visibleLanes - 1 - index);
  const lanes = laneOrder.map((lane) => segments.filter((segment) => segment.lane === lane));

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-1 top-5 z-10 flex flex-col justify-end sm:bottom-1.5 sm:top-6">
      <div className="flex w-full flex-col" style={{ gap: LANE_GAP_PX }}>
        {lanes.map((laneSegments, laneIndex) => (
          <div
            key={laneIndex}
            className={cn('relative grid h-5 grid-cols-7 sm:h-[22px]', gapClassName)}
          >
            {laneSegments.map((segment) => (
              <div
                key={getSegmentKey(segment)}
                className="pointer-events-none flex min-w-0 items-stretch px-0.5 sm:px-1.5"
                style={{
                  gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}`,
                }}
              >
                {renderSegment(segment)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
