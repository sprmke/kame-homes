import { forwardRef, type ReactNode } from 'react';

import { CalendarCanvasFrame } from '@/features/dashboard/marketing/components/calendar-builder/components/CalendarCanvasFrame';
import type { CalendarStyles } from '@/features/dashboard/marketing/components/calendar-builder/types';

type Props = {
  styles: CalendarStyles;
  displayScale: number;
  nativeWidth: number;
  nativeHeight: number;
  children: (calendarSize: number) => ReactNode;
};

/** Scales native export pixels for on-screen preview without reserving full layout height. */
export const CalendarPreviewScaledFrame = forwardRef<HTMLDivElement, Props>(
  function CalendarPreviewScaledFrame(
    { styles, displayScale, nativeWidth, nativeHeight, children },
    ref
  ) {
    const layoutWidth = nativeWidth * displayScale;
    const layoutHeight = nativeHeight * displayScale;

    return (
      <div className="relative shrink-0" style={{ width: layoutWidth, height: layoutHeight }}>
        <div
          style={{
            transform: `scale(${displayScale})`,
            transformOrigin: 'top left',
            width: nativeWidth,
            height: nativeHeight,
          }}
        >
          <CalendarCanvasFrame ref={ref} styles={styles}>
            {children}
          </CalendarCanvasFrame>
        </div>
      </div>
    );
  }
);
