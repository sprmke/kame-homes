import { forwardRef, useCallback, useLayoutEffect, useRef, useState } from 'react';

import { getBackgroundStyle } from '@/features/dashboard/marketing/components/calendar-builder/components/controls/BackgroundControl';
import type { CalendarStyles } from '@/features/dashboard/marketing/components/calendar-builder/types';
import {
  CALENDAR_CANVAS_DIMENSIONS,
  computeCalendarLayoutBounds,
  normalizeCalendarCanvasFrame,
} from '@/features/dashboard/marketing/lib/calendarCanvasFormats';

type Props = {
  styles: CalendarStyles;
  children: (calendarWidth: number) => React.ReactNode;
};

function CalendarContentFit({
  maxWidth,
  maxHeight,
  styles,
  children,
}: {
  maxWidth: number;
  maxHeight: number;
  styles: CalendarStyles;
  children: (calendarWidth: number) => React.ReactNode;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const boundsRef = useRef({ maxWidth, maxHeight });
  boundsRef.current = { maxWidth, maxHeight };

  const measure = useCallback(() => {
    const node = measureRef.current;
    if (!node) return;
    const naturalWidth = node.scrollWidth;
    const naturalHeight = node.scrollHeight;
    if (naturalWidth <= 0 || naturalHeight <= 0) return;
    const { maxWidth: currentMaxWidth, maxHeight: currentMaxHeight } = boundsRef.current;
    const scale = Math.min(1, currentMaxWidth / naturalWidth, currentMaxHeight / naturalHeight);
    setFitScale((prev) => (Math.abs(prev - scale) < 0.001 ? prev : scale));
  }, []);

  // Observer stays alive for the component's lifetime — cheaper than tearing it
  // down and reattaching on every style/bounds change (which only need a remeasure).
  useLayoutEffect(() => {
    const node = measureRef.current;
    if (!node) return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure]);

  useLayoutEffect(() => {
    measure();
  }, [maxWidth, maxHeight, styles, measure]);

  return (
    <div
      style={{
        width: maxWidth,
        height: maxHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: maxWidth,
          transform: fitScale < 1 ? `scale(${fitScale})` : undefined,
          transformOrigin: 'center center',
          flexShrink: 0,
        }}
      >
        <div ref={measureRef}>{children(maxWidth)}</div>
      </div>
    </div>
  );
}

export const CalendarCanvasFrame = forwardRef<HTMLDivElement, Props>(function CalendarCanvasFrame(
  { styles, children },
  ref
) {
  const frame = normalizeCalendarCanvasFrame(styles.canvasFrame);
  const dims = CALENDAR_CANVAS_DIMENSIONS[frame.format];
  const layoutBounds = computeCalendarLayoutBounds(
    dims.width,
    dims.height,
    frame.padding,
    frame.calendarScale
  );

  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        width: dims.width,
        height: dims.height,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: frame.padding,
        overflow: 'hidden',
        flexShrink: 0,
        ...getBackgroundStyle(frame.background),
      }}
    >
      <CalendarContentFit
        maxWidth={layoutBounds.maxWidth}
        maxHeight={layoutBounds.maxHeight}
        styles={styles}
      >
        {children}
      </CalendarContentFit>
    </div>
  );
});
