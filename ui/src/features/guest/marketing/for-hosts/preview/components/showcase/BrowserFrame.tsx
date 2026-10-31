import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Browser-chrome wrapper for the sticky feature showcase. Keeps a fixed body height so demos
 * cross-fade in place without the frame resizing.
 */
export function BrowserFrame({
  path,
  children,
  className,
}: {
  path: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border bg-card overflow-hidden rounded-2xl border shadow-[0_24px_60px_-32px_hsl(var(--shadow-color)/0.28)]',
        className
      )}
    >
      <div className="border-border bg-muted/40 flex items-center gap-2 border-b px-3.5 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="bg-border h-2.5 w-2.5 rounded-full" />
          <span className="bg-border h-2.5 w-2.5 rounded-full" />
          <span className="bg-border h-2.5 w-2.5 rounded-full" />
        </span>
        <span className="border-border bg-background text-muted-foreground ml-2 hidden max-w-full truncate rounded-md border px-2.5 py-1 text-[11px] font-medium sm:block">
          {path}
        </span>
      </div>
      <div className="h-[340px] overflow-hidden p-4 sm:h-[380px] sm:p-5">{children}</div>
    </div>
  );
}
