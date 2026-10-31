import { useId } from 'react';

import { platformWatermarkLabel } from '@/lib/platformBranding';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  /** Tighter tile spacing for template thumbnails. */
  compact?: boolean;
};

/**
 * Soft diagonal platform tile used by Marketing Studio plan gates.
 * Dual ink (dark + light) stays readable on light calendars and dark video frames.
 * Pattern ids are sanitized — React `useId()` colons break `url(#…)` in SVG.
 */
export function PlanGateWatermarkPattern({ className, compact = false }: Props) {
  const watermarkText = platformWatermarkLabel();
  const patternId = `plan-wm-${useId().replace(/:/g, '')}`;
  const tileW = compact ? 168 : 260;
  const tileH = compact ? 96 : 148;
  const fontSize = compact ? 10 : 13;
  const y = Math.round(tileH * 0.58);

  return (
    <svg
      className={cn('pointer-events-none absolute inset-0 h-full w-full select-none', className)}
      aria-hidden
    >
      <defs>
        <pattern
          id={patternId}
          width={tileW}
          height={tileH}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-28)"
        >
          <text
            x="12"
            y={y}
            fill="rgba(15, 23, 42, 0.16)"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize={fontSize}
            fontWeight="500"
            letterSpacing="0.3em"
          >
            {watermarkText}
          </text>
          <text
            x="13"
            y={y + 1}
            fill="rgba(255, 255, 255, 0.18)"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize={fontSize}
            fontWeight="500"
            letterSpacing="0.3em"
          >
            {watermarkText}
          </text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
