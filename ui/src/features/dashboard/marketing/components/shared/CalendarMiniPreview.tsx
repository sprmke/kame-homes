import { memo, useId, useMemo } from 'react';

import type { CalendarStyles } from '@/features/dashboard/marketing/components/calendar-builder/types';
import { calendarMiniLayout } from '@/features/dashboard/marketing/lib/calendarMiniLayout';

type Props = {
  styles: CalendarStyles;
  className?: string;
};

/**
 * Calendar layout card art: a few dozen SVG shapes instead of a live calendar DOM.
 * Cheap enough to show every layout at once, on any device, in the current theme.
 */
export const CalendarMiniPreview = memo(function CalendarMiniPreview({ styles, className }: Props) {
  const mini = useMemo(() => calendarMiniLayout(styles), [styles]);
  const clipId = useId();

  return (
    <svg
      viewBox={`0 0 ${mini.width} ${mini.height}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      focusable="false"
    >
      <rect width={mini.width} height={mini.height} fill={mini.canvasFill} />
      <clipPath id={clipId}>
        <rect
          x={mini.card.x}
          y={mini.card.y}
          width={mini.card.width}
          height={mini.card.height}
          rx={mini.card.radius}
        />
      </clipPath>
      <rect
        x={mini.card.x}
        y={mini.card.y}
        width={mini.card.width}
        height={mini.card.height}
        rx={mini.card.radius}
        fill={mini.card.fill}
      />
      {mini.card.imageUrl ? (
        <g clipPath={`url(#${clipId})`}>
          <image
            href={mini.card.imageUrl}
            x={mini.card.x}
            y={mini.card.y}
            width={mini.card.width}
            height={mini.card.height}
            preserveAspectRatio="xMidYMid slice"
          />
          {mini.card.overlay ? (
            <rect
              x={mini.card.x}
              y={mini.card.y}
              width={mini.card.width}
              height={mini.card.height}
              fill={mini.card.overlay}
            />
          ) : null}
        </g>
      ) : null}
      <rect
        x={mini.titleBar.x}
        y={mini.titleBar.y}
        width={mini.titleBar.width}
        height={mini.titleBar.height}
        rx={mini.titleBar.height / 2}
        fill={mini.titleBar.fill}
        opacity={0.9}
      />
      {mini.subtitleBar ? (
        <rect
          x={mini.subtitleBar.x}
          y={mini.subtitleBar.y}
          width={mini.subtitleBar.width}
          height={mini.subtitleBar.height}
          rx={mini.subtitleBar.height / 2}
          fill={mini.subtitleBar.fill}
          opacity={0.55}
        />
      ) : null}
      {mini.dayNames.map((name, index) => (
        <rect
          key={index}
          x={name.x}
          y={name.y}
          width={name.width}
          height={name.height}
          rx={name.height / 2}
          fill={name.fill}
          opacity={0.6}
        />
      ))}
      {mini.cells.map((cell, index) =>
        cell.state === 'empty' && mini.shape !== 'block' ? null : mini.shape === 'circle' ||
          mini.shape === 'ring' ||
          mini.shape === 'ink' ? (
          <circle
            key={index}
            cx={cell.x + cell.size / 2}
            cy={cell.y + cell.size / 2}
            r={cell.size / 2}
            fill={mini.shape === 'ring' ? 'none' : cell.fill}
            stroke={mini.shape === 'ring' ? (cell.stroke ?? cell.fill) : undefined}
            strokeWidth={mini.shape === 'ring' ? Math.max(0.35, cell.size * 0.08) : undefined}
            opacity={cell.state === 'empty' ? 0.35 : 1}
          />
        ) : (
          <rect
            key={index}
            x={cell.x}
            y={cell.y}
            width={cell.size}
            height={cell.size}
            rx={mini.cellRadius}
            fill={cell.fill}
            stroke={cell.stroke ?? undefined}
            strokeWidth={cell.stroke ? Math.max(0.25, cell.size * 0.04) : undefined}
            opacity={cell.state === 'empty' ? 0.35 : 1}
          />
        )
      )}
      {mini.legend.map((dot, index) => (
        <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill={dot.fill} />
      ))}
    </svg>
  );
});
