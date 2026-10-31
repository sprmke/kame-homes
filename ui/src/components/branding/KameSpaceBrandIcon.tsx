import { Home } from 'lucide-react';

import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  iconClassName?: string;
};

/** Static app brand mark — teal gradient square with house icon (sidebar header). */
export function KameSpaceBrandIcon({ className, iconClassName }: Props) {
  return (
    <div
      className={cn(
        'gradient-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm',
        className
      )}
    >
      <Home className={cn('text-primary-foreground h-5 w-5', iconClassName)} aria-hidden />
    </div>
  );
}