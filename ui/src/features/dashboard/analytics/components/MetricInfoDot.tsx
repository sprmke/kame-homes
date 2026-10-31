import { useState } from 'react';

import { Info } from 'lucide-react';

import {
  ANALYTICS_METRIC_GLOSSARY,
  type AnalyticsMetricKey,
} from '@/features/dashboard/analytics/lib/metricGlossary';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

type Props = {
  metric: AnalyticsMetricKey;
  label: string;
  className?: string;
};

/**
 * Small `i` affordance next to a metric name. Hover tooltip on pointer devices,
 * tap popover on touch. The visible glyph stays 14px; the hit area is padded to 44px.
 */
export function MetricInfoDot({ metric, label, className }: Props) {
  const [open, setOpen] = useState(false);
  const isTouch = useIsBelowLg();
  const text = ANALYTICS_METRIC_GLOSSARY[metric];

  const trigger = (
    <span
      className={cn(
        'text-muted-foreground/70 hover:text-foreground -m-2 inline-flex items-center p-2 transition-colors',
        className
      )}
    >
      <Info className="size-3.5" aria-hidden />
    </span>
  );

  if (isTouch) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label={`What is ${label}?`}
          onClick={(event) => event.stopPropagation()}
        >
          {trigger}
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          className="max-w-[16rem] p-3 text-xs leading-relaxed"
        >
          {text}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger aria-label={`What is ${label}?`} onClick={(event) => event.preventDefault()}>
        {trigger}
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-[16rem] text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
