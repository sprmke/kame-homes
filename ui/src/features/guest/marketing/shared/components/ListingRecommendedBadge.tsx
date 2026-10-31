import { BadgeCheck } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** Guest-facing; keep local so dashboard copy does not import into marketing. */
const GUEST_RECOMMENDED_TOOLTIP =
  'Identity, ownership, and Azure records verified by the platform.';

type Props = {
  className?: string;
  size?: 'sm' | 'md';
  /** When false, render the pill only (e.g. non-interactive preview mocks). Default true. */
  withTooltip?: boolean;
};

export function ListingRecommendedBadge({ className, size = 'sm', withTooltip = true }: Props) {
  const pill = (
    <span
      className={cn(
        'bg-primary/12 text-primary ring-primary/20 inline-flex shrink-0 items-center gap-1 rounded-full font-semibold ring-1 ring-inset',
        size === 'sm' && 'px-2 py-0.5 text-[11px]',
        size === 'md' && 'gap-1.5 px-2.5 py-1 text-xs',
        className
      )}
    >
      <BadgeCheck className={cn(size === 'sm' ? 'size-3' : 'size-3.5')} aria-hidden />
      Recommended
    </span>
  );

  if (!withTooltip) {
    return pill;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="focus-visible:ring-ring inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            aria-label={GUEST_RECOMMENDED_TOOLTIP}
          >
            {pill}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[min(90vw,16rem)] text-xs leading-snug">
          {GUEST_RECOMMENDED_TOOLTIP}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
