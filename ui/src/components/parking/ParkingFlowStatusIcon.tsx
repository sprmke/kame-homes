import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  pulse?: boolean;
  className?: string;
  iconClassName?: string;
};

/** Status icon with optional live-search pulse ring (waiting states). */
export function ParkingFlowStatusIcon({
  icon: Icon,
  pulse = false,
  className,
  iconClassName,
}: Props) {
  return (
    <div className={cn('relative flex h-11 w-11 shrink-0 items-center justify-center', className)}>
      {pulse ? (
        <span
          className="border-primary/30 absolute inset-0 rounded-xl border-2 motion-reduce:hidden"
          aria-hidden
        >
          <span className="border-primary/40 absolute inset-0 animate-ping rounded-xl border motion-reduce:animate-none" />
        </span>
      ) : null}
      <Icon className={cn('relative h-5 w-5', iconClassName)} aria-hidden />
    </div>
  );
}
