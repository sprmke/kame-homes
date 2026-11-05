import { memo, useMemo } from 'react';

import { rulerTicks, frameToPx } from '@/features/dashboard/marketing/lib/video/v2/timelineScale';

import { cn } from '@/lib/utils';

type Props = {
  fps: number;
  pxPerFrame: number;
  startFrame: number;
  endFrame: number;
  width: number;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  /** Touch layout: the ruler only shows time; scrolling the lanes moves the playhead. */
  inert?: boolean;
};

export const TimelineRuler = memo(function TimelineRuler({
  fps,
  pxPerFrame,
  startFrame,
  endFrame,
  width,
  onPointerDown,
  inert,
}: Props) {
  const ticks = useMemo(
    () => rulerTicks(pxPerFrame, fps, startFrame, endFrame),
    [pxPerFrame, fps, startFrame, endFrame]
  );
  return (
    <div
      className={cn(
        'bg-muted/60 border-border sticky top-0 z-20 h-6 select-none border-b',
        inert ? 'touch-pan-x touch-pan-y' : 'cursor-col-resize touch-none'
      )}
      style={{ width }}
      onPointerDown={inert ? undefined : onPointerDown}
      role="presentation"
    >
      {ticks.map((tick) => (
        <div
          key={tick.frame}
          className="absolute top-0 h-full"
          style={{ left: frameToPx(tick.frame, pxPerFrame) }}
        >
          <div
            className={tick.major ? 'bg-foreground/40 h-2 w-px' : 'bg-foreground/20 mt-1 h-1 w-px'}
          />
          {tick.label ? (
            <span className="text-muted-foreground absolute left-1 top-1.5 text-[10px] tabular-nums leading-none">
              {tick.label}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
});
