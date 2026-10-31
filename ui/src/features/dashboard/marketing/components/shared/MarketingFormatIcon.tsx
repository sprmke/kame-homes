import type { FormatOrientation } from '@/features/dashboard/marketing/lib/marketingFormats';

import { cn } from '@/lib/utils';

type Props = {
  orientation: FormatOrientation;
  selected?: boolean;
  className?: string;
};

export function MarketingFormatIcon({ orientation, selected, className }: Props) {
  const frameClass = cn(
    'rounded-[3px] border-2 border-current',
    selected ? 'text-primary' : 'text-muted-foreground'
  );

  if (orientation === 'portrait') {
    return (
      <span
        className={cn('flex size-9 shrink-0 items-center justify-center', className)}
        aria-hidden
      >
        <span className={cn(frameClass, 'h-6 w-3.5')} />
      </span>
    );
  }

  if (orientation === 'square') {
    return (
      <span
        className={cn('flex size-9 shrink-0 items-center justify-center', className)}
        aria-hidden
      >
        <span className={cn(frameClass, 'size-5')} />
      </span>
    );
  }

  return (
    <span className={cn('flex size-9 shrink-0 items-center justify-center', className)} aria-hidden>
      <span className={cn(frameClass, 'h-3.5 w-6')} />
    </span>
  );
}
