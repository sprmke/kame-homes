import type { ElementType, ReactNode } from 'react';

import { cn } from '@/lib/utils';

type ShellProps = {
  children: ReactNode;
  className?: string;
  mode?: 'view' | 'edit';
};

/** Shared parent card for booking view and edit so both modes share one chrome. */
export function BookingDetailShell({ children, className, mode = 'view' }: ShellProps) {
  return (
    <div
      data-mode={mode}
      className={cn(
        'border-border/80 bg-card min-w-0 overflow-hidden rounded-2xl border',
        className
      )}
    >
      {children}
    </div>
  );
}

export function BookingDetailShellHeader({
  children,
  className,
  as: Comp = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}) {
  return (
    <Comp className={cn('border-border/70 bg-muted/25 border-b px-4 py-3.5 sm:px-5', className)}>
      {children}
    </Comp>
  );
}

export function BookingDetailShellBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 space-y-4 px-3 py-4 sm:px-5 sm:py-5', className)}>{children}</div>
  );
}
