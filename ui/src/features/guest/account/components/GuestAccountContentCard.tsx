import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type GuestAccountContentCardProps = {
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function GuestAccountContentCard({
  children,
  className,
  bodyClassName,
}: GuestAccountContentCardProps) {
  return (
    <div
      className={cn(
        'border-border bg-card w-full overflow-hidden rounded-2xl border shadow-sm',
        className
      )}
    >
      <div className={cn('p-4 sm:p-6', bodyClassName)}>{children}</div>
    </div>
  );
}
