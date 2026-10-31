import { memo, useEffect, useRef, useState } from 'react';

import { CalendarCanvasFrame } from '@/features/dashboard/marketing/components/calendar-builder/components/CalendarCanvasFrame';
import { CalendarPreview } from '@/features/dashboard/marketing/components/calendar-builder/components/CalendarPreview';
import type {
  CalendarStyles,
  PreviewBooking,
} from '@/features/dashboard/marketing/components/calendar-builder/types';
import {
  CALENDAR_CANVAS_DIMENSIONS,
  normalizeCalendarCanvasFrame,
} from '@/features/dashboard/marketing/lib/calendarCanvasFormats';

type Props = {
  styles: CalendarStyles;
  propertyName: string;
  bookings: PreviewBooking[];
  month: Date;
};

/**
 * Sidebar card art: the real calendar DOM scaled down with CSS. No screenshot
 * capture, so it is always in the current theme and costs nothing to update.
 * Mounted only once the card nears the viewport.
 */
export const CalendarLayoutLivePreview = memo(function CalendarLayoutLivePreview({
  styles,
  propertyName,
  bookings,
  month,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px', threshold: 0.01 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = hostRef.current;
    if (!node || !visible) return;
    const update = () => setWidth(node.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  const frame = normalizeCalendarCanvasFrame(styles.canvasFrame);
  const dims = CALENDAR_CANVAS_DIMENSIONS[frame.format];
  const scale = width > 0 ? width / dims.width : 0;

  return (
    <div ref={hostRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {visible && scale > 0 ? (
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: dims.width,
            height: dims.height,
          }}
        >
          <CalendarCanvasFrame styles={styles}>
            {(calendarSize) => (
              <CalendarPreview
                styles={styles}
                propertyName={propertyName}
                bookings={bookings}
                displayMonth={month}
                layoutMaxWidth={calendarSize}
              />
            )}
          </CalendarCanvasFrame>
        </div>
      ) : null}
    </div>
  );
});
