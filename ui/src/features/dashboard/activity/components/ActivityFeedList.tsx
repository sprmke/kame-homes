import { type RefObject, useLayoutEffect, useState } from 'react';

import { useVirtualizer, useWindowVirtualizer } from '@tanstack/react-virtual';

import { ActivityRow } from '@/features/dashboard/activity/components/ActivityRow';
import type { ActivityEvent } from '@/features/dashboard/activity/lib/activityCatalog';

import { cn } from '@/lib/utils';

const VIRTUALIZE_THRESHOLD = 30;
const ESTIMATED_ROW_PX = 72;

type Props = {
  events: ActivityEvent[];
  onSelect: (event: ActivityEvent) => void;
  variant?: 'default' | 'compact';
  className?: string;
  /**
   * When set (e.g. Activity manage modal), virtualize against this scrollport.
   * When omitted, use the window (page / super-admin embeds).
   */
  scrollParentRef?: RefObject<HTMLElement | null>;
};

export function ActivityFeedList({
  events,
  onSelect,
  variant = 'default',
  className,
  scrollParentRef,
}: Props) {
  const virtualize = events.length >= VIRTUALIZE_THRESHOLD;
  const useContainer = Boolean(scrollParentRef);

  const [listOffsetTop, setListOffsetTop] = useState(0);
  const [listEl, setListEl] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!listEl || !virtualize || useContainer) return;
    const measure = () => setListOffsetTop(listEl.offsetTop);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [virtualize, useContainer, listEl, events.length]);

  const containerVirtualizer = useVirtualizer({
    count: virtualize && useContainer ? events.length : 0,
    getScrollElement: () => scrollParentRef?.current ?? null,
    estimateSize: () => ESTIMATED_ROW_PX,
    overscan: 12,
    getItemKey: (index) => events[index]?.id ?? index,
  });

  const windowVirtualizer = useWindowVirtualizer({
    count: virtualize && !useContainer ? events.length : 0,
    estimateSize: () => ESTIMATED_ROW_PX,
    overscan: 12,
    getItemKey: (index) => events[index]?.id ?? index,
    scrollMargin: listOffsetTop,
  });

  const virtualizer = useContainer ? containerVirtualizer : windowVirtualizer;

  if (events.length === 0) return null;

  const rowClassName =
    variant === 'compact'
      ? 'border-border/40 border-b last:border-b-0'
      : 'border-border/50 border-b last:border-b-0';

  const renderVirtualRows = () => (
    <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
      {virtualizer.getVirtualItems().map((item) => {
        const event = events[item.index];
        if (!event) return null;
        const offset = useContainer ? 0 : listOffsetTop;
        return (
          <div
            key={item.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            className={cn('absolute left-0 top-0 w-full', rowClassName)}
            style={{
              transform: `translateY(${item.start - offset}px)`,
            }}
          >
            <ActivityRow event={event} onSelect={onSelect} variant={variant} />
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      ref={setListEl}
      className={cn(variant === 'default' && 'surface-card overflow-hidden', className)}
    >
      {virtualize ? (
        renderVirtualRows()
      ) : (
        <div>
          {events.map((event) => (
            <div key={event.id} className={rowClassName}>
              <ActivityRow event={event} onSelect={onSelect} variant={variant} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
