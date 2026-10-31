import { useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  label?: string;
};

/** Center visual while a parking request is searching for a host. */
export function ParkingHostSearchVisual({ className, label = 'Searching for hosts' }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn('flex flex-col items-center gap-4 py-2', className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="relative flex h-28 w-28 items-center justify-center">
        {!reduceMotion ? (
          <>
            <span className="border-primary/25 absolute inset-0 animate-ping rounded-full border motion-reduce:animate-none" />
            <span
              className="border-primary/40 absolute inset-3 animate-ping rounded-full border motion-reduce:animate-none"
              style={{ animationDelay: '0.35s' }}
            />
            <span
              className="border-primary/20 absolute inset-6 animate-ping rounded-full border motion-reduce:animate-none"
              style={{ animationDelay: '0.7s' }}
            />
          </>
        ) : null}
        <span className="bg-primary/10 relative flex h-14 w-14 items-center justify-center rounded-full">
          <span className="bg-primary h-2.5 w-2.5 rounded-full" />
        </span>
      </div>
      <p className="text-muted-foreground text-sm font-medium">{label}</p>
    </div>
  );
}
