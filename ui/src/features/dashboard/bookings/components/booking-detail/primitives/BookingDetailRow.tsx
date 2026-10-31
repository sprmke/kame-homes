import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Wraps a group of `BookingDetailRow`s with the divider treatment. */
export function BookingDetailRowGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('divide-border/60 divide-y', className)}>{children}</div>;
}

/**
 * PMS-style label ↔ value row for view mode (not a form field).
 * Long values wrap; empty values omit the row.
 */
export function BookingDetailRow({
  label,
  value,
  icon,
  numeric,
  children,
  className,
}: {
  label: string;
  value?: string | number | null;
  icon?: ReactNode;
  /** Money/count values — keeps digits on a fixed advance so stacked rows align. */
  numeric?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const hasValue = value !== null && value !== undefined && value !== '' && value !== '-';
  if (!hasValue && !children) return null;

  return (
    <div
      className={cn(
        'flex flex-col gap-1 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6',
        className
      )}
    >
      <span className="text-muted-foreground shrink-0 text-xs font-medium">{label}</span>
      {children ?? (
        <span
          className={cn(
            'text-foreground flex min-w-0 items-center justify-end gap-1.5 text-right text-sm font-semibold leading-snug sm:max-w-[68%]',
            numeric && 'tabular-nums'
          )}
        >
          {icon}
          <span className="min-w-0 [overflow-wrap:anywhere]">{String(value)}</span>
        </span>
      )}
    </div>
  );
}

export function BookingDetailRowBlock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('py-2.5', className)}>{children}</div>;
}
