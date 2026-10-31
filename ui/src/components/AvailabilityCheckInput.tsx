import { Check, Loader2, X } from 'lucide-react';

import { Input, type InputProps } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { AvailabilityCheckState } from '@/lib/availabilityCheckState';
import { cn } from '@/lib/utils';

export const AVAILABILITY_CHECK_TOOLTIPS = {
  checking: 'Checking availability',
  available: 'Available',
  unavailable: 'Not available',
} as const;

type AvailabilityCheckTooltips = Partial<typeof AVAILABILITY_CHECK_TOOLTIPS>;

function resolveTooltip(
  state: Exclude<AvailabilityCheckState, 'idle'>,
  tooltips: AvailabilityCheckTooltips
): string {
  const merged = { ...AVAILABILITY_CHECK_TOOLTIPS, ...tooltips };
  return merged[state];
}

export function AvailabilityCheckIndicator({
  state,
  tooltips,
  className,
}: {
  state: Exclude<AvailabilityCheckState, 'idle'>;
  tooltips?: AvailabilityCheckTooltips;
  className?: string;
}) {
  const tooltip = resolveTooltip(state, tooltips ?? {});
  const ariaLabel = tooltip;

  const icon =
    state === 'checking' ? (
      <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />
    ) : state === 'available' ? (
      <Check className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
    ) : (
      <X className="text-destructive size-4" aria-hidden />
    );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn('inline-flex size-4 shrink-0 items-center justify-center', className)}
            aria-label={ariaLabel}
            role="status"
          >
            {icon}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function AvailabilityCheckInput({
  checkState,
  tooltips,
  className,
  ...inputProps
}: InputProps & {
  checkState: AvailabilityCheckState;
  tooltips?: AvailabilityCheckTooltips;
}) {
  const showIndicator = checkState !== 'idle';

  return (
    <div className="relative">
      <Input className={cn(showIndicator && 'pr-9', className)} {...inputProps} />
      {showIndicator ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <AvailabilityCheckIndicator
            state={checkState}
            tooltips={tooltips}
            className="pointer-events-auto"
          />
        </div>
      ) : null}
    </div>
  );
}
