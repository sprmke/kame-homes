import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Flat section on the page sheet: a heading and content, separated from the previous
 * section by a hairline. No card chrome; the sheet is already the container.
 */
export function GuestTripSection({
  id,
  title,
  action,
  children,
  className,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        'border-border/70 scroll-mt-24 border-t pt-6 first:border-t-0 first:pt-0',
        className
      )}
    >
      <div className="mb-3 flex min-h-[28px] items-center justify-between gap-3">
        <h2 id={headingId} className="text-base font-semibold tracking-tight">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Label / value row inside a section `<dl>`. */
export function GuestTripRow({
  label,
  children,
  emphasis,
}: {
  label: ReactNode;
  children: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
      <dt className="text-muted-foreground min-w-0">{label}</dt>
      <dd
        className={cn(
          'min-w-0 text-right tabular-nums',
          emphasis ? 'text-foreground font-semibold' : 'text-foreground'
        )}
      >
        {children}
      </dd>
    </div>
  );
}

/** Tappable row: icon, title, optional detail, trailing affordance. */
export function GuestTripLinkRow({
  icon,
  title,
  detail,
  trailing,
}: {
  icon: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <span className="flex min-h-[52px] items-center gap-3 py-2">
      <span className="bg-muted text-foreground/80 flex size-9 shrink-0 items-center justify-center rounded-xl">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        {detail ? (
          <span className="text-muted-foreground block truncate text-xs">{detail}</span>
        ) : null}
      </span>
      {trailing}
    </span>
  );
}
